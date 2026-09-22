// Cron LABO 3D : gère les relances auto J+3 puis clôture J+4 quand le client
// reste silencieux après un devis. Configuré dans le dashboard Vercel pour
// tourner toutes les minutes (chemin historique conservé).
//
// Avant : cette route pollait aussi les tasks Meshy pour envoyer les prévias
// dès leur SUCCEEDED. Depuis le passage à Nano Banana (14/09/2026) la
// génération est synchrone dans l'endpoint /api/labo3d-generate-preview, donc
// plus rien à poller ici — on garde uniquement la logique de reminders.

import { loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";
import { sendMetaMessage, sendMetaImageByUrl } from "./_lib/meta-send.js";
import { nanoRenderPrintedFigurine } from "./_lib/nano-render.js";
import { uploadImageForMeshy } from "./_lib/supabase-storage.js";
import { watermarkImageAndUpload } from "./_lib/watermark.js";

export const config = { maxDuration: 60 };

// Délais des relances auto (bot ferme la boucle tout seul si silence)
const REMINDER_ATTEMPT2_DAYS = 3;   // 2e relance J+3 si silence
const REMINDER_CLOSE_DAYS = 4;      // clôture J+4 après attempt 2 si silence
// 9h Rio (America/Sao_Paulo) = 12h UTC (pas de DST au BR)
const REMINDER_HOUR_UTC = 12;

function nextReminderAt(daysFromNow) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(REMINDER_HOUR_UTC, 0, 0, 0);
  return d.toISOString();
}

