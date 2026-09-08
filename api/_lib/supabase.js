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
  const { error } = await sb.from("amigo_data").upsert({
    key: WA_LABO3D_KEY,
    value: JSON.stringify(rest),
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(`Supabase save wa_labo3d failed: ${error.message}`);
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
