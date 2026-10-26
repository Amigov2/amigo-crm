// Upload de médias (photos WhatsApp inbound, prévias Nano, docs, audios) vers
// un bucket Supabase public — les fichiers restent accessibles au frontend
// et au bot après expiration de la fenêtre média Meta (30j).
// Bucket : "meshy-inputs" (nom historique, sert maintenant à tous les médias).

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { downloadMetaMedia } from "./meta-media.js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const BUCKET = "meshy-inputs";

// Taille max au-dessus de laquelle on n'upload PAS sur Supabase storage
// (économise storage gratuit 1 Go). Les gros docs sont référencés par
// media_id Meta uniquement — si projet confirmé, re-télécharger via
// une fonction dédiée dans les 30 jours.
const SKIP_UPLOAD_SIZE_MB = 10;

// Compression WebP pour les images : qualité 80% suffit pour l'usage
// (preview conv + input Meshy), gain ~50% storage vs JPG original.
async function compressToWebp(buffer, mimeType) {
  if (!mimeType || !mimeType.startsWith("image/")) return { buffer, mimeType };
  if (mimeType === "image/webp" || mimeType === "image/gif") return { buffer, mimeType };
  try {
    const compressed = await sharp(buffer)
      .rotate() // auto-orient depuis EXIF
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
    return { buffer: compressed, mimeType: "image/webp" };
  } catch (e) {
    // Si sharp échoue (image corrompue, format exotique), on garde l'original
    console.warn("[supabase-storage] WebP compression failed:", e.message);
    return { buffer, mimeType };
  }
}

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
// { url, mime_type, size, sha256, filename, skipped? }
// Utilisé par le webhook pour recycler image/video/audio/document dès leur
// arrivée, et par le refresh-media pour rattraper les vieux messages.
//
// Perf 2026-10-26: skipBase64:true → on utilise le buffer brut au lieu de
// faire buffer→base64→buffer (économie ~1.3x RAM pour les gros fichiers STL/vidéo).
//
// Storage 2026-10-26:
//   - Images (JPG/PNG) : compressées en WebP qualité 80% (gain ~50%)
//   - Fichiers > 10 Mo (STL, vidéos lourdes) : PAS uploadés sur Supabase
//     storage. On garde media_id Meta + metadata ; si projet confirmé,
//     retelecharger via downloadMetaMedia direct (Meta garde 30j).
export async function downloadAndUploadMedia({ media_id, hint_filename, prefix = "wa" }) {
  const bin = await downloadMetaMedia(media_id, { skipBase64: true });
  const ext = extFromMime(bin.mimeType);
  const safeName = hint_filename ? hint_filename.replace(/[^A-Za-z0-9._-]/g, "_") : `${prefix}-${media_id}.${ext}`;
  const sizeMB = bin.size / (1024 * 1024);

  // Skip upload si le fichier dépasse le seuil (économise storage gratuit).
  // On garde quand même les métadonnées pour que l'UI affiche le filename
  // et un badge "📎 Lourd — téléchargeable à la demande".
  if (sizeMB > SKIP_UPLOAD_SIZE_MB) {
    console.log(`[supabase-storage] skip upload ${safeName} (${sizeMB.toFixed(1)} Mo > ${SKIP_UPLOAD_SIZE_MB} Mo)`);
    return {
      url: null,
      mime_type: bin.mimeType,
      size: bin.size,
      sha256: bin.sha256 || null,
      filename: safeName,
      skipped: true,
      skip_reason: `heavy (${sizeMB.toFixed(1)} Mo)`,
    };
  }

  // Compression WebP pour les images (gain storage ~50%)
  const { buffer: finalBuffer, mimeType: finalMime } = await compressToWebp(bin.buffer, bin.mimeType);
  const finalExt = finalMime === "image/webp" && !safeName.endsWith(".webp")
    ? safeName.replace(/\.(jpg|jpeg|png)$/i, ".webp")
    : safeName;

  const url = await uploadImageForMeshy({ buffer: finalBuffer, filename: finalExt, mimeType: finalMime });
  return {
    url,
    mime_type: finalMime,
    size: finalBuffer.length,
    sha256: bin.sha256 || null,
    filename: finalExt,
  };
}

// Setup une seule fois via SQL dans Supabase dashboard :
// INSERT INTO storage.buckets (id, name, public) VALUES ('meshy-inputs', 'meshy-inputs', true);
// CREATE POLICY "public read" ON storage.objects FOR SELECT USING (bucket_id = 'meshy-inputs');
// CREATE POLICY "authenticated insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'meshy-inputs');
