// Enregistre une subscription Web Push en Supabase amigo_data (clé push_subscriptions)
// Body: { subscription: { endpoint, keys: { p256dh, auth } }, user_email }

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  console.log("[subscribe-push] body type:", typeof req.body);
  console.log("[subscribe-push] body preview:", JSON.stringify(req.body).slice(0, 200));

  const { subscription, user_email } = req.body || {};
  if (!subscription?.endpoint) {
    console.log("[subscribe-push] MISSING endpoint");
    return res.status(400).json({ error: "subscription.endpoint required" });
  }

  console.log("[subscribe-push] endpoint:", subscription.endpoint.slice(0, 60));
  console.log("[subscribe-push] user_email:", user_email);
  console.log("[subscribe-push] keys present:", !!subscription.keys?.p256dh, !!subscription.keys?.auth);

  const { data: row, error: readErr } = await supabase.from("amigo_data").select("value").eq("key", "push_subscriptions").maybeSingle();
  if (readErr) console.error("[subscribe-push] read error:", readErr.message);
  let existing = [];
  if (row?.value) {
    try { existing = typeof row.value === "string" ? JSON.parse(row.value) : row.value; } catch {}
    if (!Array.isArray(existing)) existing = [];
  }
  console.log("[subscribe-push] existing subs:", existing.length);

  const filtered = existing.filter((s) => s.endpoint !== subscription.endpoint);
  filtered.push({
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    user_email: user_email || null,
    created_at: new Date().toISOString(),
  });

  const { error } = await supabase.from("amigo_data").upsert(
    { key: "push_subscriptions", value: JSON.stringify(filtered), updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) {
    console.error("[subscribe-push] upsert error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  console.log("[subscribe-push] SUCCESS total:", filtered.length);
  return res.status(200).json({ ok: true, total_subscriptions: filtered.length });
}
