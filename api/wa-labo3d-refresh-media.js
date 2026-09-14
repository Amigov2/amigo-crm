// Endpoint : rescan toutes les conversations, télécharge depuis Meta tous les
// médias inbound (image, video, audio, document, sticker) dont media_url est
// manquant, upload sur Supabase Storage et complète le message.
//
// Meta ne garde les medias que ~30 jours. Après ça le download échoue silencieusement.
//
// Usage : POST /api/wa-labo3d-refresh-media  (auth JWT Supabase)
// Réponse : { total, scanned, recovered, expired, errors }

import { getSupabase, loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";
import { downloadAndUploadMedia } from "./_lib/supabase-storage.js";
import { transcribeAudioViaGemini } from "./_lib/audio-transcribe.js";

const RECOVERABLE_TYPES = new Set(["image", "video", "audio", "document", "sticker"]);

async function verifyUser(req) {
  const auth = req.headers.authorization || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!jwt) return null;
  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.getUser(jwt);
    if (error || !data?.user?.email) return null;
    return data.user.email;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  const userEmail = await verifyUser(req);
  if (!userEmail) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const state = await loadWaLabo3d();
  let scanned = 0;
  let recovered = 0;
  let expired = 0;
  let transcribed = 0;
  const errors = [];

  for (const conv of state.conversations || []) {
    for (const msg of conv.messages || []) {
      if (msg.direction !== "inbound") continue;
      if (!RECOVERABLE_TYPES.has(msg.type)) continue;

      // 1) Download+upload si media_url manquant
      if (!msg.media_url && msg.media_id) {
        scanned++;
        try {
          const dl = await downloadAndUploadMedia({
            media_id: msg.media_id,
            hint_filename: msg.doc_filename || null,
            prefix: `wa-refresh-${msg.type}`,
          });
          msg.media_url = dl.url;
          msg.mime_type = msg.mime_type || dl.mime_type;
          msg.size = msg.size || dl.size;
          recovered++;
        } catch (e) {
          const msgErr = String(e?.message || e);
          if (/not found|expired|invalid/i.test(msgErr)) {
            expired++;
          } else {
            errors.push({ conv_id: conv.id, msg_id: msg.id, error: msgErr.slice(0, 200) });
          }
          continue;
        }
      }

      // 2) Transcrit les audios qui n'ont pas encore de transcription
      if (msg.type === "audio" && msg.media_url && !msg.transcription) {
        try {
          const tr = await transcribeAudioViaGemini({ audio_url: msg.media_url, mime_type: msg.mime_type });
          msg.transcription = tr.transcription;
          transcribed++;
        } catch (e) {
          errors.push({ conv_id: conv.id, msg_id: msg.id, error: `transcribe: ${String(e?.message || e).slice(0, 180)}` });
        }
      }
    }
  }

  if (recovered > 0 || transcribed > 0) await saveWaLabo3d(state);

  return res.status(200).json({
    ok: true,
    total_conversations: state.conversations?.length || 0,
    scanned,
    recovered,
    expired,
    transcribed,
    errors_count: errors.length,
    errors: errors.slice(0, 10),
    triggered_by: userEmail,
  });
}
