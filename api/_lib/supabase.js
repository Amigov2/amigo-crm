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

export async function loadWaLabo3d() {
  const sb = getSupabase();
  const { data, error } = await sb.from("amigo_data").select("value").eq("key", WA_LABO3D_KEY).maybeSingle();
  if (error) throw new Error(`Supabase load wa_labo3d failed: ${error.message}`);
  if (!data) return { conversations: [], templates: [] };
  try {
    const parsed = JSON.parse(data.value);
    // Préserve tous les champs (knowledge_base, knowledge_base_updated_at, push_subscriptions…)
    // et garantit les 2 tableaux structurés par défaut.
    return {
      ...parsed,
      conversations: parsed.conversations || [],
      templates: parsed.templates || []
    };
  } catch {
    return { conversations: [], templates: [] };
  }
}

export async function saveWaLabo3d(payload) {
  const sb = getSupabase();
  const { error } = await sb.from("amigo_data").upsert({
    key: WA_LABO3D_KEY,
    value: JSON.stringify(payload),
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(`Supabase save wa_labo3d failed: ${error.message}`);
}
