// Upload de médias (photos WhatsApp inbound, prévias Nano, docs, audios) vers
// un bucket Supabase public — les fichiers restent accessibles au frontend
// et au bot après expiration de la fenêtre média Meta (30j).
// Bucket : "meshy-inputs" (nom historique, sert maintenant à tous les médias).

import { createClient } from "@supabase/supabase-js";
import { downloadMetaMedia } from "./meta-media.js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const BUCKET = "meshy-inputs";

// Renvoie une extension raisonnable à partir du MIME type (fallback bin).
function extFromMime(mimeType) {
  if (!mimeType) return "bin";
  const m = mimeType.split(";")[0].trim().toLowerCase();
  const map = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/3gpp": "3gp", "video/webm": "webm",
    "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg", "audio/webm": "webm",
    "audio/amr": "amr", "audio/ogg; codecs=opus": "ogg",
    "application/pdf": "pdf", "application/zip": "zip",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
  };
  return map[m] || m.split("/")[1] || "bin";
}

export async function uploadImageForMeshy({ buffer, filename, mimeType = "image/jpeg" }) {
  const path = `${Date.now()}-${filename || "input.jpg"}`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(`Supabase upload: ${error.message}`);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return pub.publicUrl;
}

// Télécharge un media Meta puis l'upload direct sur Supabase Storage.
// { url, mime_type, size, sha256, filename }
// Utilisé par le webhook pour recycler image/video/audio/document dès leur
// arrivée, et par le refresh-media pour rattraper les vieux messages.
export async function downloadAndUploadMedia({ media_id, hint_filename, prefix = "wa" }) {
  const bin = await downloadMetaMedia(media_id);
  const buf = Buffer.from(bin.base64, "base64");
  const ext = extFromMime(bin.mimeType);
  const safeName = hint_filename ? hint_filename.replace(/[^A-Za-z0-9._-]/g, "_") : `${prefix}-${media_id}.${ext}`;
  const url = await uploadImageForMeshy({ buffer: buf, filename: safeName, mimeType: bin.mimeType });
  return {
    url,
    mime_type: bin.mimeType,
    size: bin.size,
    sha256: bin.sha256 || null,
    filename: safeName,
  };
}

// Setup une seule fois via SQL dans Supabase dashboard :
// INSERT INTO storage.buckets (id, name, public) VALUES ('meshy-inputs', 'meshy-inputs', true);
// CREATE POLICY "public read" ON storage.objects FOR SELECT USING (bucket_id = 'meshy-inputs');
// CREATE POLICY "authenticated insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'meshy-inputs');
