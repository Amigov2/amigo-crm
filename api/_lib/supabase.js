import { createClient } from "@supabase/supabase-js";

export const DATA_KEY = "amigo-v9";

let _client = null;
export function getSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url) throw new Error("SUPABASE_URL absent (env Vercel)");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY absent (env Vercel)");
  _client = createClient(url, key);
  return _client;
}

export async function loadAmigoData() {
  const sb = getSupabase();
  const { data, error } = await sb.from("amigo_data").select("value").eq("key", DATA_KEY).single();
  if (error || !data) throw new Error(`Supabase load failed: ${error?.message || "no data"}`);
  return JSON.parse(data.value);
}

export async function saveAmigoData(data) {
  const sb = getSupabase();
  const { error } = await sb.from("amigo_data").upsert({
    key: DATA_KEY,
    value: JSON.stringify(data),
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(`Supabase save failed: ${error.message}`);
}

export async function updateOrder(orderId, patch) {
  const data = await loadAmigoData();
  const idx = (data.orders || []).findIndex(o => o.id === orderId);
  if (idx === -1) throw new Error(`Order ${orderId} not found`);
  data.orders[idx] = { ...data.orders[idx], ...patch };
  await saveAmigoData(data);
  return data.orders[idx];
}

export async function nextRpsNumber() {
  const data = await loadAmigoData();
  const next = (data.nfseSequence || 0) + 1;
  data.nfseSequence = next;
  await saveAmigoData(data);
  return next;
}

// ─── WhatsApp Labo 3D (namespace séparé pour isoler des writes fréquents) ───

export const WA_LABO3D_KEY = "wa_labo3d";
export const WA_LABO3D_KB_KEY = "wa_labo3d_kb";

export async function loadWaLabo3d() {
  const sb = getSupabase();
  // Lit state (conversations, templates, etc) ET knowledge_base en parallèle
  // depuis deux clés distinctes → aucune race condition possible entre webhooks et kb-refresh
  const [stateRes, kbRes] = await Promise.all([
    sb.from("amigo_data").select("value").eq("key", WA_LABO3D_KEY).maybeSingle(),
    sb.from("amigo_data").select("value").eq("key", WA_LABO3D_KB_KEY).maybeSingle(),
  ]);
  if (stateRes.error) throw new Error(`Supabase load wa_labo3d failed: ${stateRes.error.message}`);
  let state = { conversations: [], templates: [] };
  if (stateRes.data) {
    try {
      const parsed = JSON.parse(stateRes.data.value);
      state = { ...parsed, conversations: parsed.conversations || [], templates: parsed.templates || [] };
    } catch {}
  }
  if (kbRes.data) {
    try {
      const kbParsed = JSON.parse(kbRes.data.value);
      if (kbParsed?.knowledge_base) {
        state.knowledge_base = kbParsed.knowledge_base;
        state.knowledge_base_updated_at = kbParsed.knowledge_base_updated_at;
      }
    } catch {}
  }
  return state;
}

export async function saveWaLabo3d(payload) {
  const sb = getSupabase();
  // On EXCLUT explicitement knowledge_base du state save → protégé par la clé WA_LABO3D_KB_KEY
  const { knowledge_base, knowledge_base_updated_at, ...rest } = payload;

  // Smart merge (toujours ON) : évite d'écraser des données créées par un webhook
  // concurrent entre notre load et notre save.
  // Protection :
  //   1. pending_quote créé/résolu atomiquement par un autre process (uniquement si locking ON)
  //   2. messages inbound/outbound ajoutés par un webhook parallèle — union par meta_id/id
  //      (nécessaire quand un client envoie plusieurs messages rapides : Meta envoie
  //      un webhook par message, ils se chevauchent, et le last-writer écrasait les autres)
  try {
    const fresh = await loadWaLabo3d();
    const freshConvs = fresh.conversations || [];
    const freshById = new Map(freshConvs.map(c => [c.id, c]));

    for (const ramConv of rest.conversations || []) {
      const dbConv = freshById.get(ramConv.id);
      if (!dbConv) continue;

      if (isWaLocking3dEnabled()) {
        if (dbConv.pending_quote && !ramConv.pending_quote) {
          ramConv.pending_quote = dbConv.pending_quote;
        } else if (dbConv.pending_quote?.resolved_at && !ramConv.pending_quote?.resolved_at) {
          ramConv.pending_quote = dbConv.pending_quote;
        }
      }

      // Protection pending_meshy : si un webhook parallèle a queué un job nano
      // ET que la RAM n'en a pas, on préserve le job DB. Mais on NE écrase JAMAIS
      // un nouveau job (queued/running) en RAM par un ancien failed/completed DB —
      // c'est un retry légitime.
      const dbActiveJob = dbConv.pending_meshy && !dbConv.pending_meshy.completed_at;
      const ramHasNewJob = ramConv.pending_meshy && ramConv.pending_meshy.status === "queued";
      if (dbActiveJob && !ramConv.pending_meshy) {
        ramConv.pending_meshy = dbConv.pending_meshy;
      }
      // NOTE: on ne récupère PAS le completed_at DB si RAM a un nouveau queued —
      // c'est un retry manuel qu'il faut respecter.

      // Union des messages par meta_id (unique) ou id
      const ramMsgs = ramConv.messages || [];
      const dbMsgs = dbConv.messages || [];
      if (dbMsgs.length > 0) {
        const seen = new Set();
        const keyOf = (m) => m.meta_id || m.id || `${m.direction}:${m.timestamp}:${(m.content || "").slice(0, 40)}`;
        const merged = [];
        for (const m of [...dbMsgs, ...ramMsgs]) {
          const k = keyOf(m);
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(m);
        }
        merged.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
        ramConv.messages = merged;
        // Recalcule last_message_at à partir du dernier msg (source de vérité)
        const lastMsg = merged[merged.length - 1];
        if (lastMsg) {
          const ramTs = ramConv.last_message_at ? new Date(ramConv.last_message_at).getTime() : 0;
          const lastTs = new Date(lastMsg.timestamp || 0).getTime();
          if (lastTs > ramTs) ramConv.last_message_at = lastMsg.timestamp;
        }
      }
    }

    // Convs qui existent en DB mais pas en RAM (créées par un webhook parallèle) → append
    const ramConvIds = new Set((rest.conversations || []).map(c => c.id));
    for (const dbConv of freshConvs) {
      if (!ramConvIds.has(dbConv.id)) {
        (rest.conversations = rest.conversations || []).push(dbConv);
      }
    }
  } catch (mergeErr) {
    console.warn("[saveWaLabo3d] smart merge failed, proceeding with RAM state:", mergeErr.message);
  }

  const { error } = await sb.from("amigo_data").upsert({
    key: WA_LABO3D_KEY,
    value: JSON.stringify(rest),
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(`Supabase save wa_labo3d failed: ${error.message}`);
}

// ─── Écritures atomiques via RPC Postgres (protection race condition) ───
// Guardé par le flag WA_LABO3D_LOCKING. Si off, on garde l'ancien comportement
// last-writer-wins pour éviter tout risque de régression au rollout.

export function isWaLocking3dEnabled() {
  return process.env.WA_LABO3D_LOCKING === "1";
}

// Écrit atomiquement le pending_quote sur une conv (via jsonb_set + FOR UPDATE côté PG).
// Utilisé à la création d'un devis IA en attente d'approbation admin.
// Return true si conv trouvée et update fait, false sinon (log & bail côté caller).
export async function setPendingQuoteAtomic(convId, pendingQuote) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("wa_labo3d_set_pending_quote", {
    p_conv_id: convId,
    p_pending: pendingQuote,
  });
  if (error) throw new Error(`RPC set_pending_quote failed: ${error.message}`);
  return data === true;
}

// Résout atomiquement le pending_quote + append un nouveau message outbound.
// Utilisé quand l'admin répond OK/prix et qu'on envoie au client.
export async function resolvePendingQuoteAtomic(convId, resolvedFields, newMessage, lastMessageAt) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("wa_labo3d_resolve_pending_quote", {
    p_conv_id: convId,
    p_resolved_fields: resolvedFields,
    p_new_message: newMessage,
    p_last_message_at: lastMessageAt,
  });
  if (error) throw new Error(`RPC resolve_pending_quote failed: ${error.message}`);
  return data === true;
}

export async function saveWaLabo3dKB({ knowledge_base, knowledge_base_updated_at }) {
  const sb = getSupabase();
  const { error } = await sb.from("amigo_data").upsert({
    key: WA_LABO3D_KB_KEY,
    value: JSON.stringify({ knowledge_base, knowledge_base_updated_at: knowledge_base_updated_at || new Date().toISOString() }),
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(`Supabase save wa_labo3d_kb failed: ${error.message}`);
}
