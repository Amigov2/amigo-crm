// Endpoint : rescan toutes les conversations, télécharge depuis Meta les images/videos
// dont media_url est manquant (crashs webhook antérieurs), upload sur Supabase Storage.
//
// Meta ne garde les medias que ~30 jours. Après ça le download échoue silencieusement.
//
// Usage : POST /api/wa-labo3d-refresh-media  (auth JWT Supabase)
// Réponse : { total, scanned, recovered, expired, errors }

import { getSupabase, loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";
import { downloadMetaMedia } from "./_lib/meta-media.js";
import { uploadImageForMeshy } from "./_lib/supabase-storage.js";

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
  const errors = [];

  for (const conv of state.conversations || []) {
    for (const msg of conv.messages || []) {
      if (msg.direction !== "inbound") continue;
      if (msg.type !== "image" && msg.type !== "video") continue;
      if (msg.media_url) continue;             // déjà OK
      if (!msg.media_id) continue;             // pas de handle Meta
      scanned++;

      try {
        const media = await downloadMetaMedia(msg.media_id);
        const buf = Buffer.from(media.base64, "base64");
        const filename = `wa-refresh-${msg.media_id}.${msg.type === "video" ? "mp4" : "jpg"}`;
        const publicUrl = await uploadImageForMeshy({
          buffer: buf,
          filename,
          mimeType: media.mimeType,
        });
        msg.media_url = publicUrl;
        recovered++;
      } catch (e) {
        const msgErr = String(e?.message || e);
        // Meta renvoie souvent "Media not found" ou "invalid media_id" après 30j
        if (/not found|expired|invalid/i.test(msgErr)) {
          expired++;
        } else {
          errors.push({ conv_id: conv.id, msg_id: msg.id, error: msgErr.slice(0, 200) });
        }
      }
    }
  }

  if (recovered > 0) await saveWaLabo3d(state);

  return res.status(200).json({
    ok: true,
    total_conversations: state.conversations?.length || 0,
    scanned,
    recovered,
    expired,
    errors_count: errors.length,
    errors: errors.slice(0, 10),
    triggered_by: userEmail,
  });
}
