// Cron LABO 3D : gère les relances auto J+3 puis clôture J+4 quand le client
// reste silencieux après un devis. Configuré dans le dashboard Vercel pour
// tourner toutes les minutes (chemin historique conservé).
//
// Avant : cette route pollait aussi les tasks Meshy pour envoyer les prévias
// dès leur SUCCEEDED. Depuis le passage à Nano Banana (14/09/2026) la
// génération est synchrone dans l'endpoint /api/labo3d-generate-preview, donc
// plus rien à poller ici — on garde uniquement la logique de reminders.

import { loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";
import { sendMetaMessage } from "./_lib/meta-send.js";

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
  let dirty = false;

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

  if (dirty) await saveWaLabo3d(state);
  return res.status(200).json({ reminders: reminderResults });
}
