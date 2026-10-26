// Download un media (image/audio/document) reçu via WhatsApp Cloud API
// Two-step Meta flow : GET /{media_id} → renvoie une URL signée temporaire → GET cette URL → binary
//
// Perf: les gros fichiers (>50 Mo) explosaient la mémoire en passant par
// base64 (×1.33 de taille). On skip base64 par défaut pour l'upload Supabase
// qui n'en a pas besoin, et on le calcule à la demande pour l'IA/preview.

const META_GRAPH_VERSION = "v20.0";

export async function downloadMetaMedia(mediaId, options = {}) {
  // Backward compat : si options est une string, c'est l'ancien accessToken
  const accessToken = typeof options === "string" ? options : options.accessToken;
  // Par défaut on génère base64 (compat ancienne API) ; les callers "lourds"
  // (webhook download+upload) peuvent passer skipBase64: true pour économiser.
  const skipBase64 = typeof options === "object" ? !!options.skipBase64 : false;
  const token = accessToken || process.env.META_WA_ACCESS_TOKEN;
  if (!mediaId) throw new Error("mediaId required");
  if (!token) throw new Error("META_WA_ACCESS_TOKEN missing");

  // Step 1: get temporary URL
  const infoResp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const info = await infoResp.json();
  if (!infoResp.ok || !info.url) throw new Error(`Meta media info failed: ${info?.error?.message || infoResp.status}`);

  // Step 2: fetch the actual binary
  const binResp = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!binResp.ok) throw new Error(`Meta media fetch failed: ${binResp.status}`);
  const buf = Buffer.from(await binResp.arrayBuffer());

  return {
    buffer: buf,
    base64: skipBase64 ? null : buf.toString("base64"),
    mimeType: info.mime_type || "image/jpeg",
    size: buf.length,
    sha256: info.sha256,
  };
}
