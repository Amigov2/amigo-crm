// Analyse la qualité d'une photo client AVANT de lancer une génération Meshy.
// Objectif : détecter les photos inutilisables (background complexe, cadrage, flou, etc.)
// et demander une meilleure photo au client pour ne pas brûler un crédit Meshy.

const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `Tu es un expert en génération 3D depuis une photo. Tu dois analyser une image fournie par un client et déterminer si elle est utilisable pour générer un modèle 3D via Nano Banana.

**MINDSET : ÊTRE PERMISSIF.** Nano Banana accepte photos réelles, illustrations 2D, rendus 3D, screenshots, mockups AI — tant que le sujet principal est clairement identifiable. On rejette SEULEMENT quand c'est vraiment impossible d'extraire un sujet exploitable. Un doute → on accepte.

**CE QU'ON ACCEPTE (ready_for_3d = true) :**
- Photos d'objets réels (figurines, cake toppers, jouets, décorations)
- Illustrations 2D / dessins / cartoon d'un personnage
- Rendus 3D déjà faits (screenshots de modèles, images générées par IA)
- Photos avec fond légèrement chargé si le sujet reste bien identifiable
- Cadrages 3/4, profil, ou frontal
- Photos moyennement nettes tant qu'on voit clairement le sujet

**CE QU'ON REJETTE (ready_for_3d = false) — SEULEMENT si vraiment inutilisable :**
- Fond ULTRA-chargé où le sujet se noie complètement (ex: paysage panoramique dense sans focus)
- Plusieurs objets principaux mélangés sans qu'un seul se détache
- Image très floue, presque illisible, à tel point qu'on ne peut pas identifier l'objet
- Objet coupé de plus de 50% (on ne voit qu'un fragment)

Retourne UNIQUEMENT un JSON strict :

{
  "ready_for_3d": true | false,
  "confidence": "high" | "medium" | "low",
  "detected_object": "description courte en PT-BR",
  "issues": ["issue1"],
  "issue_labels_ptbr": "phrase user-friendly PT-BR ou ''",
  "main_issue_type": "fundo_complexo" | "objeto_cortado" | "baixa_qualidade" | "multiplos_objetos" | "outro" | null,
  "suggested_message_ptbr": "message court PT-BR si rejet, sinon ''"
}

**suggested_message_ptbr (seulement si ready_for_3d=false) :**
- Toujours commencer par "A foto tá boa, mas..."
- fundo_complexo : suggère remove.bg (grátis, arrasta a foto, baixa sem fundo, me manda)
- objeto_cortado : demande photo complète
- baixa_qualidade : demande photo mais nítida
- multiplos_objetos : demande photo focada em UM objeto
- Tone amigável, max 3 lignes, 1 emoji.

**Rappel** : dans le doute, ready_for_3d = true. Nano Banana est robuste, il gère bien même les inputs moyens.`;

export async function preCheckImageForMeshy({ base64, mimeType }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ready_for_3d: true, skip_reason: "no_api_key" };
  if (!base64) return { ready_for_3d: false, error: "no_image" };

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: base64 } },
          { type: "text", text: "Analise essa foto para geração 3D. Retorne o JSON conforme instruído." },
        ],
      }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`precheck API ${resp.status}: ${data?.error?.message || "unknown"}`);
  const text = data.content?.map(c => c.text || "").join("").trim();

  // Extraire le JSON du texte (Claude peut le wrapper dans markdown)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { ready_for_3d: false, error: "no_json_in_response", raw: text };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return { ...parsed, usage: data.usage };
  } catch (e) {
    return { ready_for_3d: false, error: "invalid_json", raw: text };
  }
}
