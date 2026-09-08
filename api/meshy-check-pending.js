// Cron : vérifie l'état des générations Meshy en cours et push les prévias prêtes
// via WhatsApp au client dès que succeeded.
// Configuré dans vercel.json > crons pour tourner toutes les minutes.

import { loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";
import { meshyGetTask } from "./_lib/meshy.js";
import { sendMetaMessage, sendMetaImageByUrl } from "./_lib/meta-send.js";
import { notifyTeam, notifyHumanEscalation } from "./_lib/notify.js";
import { watermarkImageAndUpload } from "./_lib/watermark.js";
import { pushToAllSubscribers } from "./_lib/push.js";

const PREVIEW_TIMEOUT_MIN = 8; // au-delà → escalade humain automatique

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

export default async function handler(req, res) {
  // Auth optionnelle : si CRON_SECRET défini, exiger le header
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "unauthorized" });
  }

  let state;
  try { state = await loadWaLabo3d(); } catch (e) { return res.status(500).json({ error: e.message }); }

  const pending = (state.conversations || []).filter(c => c.pending_meshy?.task_id && !c.pending_meshy.completed_at);
  console.log("[meshy-check] pending tasks:", pending.length);

  const results = [];
  let dirty = false;
  for (const conv of pending) {
    const task_id = conv.pending_meshy.task_id;
    try {
      const task = await meshyGetTask(task_id);
      console.log("[meshy-check] task", task_id, "status:", task.status, "progress:", task.progress);
      if (task.status === "SUCCEEDED") {
        const rawPreviewUrl = task.thumbnail_url || task.video_url;
        if (!rawPreviewUrl) throw new Error("no preview_url in succeeded task");

        // Watermark + upload sur Supabase pour anti-screenshot pillage
        let watermarkedUrl = rawPreviewUrl;
        try {
          watermarkedUrl = await watermarkImageAndUpload(rawPreviewUrl, conv.id);
          console.log("[meshy-check] watermarked:", watermarkedUrl);
        } catch (wmErr) {
          console.error("[meshy-check] watermark failed, using raw:", wmErr.message);
        }

        // Envoie la prévia au client via WhatsApp
        const now = new Date().toISOString();
        await sendMetaMessage({
          phone: conv.phone,
          text: "Prévia 3D prontinha! Olha só uma ideia de como fica 👇\n\n⚠️ *Importante:* isso é uma prévia rápida gerada por IA pra te dar uma noção geral. O modelo final vai ser refeito na mão pelo Anthony com muito mais detalhe, textura e acabamento — bem melhor que essa prévia!\n\nSe aprovar a direção, é só me falar 'sim' que mando o PIX pra começar a modelagem definitiva.",
        });
        try {
          await sendMetaImageByUrl({
            phone: conv.phone,
            imageUrl: watermarkedUrl,
            caption: "🎨 Prévia IA — LABO 3D",
          });
        } catch (imgErr) {
          console.error("[meshy-check] image send failed:", imgErr.message);
        }
        conv.pending_meshy.completed_at = now;
        conv.pending_meshy.preview_url = watermarkedUrl;
        conv.pending_meshy.raw_meshy_url = rawPreviewUrl;
        conv.pending_meshy.model_glb_url = task.model_urls?.glb || null;
        conv.meshy_preview_count = (conv.meshy_preview_count || 0) + 1;
        conv.status = "aguardando_aprovacao_preview";
        conv.last_message_at = now;
        dirty = true;
        results.push({ conv_id: conv.id, status: "sent", preview_count: conv.meshy_preview_count });
      } else if (task.status === "FAILED") {
        conv.pending_meshy.completed_at = new Date().toISOString();
        conv.pending_meshy.error = task.task_error?.message || "unknown";
        conv.ai_auto = false;
        conv.status = "escalado_humano";
        conv.escalated_at = new Date().toISOString();
        dirty = true;
        try {
          await sendMetaMessage({ phone: conv.phone, text: "Opa, tive um problema técnico gerando a prévia 3D 😅 Vou passar direto pro Anthony que te ajuda pessoalmente em minutos!" });
        } catch {}
        await notifyHumanEscalation({ conv, lastMessage: "🎨 Meshy prévia FAILED — passer en manuel" });
        results.push({ conv_id: conv.id, status: "failed" });
      } else {
        // Vérifie timeout : si Meshy tourne depuis > 8 min sans SUCCEEDED/FAILED → escalade
        const startedAt = conv.pending_meshy?.started_at ? new Date(conv.pending_meshy.started_at).getTime() : 0;
        const ageMin = (Date.now() - startedAt) / 60000;
        if (ageMin > PREVIEW_TIMEOUT_MIN) {
          console.log("[meshy-check] TIMEOUT for", conv.id, "age=", ageMin.toFixed(1), "min");
          conv.pending_meshy.completed_at = new Date().toISOString();
          conv.pending_meshy.timeout = true;
          conv.ai_auto = false;
          conv.status = "escalado_humano";
          conv.escalated_at = new Date().toISOString();
          dirty = true;
          try {
            await sendMetaMessage({ phone: conv.phone, text: "Desculpa a demora! 😅 A prévia tá demorando mais que o normal. Vou chamar o Anthony agora pra te atender pessoalmente e resolver rapidinho!" });
          } catch {}
          await notifyHumanEscalation({ conv, lastMessage: `🎨 Meshy prévia TIMEOUT (${ageMin.toFixed(0)} min) — passer en manuel` });
          try {
            await pushToAllSubscribers({
              title: `🚨 TIMEOUT PRÉVIA — ${conv.contact_name || conv.phone}`,
              body: `Prévia Meshy en cours depuis ${ageMin.toFixed(0)} min — client en attente`,
              url: "/#/print3d/chat",
              badgeCount: (state.conversations || []).filter(c => c.unread).length + 1,
            });
          } catch {}
          results.push({ conv_id: conv.id, status: "timeout_escalated" });
        } else {
          results.push({ conv_id: conv.id, status: task.status, progress: task.progress, age_min: Math.round(ageMin) });
        }
      }
    } catch (e) {
      console.error("[meshy-check] task", task_id, "error:", e.message);
      results.push({ conv_id: conv.id, error: e.message });
    }
  }

  // 2e pass : relances auto (bot ferme la boucle tout seul si silence client)
  const nowMs = Date.now();
  const reminderResults = [];
  for (const conv of state.conversations || []) {
    const r = conv.scheduled_reminder;
    if (!r || r.done) continue;
    if (new Date(r.at).getTime() > nowMs) continue; // pas encore l'heure
    // Skip seulement si conv fermée — les rappels programmés doivent partir même en escalade humaine
    if (conv.status === "perdido" || conv.status === "ganho") { r.done = true; r.skipped_reason = "conv_closed"; dirty = true; continue; }
    try {
      if (r.attempt === 1) {
        await sendMetaMessage({ phone: conv.phone, text: REMINDER_MESSAGES[1] });
        conv.messages.push({
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          direction: "outbound", type: "text", content: REMINDER_MESSAGES[1],
          timestamp: new Date().toISOString(), sender_email: "ai@labo3d",
          delivery_status: "sent", reminder_attempt: 1,
        });
        conv.last_message_at = new Date().toISOString();
        // Planifie attempt 2 dans 3 jours
        conv.scheduled_reminder = { at: nextReminderAt(REMINDER_ATTEMPT2_DAYS), attempt: 2, done: false, created_at: new Date().toISOString(), prev_attempt_sent_at: new Date().toISOString() };
        dirty = true;
        reminderResults.push({ conv_id: conv.id, attempt: 1, next: conv.scheduled_reminder.at });
      } else if (r.attempt === 2) {
        await sendMetaMessage({ phone: conv.phone, text: REMINDER_MESSAGES[2] });
        conv.messages.push({
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          direction: "outbound", type: "text", content: REMINDER_MESSAGES[2],
          timestamp: new Date().toISOString(), sender_email: "ai@labo3d",
          delivery_status: "sent", reminder_attempt: 2,
        });
        conv.last_message_at = new Date().toISOString();
        // Planifie clôture dans 4 jours
        conv.scheduled_reminder = { at: nextReminderAt(REMINDER_CLOSE_DAYS), attempt: "close", done: false, created_at: new Date().toISOString(), prev_attempt_sent_at: new Date().toISOString() };
        dirty = true;
        reminderResults.push({ conv_id: conv.id, attempt: 2, next: conv.scheduled_reminder.at });
      } else if (r.attempt === "close") {
        await sendMetaMessage({ phone: conv.phone, text: REMINDER_MESSAGES.close });
        conv.messages.push({
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          direction: "outbound", type: "text", content: REMINDER_MESSAGES.close,
          timestamp: new Date().toISOString(), sender_email: "ai@labo3d",
          delivery_status: "sent", reminder_attempt: "close",
        });
        conv.last_message_at = new Date().toISOString();
        conv.status = "perdido";
        conv.lost_reason = "sem_resposta_apos_2_relances";
        conv.closed_at = new Date().toISOString();
        conv.ai_auto = false; // désactive bot définitivement
        r.done = true;
        r.closed_at = new Date().toISOString();
        dirty = true;
        reminderResults.push({ conv_id: conv.id, attempt: "close", status: "perdido" });
      }
    } catch (e) {
      console.error("[meshy-check] reminder failed", conv.id, e.message);
      reminderResults.push({ conv_id: conv.id, attempt: r.attempt, error: e.message });
    }
  }

  if (dirty) await saveWaLabo3d(state);
  return res.status(200).json({ processed: pending.length, results, reminders: reminderResults });
}
