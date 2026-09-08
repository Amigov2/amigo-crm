// Envoi de Web Push notifications à toutes les subscriptions enregistrées.
// Appelé depuis wa-labo3d-webhook après persist d'un inbound.

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:labo3drio@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function pushToAllSubscribers({ title, body, url, badgeCount }) {
  console.log("[push] pushToAllSubscribers START title=", title);
  if (!process.env.VAPID_PRIVATE_KEY) { console.log("[push] SKIP no-vapid"); return { skipped: "no-vapid-configured" }; }

  const { data: row, error } = await supabase.from("amigo_data").select("value").eq("key", "push_subscriptions").maybeSingle();
  if (error) console.error("[push] supabase read error:", error.message);
  let subs = [];
  if (row?.value) {
    try { subs = typeof row.value === "string" ? JSON.parse(row.value) : row.value; } catch {}
    if (!Array.isArray(subs)) subs = [];
  }
  console.log("[push] subs count=", subs.length);
  if (subs.length === 0) return { skipped: "no-subscribers" };

  const payload = JSON.stringify({ title, body, url, badgeCount: badgeCount || 1 });
  console.log("[push] sending to", subs.length, "endpoints, payload=", payload);
  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload))
  );
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error("[push] sub", i, "FAILED:", r.reason?.statusCode, r.reason?.message);
    else console.log("[push] sub", i, "sent OK");
  });

  const invalidEndpoints = [];
  results.forEach((r, i) => {
    if (r.status === "rejected" && [404, 410].includes(r.reason?.statusCode)) {
      invalidEndpoints.push(subs[i].endpoint);
    }
  });

  if (invalidEndpoints.length > 0) {
    const clean = subs.filter((s) => !invalidEndpoints.includes(s.endpoint));
    await supabase.from("amigo_data").upsert(
      { key: "push_subscriptions", value: JSON.stringify(clean), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  }

  return {
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
    cleaned: invalidEndpoints.length,
  };
}
