// Génération d'un rendu "photo produit" d'une pièce imprimée 3D via Gemini 2.5
// Flash Image (aka Nano Banana). Input : URL image de référence + prompt texte.
// Output : { base64, mimeType, usage }.
//
// On force le rendu à représenter une PIÈCE PHYSIQUE en PLA imprimé, pas une
// illustration digitale. Le prompt-builder amont doit renforcer ce contexte.

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

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

  const parts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p) => p.inline_data?.data);
  if (!imgPart) {
    // Peut arriver si le safety filter refuse — on remonte le texte de refus si dispo
    const textPart = parts.find((p) => p.text);
    throw new Error("no image in response" + (textPart ? `: ${textPart.text.slice(0, 200)}` : ""));
  }

  return {
    base64: imgPart.inline_data.data,
    mimeType: imgPart.inline_data.mime_type || "image/png",
    usage: data.usageMetadata || null,
  };
}
