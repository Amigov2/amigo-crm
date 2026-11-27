// Endpoint /api/health :
//   - GET normal : renvoie {ok:true}
//   - GET ?check=1 : renvoie webhook_labo3d status (utilisé par le badge CRM)
//   - Cron Vercel : détecte crash webhook + envoie alerte WhatsApp à ALERT_WA_PHONES
//     (throttle 2h pour ne pas spammer).

import { getSupabase, loadWaLabo3d } from "./_lib/supabase.js";
import { sendMetaMessage } from "./_lib/meta-send.js";
import { processAiResponses } from "./wa-labo3d-webhook.js";
import { getAdminPhones } from "./_lib/quote-approval.js";

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

// ─── Check bot "stuck" : conv avec inbound non répondu par le bot depuis N min
// alors que ai_auto=true et pas escalated → signale un skip silencieux (le bug
// prod du 12/09 sur Jon Ben et Mariana Secretaria).
const STUCK_MIN_MINUTES = 5;   // âge min du inbound (laisse le bot répondre)
const STUCK_MAX_MINUTES = 60;  // au-delà, on considère que c'est trop vieux
const STUCK_ALERT_KEY = "labo3d_stuck_last_alert";
const STUCK_THROTTLE_MS = 30 * 60 * 1000; // 30 min entre alertes stuck

async function findStuckConvs(state) {
  const now = Date.now();
  const stuck = [];
  for (const c of state.conversations || []) {
    if (c.ai_auto === false) continue;
    if (c.escalated_at) continue;
    if (c.needs_human_attention) continue;
    const msgs = c.messages || [];
    if (!msgs.length) continue;
    const last = msgs[msgs.length - 1];
    if (last.direction !== "inbound") continue;
    const ageMin = (now - new Date(last.timestamp).getTime()) / 60000;
    if (ageMin < STUCK_MIN_MINUTES || ageMin > STUCK_MAX_MINUTES) continue;
    stuck.push({
      conv_id: c.id,
      name: c.contact_name || c.phone,
      phone: c.phone,
      age_min: Math.round(ageMin),
      last_content: (last.content || "").slice(0, 80),
    });
  }
  return stuck;
}

async function shouldSendStuckAlert() {
  try {
    const sb = getSupabase();
    const { data } = await sb.from("amigo_data").select("value").eq("key", STUCK_ALERT_KEY).maybeSingle();
    if (!data?.value) return true;
    return Date.now() - new Date(data.value).getTime() > STUCK_THROTTLE_MS;
  } catch { return true; }
}

async function markStuckAlertSent() {
  try {
    const sb = getSupabase();
    await sb.from("amigo_data").upsert({ key: STUCK_ALERT_KEY, value: new Date().toISOString() });
  } catch {}
}

async function sendStuckAlert(stuckList) {
  const phones = (process.env.ALERT_WA_PHONES || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!phones.length) return { skipped: "no_phones_configured" };
  const lines = [
    `🤖 *Bot LABO3D stuck* — ${stuckList.length} conv sans réponse`,
    ``,
    ...stuckList.slice(0, 10).map(s => `• ${s.name} (${s.age_min} min) — "${s.last_content}"`),
    ``,
    `👉 https://amigo-labo3d.vercel.app/#/print3d/chat`,
  ];
  if (stuckList.length > 10) lines.splice(-2, 0, `... +${stuckList.length - 10} autres`);
  const text = lines.join("\n");
  const results = [];
  for (const phone of phones) {
    try {
      const id = await sendMetaMessage({ phone, text });
      results.push({ phone, ok: true, meta_id: id });
    } catch (e) {
      results.push({ phone, ok: false, error: String(e.message || e).slice(0, 200) });
    }
  }
  return { stuck_alert_sent: results };
}

// ─── AUTO-SEND devis propres + NAG devis à risque ───────────────────────────
// Un devis marqué auto=true (scope-clean, ≤R$400) est envoyé au client après
// 8h sans validation humaine, tant que la fenêtre 24h Meta est ouverte → envoi
// gratuit, client encore chaud. Les devis à risque (auto=false) naguent l'admin
// une fois par jour jusqu'à traitement.

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const AUTO_GRACE_MS = 8 * 60 * 60 * 1000; // 8h avant auto-envoi

async function autoSendCleanQuotes(state, base) {
  const now = Date.now();
  let sent = 0, fails = 0, skipped_window = 0;
  for (const c of state.conversations) {
    const pq = c.pending_quote;
    if (!pq || pq.resolved_at) continue;
    if (pq.auto !== true) continue; // devis à risque ou anciens (sans flag) → humain
    const age = now - new Date(pq.ai_generated_at || 0).getTime();
    if (age < AUTO_GRACE_MS) continue;
    const lastInbound = [...(c.messages || [])].reverse().find(m => m.direction === "inbound");
    if (!lastInbound) continue;
    const inAge = now - new Date(lastInbound.timestamp || 0).getTime();
    if (inAge >= 24 * 60 * 60 * 1000) { skipped_window++; continue; } // fenêtre fermée → nag au lieu de payer
    try {
      const metaId = await sendMetaMessage({ phone: c.phone, text: pq.text });
      const nowIso = new Date().toISOString();
      c.messages = c.messages || [];
      c.messages.push({
        id: newId("msg"),
        direction: "outbound",
        type: "text",
        content: pq.text,
        timestamp: nowIso,
        meta_id: metaId,
        sender_email: "auto:scopeclean",
        approval_action: "auto_sent",
        delivery_status: "sent",
      });
      c.last_message_at = nowIso;
      c.unread = false;
      Object.assign(pq, {
        resolved_at: nowIso,
        resolved_by: "auto:scopeclean",
        resolved_action: "approved",
        final_text: pq.text,
      });
      sent++;
    } catch (e) {
      fails++;
      console.error("[auto-send] failed", c.id, e.message);
    }
  }
  if (sent > 0) base.auto_sent = sent;
  if (fails > 0) base.auto_failed = fails;
  if (skipped_window > 0) base.auto_skipped_window = skipped_window;
  return sent + fails > 0;
}

