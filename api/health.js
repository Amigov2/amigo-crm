// Endpoint /api/health :
//   - GET normal : renvoie {ok:true}
//   - GET ?check=1 : renvoie webhook_labo3d status (utilisé par le badge CRM)
//   - Cron Vercel : détecte crash webhook + envoie alerte WhatsApp à ALERT_WA_PHONES
//     (throttle 2h pour ne pas spammer).

import { getSupabase, loadWaLabo3d } from "./_lib/supabase.js";
import { sendMetaMessage } from "./_lib/meta-send.js";

const MS_24H = 24 * 60 * 60 * 1000;

function fmtTime() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function fmtDate() {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

async function buildDailyReport() {
  const state = await loadWaLabo3d();
  const convs = state.conversations || [];
  const now = Date.now();

  // Cutoff : 24h dernières (pour "nouveaux" et "actifs")
  const dayAgo = now - MS_24H;

  const stats = {
    total: convs.length,
    new_today: 0,        // convs créées aujourd'hui
    active_24h: 0,       // convs avec inbound < 24h
    awaiting_client: 0,  // dernier msg = outbound (le client doit répondre)
    awaiting_us: 0,      // dernier msg = inbound < 24h (on doit répondre)
    stale_over_24h: [],  // dernier inbound > 24h, jamais répondu → à relancer main
  };

  for (const c of convs) {
    const msgs = c.messages || [];
    if (!msgs.length) continue;
    const first = msgs[0];
    const last = msgs[msgs.length - 1];
    const firstMs = new Date(first.timestamp).getTime();
    const lastMs = new Date(last.timestamp).getTime();

    if (firstMs > dayAgo) stats.new_today++;

    // Trouve le dernier inbound
    let lastInboundMs = 0;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].direction === "inbound") { lastInboundMs = new Date(msgs[i].timestamp).getTime(); break; }
    }

    const lastIsInbound = last.direction === "inbound";
    const lastInboundAgeMs = lastInboundMs ? now - lastInboundMs : Infinity;

    if (lastInboundAgeMs < MS_24H) stats.active_24h++;

    if (lastIsInbound) {
      // le dernier message = client → nous devons répondre
      if (lastInboundAgeMs < MS_24H) {
        stats.awaiting_us++;
      } else if (lastInboundAgeMs < 15 * 24 * MS_24H) {
        // > 24h et < 15 jours → à relancer manuellement
        stats.stale_over_24h.push({
          name: c.contact_name || c.phone,
          preview: (last.content || "").slice(0, 60),
          days: Math.floor(lastInboundAgeMs / MS_24H),
        });
      }
    } else {
      // le dernier message = nous → attente réponse client
      stats.awaiting_client++;
    }
  }

  stats.stale_over_24h.sort((a, b) => a.days - b.days);
  return stats;
}

function formatReport(s) {
  const lines = [
    `📊 *Récap LABO3D — ${fmtDate()}*`,
    ``,
    `• ${s.new_today} nouveaux clients aujourd'hui`,
    `• ${s.active_24h} conv actives (< 24h Meta)`,
    `• ${s.awaiting_us} attendent notre réponse`,
    `• ${s.awaiting_client} attendent réponse client`,
    `• ${s.total} conv au total`,
    ``,
  ];

  if (s.stale_over_24h.length > 0) {
    lines.push(`⚠️ *${s.stale_over_24h.length} conv > 24h à relancer manuel* (Meta bloque texte libre) :`);
    for (const c of s.stale_over_24h.slice(0, 10)) {
      lines.push(`• ${c.name} (${c.days}j) — "${c.preview}"`);
    }
    if (s.stale_over_24h.length > 10) {
      lines.push(`... +${s.stale_over_24h.length - 10} autres`);
    }
    lines.push(``);
  }

  lines.push(`🕐 ${fmtTime()}`);
  return lines.join("\n");
}

async function sendReports(text) {
  const phones = (process.env.ALERT_WA_PHONES || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!phones.length) return { skipped: "no_phones_configured" };

  const results = [];
  for (const phone of phones) {
    try {
      const id = await sendMetaMessage({ phone, text });
      results.push({ phone, ok: true, meta_id: id });
    } catch (e) {
      results.push({ phone, ok: false, error: String(e.message || e).slice(0, 200) });
    }
  }
  return { report_sent: results };
}

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
  const isCheck = req.query?.check === "1";
  const isReport = req.query?.report === "daily";
  const canAlertWhenDown = !!req.headers["x-vercel-cron"] || req.query?.alert === "1";

  const base = { ok: true, service: "amigo-crm-api", time: new Date().toISOString() };

  // Mode 1 : ping simple
  if (!isCheck && !isReport) return res.status(200).json(base);

  // Mode 2 : rapport quotidien
  if (isReport) {
    try {
      const stats = await buildDailyReport();
      const text = formatReport(stats);
      const sendResult = await sendReports(text);
      return res.status(200).json({ ...base, ...stats, ...sendResult });
    } catch (e) {
      return res.status(500).json({ ...base, error: String(e.message || e).slice(0, 300) });
    }
  }

  // Mode 3 : healthcheck (badge CRM + cron externe iMac)
  const wh = await checkWebhook();
  base.webhook_labo3d = wh;

  // Alerte WA uniquement si le caller a passé alert=1 (cron iMac) ou vient d'un cron Vercel
  if (canAlertWhenDown && !wh.healthy) {
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
