// Transcrit un audio WhatsApp (mp3/m4a/ogg/opus/aac/amr) en texte via Gemini
// 2.5 Flash. Le modèle Gemini accepte l'audio en input direct via inline_data.
//
// Doc : https://ai.google.dev/gemini-api/docs/audio

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Instruction courte : on veut juste la transcription, sans commentaire ni
// ponctuation IA générée. La langue du bot LABO 3D est PT-BR.
const PROMPT = "Transcreva o áudio abaixo em texto simples, sem comentários, sem sinais adicionais, mantendo o idioma original do falante. Retorne apenas o texto do que foi dito.";

export async function transcribeAudioViaGemini({ audio_url, mime_type }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const audioResp = await fetch(audio_url);
  if (!audioResp.ok) throw new Error(`fetch audio ${audioResp.status}`);
  const buf = Buffer.from(await audioResp.arrayBuffer());
  const b64 = buf.toString("base64");
  const mt = mime_type || audioResp.headers.get("content-type") || "audio/ogg";

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mt, data: b64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  };

  const resp = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Gemini transcribe ${resp.status}: ${data?.error?.message || "?"}`);
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("no transcription in response");
  return { transcription: text, usage: data.usageMetadata || null };
}
