// Ajoute un watermark visible sur une prévia Meshy avant envoi au client.
// Décourage le screenshot-and-print par les concurrents.

import sharp from "sharp";
import { uploadImageForMeshy } from "./supabase-storage.js";

const SVG_WATERMARK = (w, h) => {
  const bigFont = Math.round(w * 0.22);
  const smallFont = Math.round(w * 0.085);
  const bottomBar = Math.max(60, Math.round(h * 0.11));
  const bottomFont = Math.max(16, Math.round(w * 0.038));
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${w/2} ${h/2}) rotate(-28)">
    <text x="0" y="0" text-anchor="middle" fill="rgba(220,38,38,0.85)" stroke="rgba(255,255,255,0.95)" stroke-width="6" paint-order="stroke fill" font-family="Arial Black,Arial,sans-serif" font-size="${bigFont}" font-weight="900">PRÉVIA</text>
    <text x="0" y="${bigFont*0.85}" text-anchor="middle" fill="rgba(220,38,38,0.85)" stroke="rgba(255,255,255,0.95)" stroke-width="4" paint-order="stroke fill" font-family="Arial Black,Arial,sans-serif" font-size="${smallFont}" font-weight="900">LABO 3D · IA</text>
  </g>
  <rect x="0" y="${h - bottomBar}" width="${w}" height="${bottomBar}" fill="rgba(0,0,0,0.9)"/>
  <text x="${w/2}" y="${h - bottomBar/2 + bottomFont/3}" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="${bottomFont}" font-weight="700">Prévia IA · Não pronto para impressão · labo3d.com.br</text>
</svg>`;
};

export async function watermarkImageAndUpload(imageUrl, conv_id) {
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`fetch preview ${resp.status}`);
  const inputBuf = Buffer.from(await resp.arrayBuffer());

  // Récupère les dimensions pour bien caler le SVG
  const meta = await sharp(inputBuf).metadata();
  const w = meta.width || 512, h = meta.height || 512;

  const outBuf = await sharp(inputBuf)
    .composite([{ input: Buffer.from(SVG_WATERMARK(w, h)) }])
    .jpeg({ quality: 82 })
    .toBuffer();

  return await uploadImageForMeshy({
    buffer: outBuf,
    filename: `preview-${conv_id}-${Date.now()}.jpg`,
    mimeType: "image/jpeg",
  });
}
