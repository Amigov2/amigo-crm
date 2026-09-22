// Génération d'un rendu "photo produit" d'une pièce imprimée 3D via Gemini 2.5
// Flash Image (aka Nano Banana). Input : URL image de référence + prompt texte.
// Output : { base64, mimeType, usage }.
//
// On force le rendu à représenter une PIÈCE PHYSIQUE en PLA imprimé, pas une
// illustration digitale. Le prompt-builder amont doit renforcer ce contexte.

// Nano Banana 2 (mai 2026) — Gemini 3.1 Flash Image, Pro-level visual intelligence
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent";

export async function nanoRenderPrintedFigurine({ image_url, prompt }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const imgResp = await fetch(image_url);
  if (!imgResp.ok) throw new Error(`fetch ref image ${imgResp.status}`);
  const buf = Buffer.from(await imgResp.arrayBuffer());
  const b64 = buf.toString("base64");
  const mimeType = imgResp.headers.get("content-type") || "image/jpeg";

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: b64 } },
        ],
      },
    ],
    // CRITIQUE : sans responseModalities=IMAGE, Nano Banana répond en TEXTE
    // ("Here's your photograph...") au lieu de générer l'image binaire.
    // TEXT + IMAGE car le modèle peut avoir besoin de générer une description
    // courte avant l'image (préambule).
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const resp = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Gemini ${resp.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 200)}`);
  }

  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const imgPart = parts.find((p) => p.inline_data?.data || p.inlineData?.data);
  if (!imgPart) {
    const textPart = parts.find((p) => p.text);
    const finish = candidate?.finishReason || "unknown";
    const safety = candidate?.safetyRatings ? JSON.stringify(candidate.safetyRatings).slice(0, 200) : "";
    const details = textPart ? `: ${textPart.text.slice(0, 200)}` : `[finishReason=${finish}${safety ? `, safety=${safety}` : ""}, parts=${parts.length}]`;
    throw new Error(`no image in response${details}`);
  }
  // Support both inline_data (snake_case) et inlineData (camelCase) selon version API
  const inlineData = imgPart.inline_data || imgPart.inlineData;

  return {
    base64: inlineData.data,
    mimeType: inlineData.mime_type || inlineData.mimeType || "image/png",
    usage: data.usageMetadata || null,
  };
}