async function nagRiskyQuotes(state, base) {
  const now = Date.now();
  const riskyPend = (state.conversations || []).filter(c => {
    const pq = c.pending_quote;
    return pq && !pq.resolved_at && pq.auto === false &&
      (now - new Date(pq.ai_generated_at || 0).getTime()) > 24 * 60 * 60 * 1000;
  });
  if (!riskyPend.length) return;
  const lastNag = state.nag_risky_at ? now - new Date(state.nag_risky_at).getTime() : Infinity;
  if (lastNag < 24 * 60 * 60 * 1000) { base.risky_nag = "throttled_24h"; return; }

  const lines = riskyPend.slice(0, 5).map(c => {
    const pq = c.pending_quote;
    const dias = Math.floor((now - new Date(pq.ai_generated_at).getTime()) / 864e5);
    const price = (String(pq.text || "").match(/R\$\s*[\d.,]+/g) || ["?"])[0];
    return `• ${c.contact_name || c.phone} — ${price} (${dias}j, risque: ${pq.risk || "scope"})`;
  });
  const text = `⚠️ *${riskyPend.length} devis à risque* attendent TA validation (hors scope auto):\n\n${lines.join("\n")}\n\nOuvre AMIGO → bandeau orange sur chaque conv → valide ✏️ ou rejette 🖐.`;
  for (const phone of getAdminPhones()) {
    try { await sendMetaMessage({ phone, text }); } catch (e) {
      console.error("[risky-nag] failed", phone, e.message);
    }
  }
  state.nag_risky_at = new Date().toISOString();
  base.risky_nag = riskyPend.length;
}

export default async function handler(req, res) {
  const isCheck = req.query?.check === "1";
  const isStuck = req.query?.check === "stuck";
  const isReport = req.query?.report === "daily";
  const canAlertWhenDown = !!req.headers["x-vercel-cron"] || req.query?.alert === "1";

  const base = { ok: true, service: "amigo-crm-api", time: new Date().toISOString() };

  // Mode 1 : ping simple
  if (!isCheck && !isStuck && !isReport) return res.status(200).json(base);

  // Mode 4 : check bot stuck (conv inbound sans réponse bot)
  // Cron cron-job.org : /api/health?check=stuck&alert=1 toutes les 10 min
  //
  // Séquence : detect stuck → retry auto (self-healing) → re-check → alerte si toujours stuck.
  // Le retry rejoue processAiResponses, ce qui a 90%+ de chances de passer si le skip
  // initial était dû à un timeout Anthropic transient (bug prod Jon Ben / Mariana Secretaria).
  // Le fallback D du webhook prend le relais si le retry crash aussi (message client
  // "Um instante..." + push admin), donc pas de silence radio possible.
  if (isStuck) {
    try {
      const state = await loadWaLabo3d();
      const stuckInitial = await findStuckConvs(state);
      base.stuck_count = stuckInitial.length;
      base.stuck = stuckInitial;

      // Self-healing : rejoue l'IA sur chaque conv stuck.
      // Actif seulement quand alert=1 (donc via cron), pas sur un check manuel.
      if (canAlertWhenDown && stuckInitial.length > 0) {
        const retryResults = [];
        for (const s of stuckInitial) {
          try {
            await processAiResponses([s.conv_id]);
            retryResults.push({ conv_id: s.conv_id, name: s.name, retry: "attempted" });
          } catch (e) {
            retryResults.push({ conv_id: s.conv_id, name: s.name, retry: "failed", error: String(e.message || e).slice(0, 150) });
          }
        }
        base.retry_results = retryResults;

        // Re-check post retry : ce qui reste stuck après avoir tenté est le VRAI problème
        const stateAfter = await loadWaLabo3d();
        const stuckAfter = await findStuckConvs(stateAfter);
        base.stuck_after_retry = stuckAfter.length;

        // Alerte seulement si le retry n'a rien débloqué
        if (stuckAfter.length > 0) {
          const canAlert = await shouldSendStuckAlert();
          if (canAlert) {
            const alertRes = await sendStuckAlert(stuckAfter);
            await markStuckAlertSent();
            Object.assign(base, alertRes);
          } else {
            base.alert = "throttled_30m";
          }
        } else {
          base.retry_healed = stuckInitial.length;
        }
      }

      // Auto-envoi devis propres (>8h sans validation humaine, fenêtre 24h ouverte
      // → envoi gratuit, client encore chaud) + nag quotidien des devis à risque.
      // Recharge l'état : processAiResponses ci-dessus a pu le modifier/sauver.
      if (canAlertWhenDown) {
        try {
          const stateAuto = await loadWaLabo3d();
          const changed = await autoSendCleanQuotes(stateAuto, base);
          await nagRiskyQuotes(stateAuto, base);
          if (changed) await saveWaLabo3d(stateAuto);
        } catch (e) {
          console.error("[auto-send] failed:", e.message);
        }
      }

      return res.status(200).json(base);
    } catch (e) {
      return res.status(500).json({ ...base, error: String(e.message || e).slice(0, 300) });
    }
  }

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
