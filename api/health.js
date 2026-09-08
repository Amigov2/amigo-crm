// Endpoint /api/health :
//   - GET normal : renvoie {ok:true}
//   - GET ?check=1 : renvoie webhook_labo3d status (utilisé par le badge CRM)
//   - Cron Vercel : détecte crash webhook + envoie alerte WhatsApp à ALERT_WA_PHONES
//     (throttle 2h pour ne pas spammer).

import { getSupabase } from "./_lib/supabase.js";
import { sendMetaMessage } from "./_lib/meta-send.js";

const WEBHOOK_HEALTH_URL =
  "https://amigo-labo3d.vercel.app/api/wa-labo3d-webhook?hub.mode=subscribe&hub.verify_token=healthcheck&hub.challenge=1";
const THROTTLE_MS = 2 * 60 * 60 * 1000; // 2h entre alertes
const ALERT_KEY = "labo3d_health_last_alert";

async function checkWebhook() {
  try {
    const r = await fetch(WEBHOOK_HEALTH_URL, { method: "GET" });
    return { healthy: r.status < 500, status: r.status };
  } catch (e) {
    return { healthy: false, status: 0, error: String(e.message || e).slice(0, 200) };
  }
}

async function shouldSendAlert() {
  try {
    const sb = getSupabase();
    const { data } = await sb.from("amigo_data").select("value").eq("key", ALERT_KEY).maybeSingle();
    if (!data?.value) return true;
    const lastMs = new Date(data.value).getTime();
    return Date.now() - lastMs > THROTTLE_MS;
  } catch { return true; }
}

async function markAlertSent() {
  try {
    const sb = getSupabase();
    await sb.from("amigo_data").upsert({ key: ALERT_KEY, value: new Date().toISOString() });
  } catch {}
}

async function sendAlerts(status) {
  const phones = (process.env.ALERT_WA_PHONES || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!phones.length) return { skipped: "no_phones_configured" };

  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const text =
    `🚨 LABO3D BOT DOWN\n\n` +
    `Webhook /api/wa-labo3d-webhook renvoie ${status}.\n` +
    `Les messages clients ne sont plus traités.\n\n` +
    `Dashboard : https://vercel.com/jadeinvestissement-9941s-projects/amigo-crm\n` +
    `Heure : ${now}`;

  const results = [];
  for (const phone of phones) {
    try {
      const id = await sendMetaMessage({ phone, text });
      results.push({ phone, ok: true, meta_id: id });
    } catch (e) {
      results.push({ phone, ok: false, error: String(e.message || e).slice(0, 200) });
    }
  }
  return { alerted: results };
}

export default async function handler(req, res) {
  const isCron = !!req.headers["x-vercel-cron"];
  const isCheck = req.query?.check === "1";

  const base = { ok: true, service: "amigo-crm-api", time: new Date().toISOString() };

  // Ping simple sans check
  if (!isCron && !isCheck) return res.status(200).json(base);

  // Check webhook (utilisé par badge CRM et cron)
  const wh = await checkWebhook();
  base.webhook_labo3d = wh;

  // Si cron et webhook down → alerte WA
  if (isCron && !wh.healthy) {
    const canAlert = await shouldSendAlert();
    if (canAlert) {
      const alertResult = await sendAlerts(wh.status);
      await markAlertSent();
      Object.assign(base, alertResult);
    } else {
      base.alert = "throttled_2h";
    }
  }

  return res.status(200).json(base);
}
