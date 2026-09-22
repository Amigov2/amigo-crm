// Ajoute un watermark visible sur une prévia Meshy avant envoi au client.
// Décourage le screenshot-and-print par les concurrents.

import sharp from "sharp";
import { uploadImageForMeshy } from "./supabase-storage.js";

const SVG_WATERMARK = (w, h) => {
  // Tuile "LABO 3D" répétée dense (style Getty Images) — couvre toute l'image
  // en diagonale, impossible à cropper ou retoucher sans détruire l'image.
  const tileFont = Math.max(20, Math.round(w * 0.065));
  const tileStep = Math.max(80, Math.round(w * 0.22)); // plus dense qu'avant
  const diag = Math.ceil(Math.sqrt(w * w + h * h));
  const rows = Math.ceil(diag / tileStep) + 2;
  const cols = Math.ceil(diag / tileStep) + 2;
  let tiles = "";
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const x = c * tileStep - diag / 2 + (r % 2 === 0 ? 0 : tileStep / 2);
      const y = r * tileStep - diag / 2;
      tiles += `<text x="${x}" y="${y}" fill="rgba(255,255,255,0.55)" stroke="rgba(0,0,0,0.7)" stroke-width="1.5" paint-order="stroke fill" font-family="DejaVu Sans,Liberation Sans,sans-serif" font-size="${tileFont}" font-weight="900" letter-spacing="3">LABO 3D</text>`;
    }
  }

  // Central massif : "LABO 3D" (marque, protection) + "PRÉVIA · NÃO IMPRIMIR"
  const brandFont = Math.round(w * 0.28);
  const subFont = Math.round(w * 0.075);
  const bottomBar = Math.max(60, Math.round(h * 0.12));
  const bottomFont = Math.max(16, Math.round(w * 0.038));

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${w/2} ${h/2}) rotate(-28)">
    ${tiles}
  </g>
  <g transform="translate(${w/2} ${h/2}) rotate(-28)">
    <text x="0" y="${-brandFont*0.15}" text-anchor="middle" fill="rgba(220,38,38,0.95)" stroke="rgba(255,255,255,1)" stroke-width="8" paint-order="stroke fill" font-family="DejaVu Sans,Liberation Sans,sans-serif" font-size="${brandFont}" font-weight="900" letter-spacing="4">LABO 3D</text>
    <text x="0" y="${brandFont*0.8}" text-anchor="middle" fill="rgba(220,38,38,0.95)" stroke="rgba(255,255,255,1)" stroke-width="5" paint-order="stroke fill" font-family="DejaVu Sans,Liberation Sans,sans-serif" font-size="${subFont}" font-weight="900" letter-spacing="2">PRÉVIA · NÃO IMPRIMIR</text>
  </g>
  <rect x="0" y="${h - bottomBar}" width="${w}" height="${bottomBar}" fill="rgba(0,0,0,0.95)"/>
  <text x="${w/2}" y="${h - bottomBar/2 + bottomFont/3}" text-anchor="middle" fill="white" font-family="DejaVu Sans,sans-serif" font-size="${bottomFont}" font-weight="700">© LABO 3D · Prévia IA · labo3d.com.br · Não autorizado a imprimir</text>
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
