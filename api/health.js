// Endpoint /api/health : simple healthcheck.
//   - GET normal : renvoie {ok:true} + status du webhook labo3d (pour badge CRM)
//
// Le CRM appelle cet endpoint au load pour afficher un badge 🟢/🔴 dans l'inbox.
// Pas d'alerte WA (préférence utilisateur : silence, tu vois l'état dans le CRM).

const WEBHOOK_HEALTH_URL =
  "https://amigo-labo3d.vercel.app/api/wa-labo3d-webhook?hub.mode=subscribe&hub.verify_token=healthcheck&hub.challenge=1";

async function checkWebhook() {
  try {
    const r = await fetch(WEBHOOK_HEALTH_URL, { method: "GET" });
    // 403 (verify token invalide) OU 200 = serveur vivant → OK
    // 500+ = crash serveur → NOT OK
    return { healthy: r.status < 500, status: r.status };
  } catch (e) {
    return { healthy: false, status: 0, error: String(e.message || e).slice(0, 200) };
  }
}

export default async function handler(req, res) {
  const includeWebhook = req.query?.check === "1" || req.query?.webhook === "1";

  const base = {
    ok: true,
    service: "amigo-crm-api",
    time: new Date().toISOString(),
  };

  if (!includeWebhook) return res.status(200).json(base);

  const wh = await checkWebhook();
  return res.status(200).json({
    ...base,
    webhook_labo3d: wh,
  });
}