const REMINDER_MESSAGES = {
  1: "Oi! 😊 Passando pra confirmar aquele PIX que a gente combinou pra hoje. Continua tudo certo pra fechar sua peça?",
  2: "Oi! Só passando por aqui pra saber se ainda quer avançar com a peça 🎨 Sem stress se mudou de ideia, é só me avisar!",
  close: "Beleza! Vou pausar seu orçamento por aqui pra não te encher 😄 Quando quiser retomar é só me chamar, tá tudo salvo aqui! 🙌",
};

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default async function handler(req, res) {
  // Auth optionnelle : si CRON_SECRET défini, exiger le header
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "unauthorized" });
  }

  let state;
  try { state = await loadWaLabo3d(); } catch (e) { return res.status(500).json({ error: e.message }); }

  const nowMs = Date.now();
  const reminderResults = [];
  const nanoResults = [];
  let dirty = false;

  // ═══ NANO PREVIEW QUEUE PROCESSING ═══
  // Kill switch d'urgence pour couper toute génération nano (via env var)
  if (process.env.NANO_KILLSWITCH === "1") {
    console.warn("[nano-cron] KILLSWITCH active — skipping all nano processing");
    return res.status(200).json({ nano: [{ skipped: "killswitch" }], reminders: reminderResults, window_reminders: windowResults, stuck_previews: stuckPreviewResults });
  }

  // Debug: log all pending_meshy statuses to understand what cron sees
  const pmStates = (state.conversations || [])
    .filter(c => c.pending_meshy)
    .map(c => `${c.id.slice(-6)}:${c.pending_meshy.status || "none"}:${c.pending_meshy.completed_at ? "completed" : "active"}`);
  if (pmStates.length > 0) {
    console.log("[nano-cron] scan", state.conversations.length, "convs, pending_meshy:", pmStates.join(", "));
  }

  // Anti-spam : max 1 prévia par conv toutes les 10 min (évite backlog debug)
  const PREVIEW_COOLDOWN_MS = 10 * 60 * 1000;
  for (const conv of state.conversations || []) {
    const pm = conv.pending_meshy;
    if (!pm || pm.status !== "queued") continue;
    if (pm.completed_at) continue;

    // Anti-spam : si conv a reçu une prévia il y a < 10 min, skip (marque comme cancelled)
    const lastPreviewMsg = [...(conv.messages || [])].reverse().find(m => m.is_preview);
    if (lastPreviewMsg) {
      const lastPreviewAge = nowMs - new Date(lastPreviewMsg.timestamp).getTime();
      if (lastPreviewAge < PREVIEW_COOLDOWN_MS) {
        pm.status = "cancelled";
        pm.completed_at = new Date().toISOString();
        pm.cancel_reason = `preview_sent_${Math.round(lastPreviewAge / 60000)}min_ago`;
        dirty = true;
        console.log("[nano-cron] SKIP conv=", conv.id, "reason=cooldown, last preview", Math.round(lastPreviewAge / 60000), "min ago");
        continue;
      }
    }

    console.log("[nano-cron] START conv=", conv.id, "prompt_len=", pm.prompt?.length);
    const t0 = Date.now();
    pm.status = "running";
    pm.run_started_at = new Date().toISOString();

    try {
      const out = await nanoRenderPrintedFigurine({ image_url: pm.input_url, prompt: pm.prompt });
      console.log("[nano-cron] nano done in", Date.now() - t0, "ms, out size=", out.base64?.length);

      const rawBuf = Buffer.from(out.base64, "base64");
      const rawUrl = await uploadImageForMeshy({
        buffer: rawBuf, filename: `nano-${conv.id}-${Date.now()}.png`, mimeType: out.mimeType,
      });

      let watermarkedUrl = rawUrl;
      try {
        watermarkedUrl = await watermarkImageAndUpload(rawUrl, conv.id);
      } catch (wmErr) {
        console.error("[nano-cron] watermark failed, using raw:", wmErr.message);
      }

      const previewText = "Prévia da sua peça prontinha! Olha só como ela deve ficar depois de impressa 👇\n\n⚠️ *Importante:* isso é uma prévia gerada por IA pra te dar uma noção. O modelo final vai ser refeito na mão pelo Anthony com mais detalhe e acabamento — bem melhor que essa prévia!\n\nSe aprovar a direção, é só me falar 'sim' que mando o PIX pra começar a modelagem definitiva.";
      const textMetaId = await sendMetaMessage({ phone: pm.phone, text: previewText });
      const previewNowIso = new Date().toISOString();
      conv.messages = conv.messages || [];
      conv.messages.push({
        id: newId("msg"), direction: "outbound", type: "text", content: previewText,
        timestamp: previewNowIso, meta_id: textMetaId, sender_email: "ai@labo3d.preview",
        delivery_status: "sent",
      });
      let imgMetaId = null;
      try {
        imgMetaId = await sendMetaImageByUrl({ phone: pm.phone, imageUrl: watermarkedUrl, caption: "🎨 Prévia IA — LABO 3D" });
        conv.messages.push({
          id: newId("msg"), direction: "outbound", type: "image",
          content: "🎨 Prévia IA — LABO 3D",
          media_url: watermarkedUrl,
          timestamp: new Date().toISOString(), meta_id: imgMetaId, sender_email: "ai@labo3d.preview",
          delivery_status: "sent", is_preview: true,
        });
      } catch (imgErr) {
        console.error("[nano-cron] image send failed:", imgErr.message);
      }

      pm.status = "completed";
      pm.completed_at = new Date().toISOString();
      pm.preview_url = watermarkedUrl;
      pm.raw_output_url = rawUrl;
      conv.meshy_preview_count = (conv.meshy_preview_count || 0) + 1;
      conv.status = "aguardando_aprovacao_preview";
      conv.last_message_at = new Date().toISOString();
      dirty = true;
      nanoResults.push({ conv_id: conv.id, ok: true, elapsed_ms: Date.now() - t0 });
      console.log("[nano-cron] sent conv=", conv.id, "count=", conv.meshy_preview_count);
    } catch (e) {
      console.error("[nano-cron] failed conv=", conv.id, "err=", e.message);
      pm.status = "failed";
      pm.completed_at = new Date().toISOString();
      pm.error = e.message;
      pm.elapsed_ms = Date.now() - t0;
      conv.ai_auto = false;
      conv.status = "escalado_humano";
      conv.escalated_at = new Date().toISOString();
      dirty = true;
      try {
        const isAnthonyDebug = String(pm.phone).replace(/\D/g, "") === "33688852587";
        const clientText = isAnthonyDebug
          ? `🔧 DEBUG NANO FAIL (cron)\n\nErreur: ${(e.message || "").slice(0, 500)}\n\nElapsed: ${Date.now() - t0}ms`
          : "Opa, tive um problema técnico gerando a prévia 😅 Vou passar direto pro Anthony que te ajuda pessoalmente em minutos!";
        await sendMetaMessage({ phone: pm.phone, text: clientText });
      } catch {}
      nanoResults.push({ conv_id: conv.id, ok: false, error: e.message, elapsed_ms: Date.now() - t0 });
    }
    break; // 1 job par tick — le suivant sera pris au prochain cron
  }

  for (const conv of state.conversations || []) {
    const r = conv.scheduled_reminder;
    if (!r || r.done) continue;
    if (new Date(r.at).getTime() > nowMs) continue; // pas encore l'heure
    // Skip seulement si conv fermée — les rappels programmés doivent partir même en escalade humaine
    if (conv.status === "perdido" || conv.status === "ganho") {
      r.done = true;
      r.skipped_reason = "conv_closed";
      dirty = true;
      continue;
    }
    try {
      if (r.attempt === 1) {
        await sendMetaMessage({ phone: conv.phone, text: REMINDER_MESSAGES[1] });
        conv.messages.push({
          id: newId("msg"),
          direction: "outbound", type: "text", content: REMINDER_MESSAGES[1],
          timestamp: new Date().toISOString(), sender_email: "ai@labo3d",
          delivery_status: "sent", reminder_attempt: 1,
        });
        conv.last_message_at = new Date().toISOString();
        conv.scheduled_reminder = { at: nextReminderAt(REMINDER_ATTEMPT2_DAYS), attempt: 2, done: false, created_at: new Date().toISOString(), prev_attempt_sent_at: new Date().toISOString() };
        dirty = true;
        reminderResults.push({ conv_id: conv.id, attempt: 1, next: conv.scheduled_reminder.at });
      } else if (r.attempt === 2) {
        await sendMetaMessage({ phone: conv.phone, text: REMINDER_MESSAGES[2] });
        conv.messages.push({
          id: newId("msg"),
          direction: "outbound", type: "text", content: REMINDER_MESSAGES[2],
          timestamp: new Date().toISOString(), sender_email: "ai@labo3d",
          delivery_status: "sent", reminder_attempt: 2,
        });
        conv.last_message_at = new Date().toISOString();
        conv.scheduled_reminder = { at: nextReminderAt(REMINDER_CLOSE_DAYS), attempt: "close", done: false, created_at: new Date().toISOString(), prev_attempt_sent_at: new Date().toISOString() };
        dirty = true;
        reminderResults.push({ conv_id: conv.id, attempt: 2, next: conv.scheduled_reminder.at });
      } else if (r.attempt === "close") {
        await sendMetaMessage({ phone: conv.phone, text: REMINDER_MESSAGES.close });
        conv.messages.push({
          id: newId("msg"),
          direction: "outbound", type: "text", content: REMINDER_MESSAGES.close,
          timestamp: new Date().toISOString(), sender_email: "ai@labo3d",
          delivery_status: "sent", reminder_attempt: "close",
        });
        conv.last_message_at = new Date().toISOString();
        conv.status = "perdido";
        conv.lost_reason = "sem_resposta_apos_2_relances";
        conv.closed_at = new Date().toISOString();
        conv.ai_auto = false;
        r.done = true;
        r.closed_at = new Date().toISOString();
        dirty = true;
        reminderResults.push({ conv_id: conv.id, attempt: "close", status: "perdido" });
      }
    } catch (e) {
      console.error("[labo3d-reminders] reminder failed", conv.id, e.message);
      reminderResults.push({ conv_id: conv.id, attempt: r.attempt, error: e.message });
    }
  }

  // ═══ Watchdog prévia bloquée — nano peut planter silencieusement ═══
  // Si une prévia est en cours depuis > 5 min sans résultat, on escalade automatiquement.
  const STUCK_PREVIEW_MS = 5 * 60 * 1000;
  const stuckPreviewResults = [];
  for (const conv of state.conversations || []) {
    const pm = conv.pending_meshy;
    if (!pm || pm.completed_at) continue;
    if (!pm.started_at) continue;
    const age = nowMs - new Date(pm.started_at).getTime();
    if (age < STUCK_PREVIEW_MS) continue;
    // Escalade auto
    try {
      await sendMetaMessage({
        phone: conv.phone,
        text: "Oi! 😅 A prévia demorou mais que o esperado por um problema técnico. Vou passar direto pro Anthony que te ajuda pessoalmente. Ele volta em breve!",
      });
      conv.pending_meshy = { ...pm, completed_at: new Date().toISOString(), error: "watchdog_timeout_5min", backend: "nano" };
      conv.ai_auto = false;
      conv.status = "escalado_humano";
      conv.escalated_at = new Date().toISOString();
      dirty = true;
      stuckPreviewResults.push({ conv_id: conv.id, phone: conv.phone, age_min: (age / 60000).toFixed(1) });
      console.log("[labo3d-watchdog] stuck preview escalated", conv.id, "age", age / 60000, "min");
    } catch (e) {
      console.error("[labo3d-watchdog] escalation send failed", conv.id, e.message);
    }
  }

  // ═══ Relance "avant 24h" — profite de la fenêtre Meta ouverte ═══
  // Cible : conv avec dernier msg = outbound ET dernier inbound entre 21h et 23h30.
  // But : dernière chance de rappel avant que Meta ferme la fenêtre (24h) et
  // qu'on soit obligé de passer par un template payant.
  const MS_H = 3600 * 1000;
  const WINDOW_MIN_MS = 21 * MS_H;
  const WINDOW_MAX_MS = 23.5 * MS_H;
  const MIN_OUTBOUND_AGE_MS = 6 * MS_H; // laisse au moins 6h après notre dernier envoi
  const WINDOW_REMINDER_TEXT = "Ei! 👋 Ainda tá por aí? Se quiser retomar seu projeto 3D, é só responder por aqui — tô aqui pra ajudar! 🎨";
  const windowResults = [];

  for (const conv of state.conversations || []) {
    if (conv.status === "perdido" || conv.status === "ganho") continue;
    if (conv.ai_auto === false) continue; // escalade humaine, humain gère
    if (conv.pending_quote && !conv.pending_quote.resolved_at) continue; // devis en attente d'approbation
    const msgs = conv.messages || [];
    if (!msgs.length) continue;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg.direction !== "outbound") continue; // client a le dernier mot, on n'est pas en attente
    const lastMsgAgeMs = nowMs - new Date(lastMsg.timestamp).getTime();
    if (lastMsgAgeMs < MIN_OUTBOUND_AGE_MS) continue; // trop tôt pour relancer

    let lastIn = null;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].direction === "inbound") { lastIn = msgs[i]; break; }
    }
    if (!lastIn) continue;
    const inboundAgeMs = nowMs - new Date(lastIn.timestamp).getTime();
    if (inboundAgeMs < WINDOW_MIN_MS || inboundAgeMs > WINDOW_MAX_MS) continue;

    // Anti-spam : déjà relancé pour ce dernier inbound
    if (conv.wa_window_reminder_for_inbound === lastIn.timestamp) continue;

    try {
      const metaId = await sendMetaMessage({ phone: conv.phone, text: WINDOW_REMINDER_TEXT });
      const nowIso = new Date().toISOString();
      conv.messages.push({
        id: newId("msg"),
        direction: "outbound", type: "text", content: WINDOW_REMINDER_TEXT,
        timestamp: nowIso, meta_id: metaId, sender_email: "ai@labo3d.window",
        delivery_status: "sent", window_reminder: true,
      });
      conv.last_message_at = nowIso;
      conv.wa_window_reminder_for_inbound = lastIn.timestamp;
      conv.wa_window_reminder_sent_at = nowIso;
      dirty = true;
      windowResults.push({ conv_id: conv.id, phone: conv.phone, inbound_age_h: (inboundAgeMs / MS_H).toFixed(1) });
      console.log("[labo3d-window] reminder sent to", conv.phone, "inbound age", (inboundAgeMs / MS_H).toFixed(1), "h");
    } catch (e) {
      console.error("[labo3d-window] send failed", conv.id, e.message);
      windowResults.push({ conv_id: conv.id, error: e.message });
    }
  }

  if (dirty) await saveWaLabo3d(state);
  return res.status(200).json({ reminders: reminderResults, window_reminders: windowResults, stuck_previews: stuckPreviewResults, nano: nanoResults });
}
