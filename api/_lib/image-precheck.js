// Analyse la qualité d'une photo client AVANT de lancer une génération Meshy.
// Objectif : détecter les photos inutilisables (background complexe, cadrage, flou, etc.)
// et demander une meilleure photo au client pour ne pas brûler un crédit Meshy.

const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `Tu es un expert en génération 3D depuis une photo. Tu dois analyser une image fournie par un client et déterminer si elle est utilisable pour générer un modèle 3D de qualité via une IA (Meshy).

CRITÈRES DE QUALITÉ pour un bon rendu 3D :
1. **Objet isolé** — un seul sujet principal, pas de scène avec plusieurs éléments
2. **Background uni** — blanc, gris, transparent ou couleur unie (PAS rue, ciel, décor complexe, texture)
3. **Cadrage frontal ou 3/4 léger** — pas photo profil pur ni vue plongée/contre-plongée extrême
4. **Objet complet** — pas coupé aux bords
5. **Résolution correcte** — pas pixelisé, blur ou artefacts JPEG
6. **Silhouette claire** — bon contraste sujet/fond
7. **Éclairage neutre** — pas d'ombres marquées ni reflets forts

Retourne UNIQUEMENT un JSON strict (aucun texte hors JSON) avec la structure :

{
  "ready_for_3d": true | false,
  "confidence": "high" | "medium" | "low",
  "detected_object": "description courte du sujet en PT-BR",
  "issues": ["issue1", "issue2"],
  "issue_labels_ptbr": "phrase user-friendly en PT-BR listant les problèmes principaux",
  "main_issue_type": "fundo_complexo" | "objeto_cortado" | "baixa_qualidade" | "ilustracao_2d" | "multiplos_objetos" | "outro",
  "suggested_message_ptbr": "message PT-BR complet à envoyer au client. Voir règles ci-dessous."
}

**Construction du suggested_message_ptbr :**

- Toujours commencer par: "A foto tá quase perfeita, mas [issue précise en PT-BR user-friendly]."
- Si main_issue_type == "fundo_complexo" : SUGGÈRE explicitement le site remove.bg. Format :
  "A foto tem um fundo complexo que vai dificultar. Uma dica rápida: entra em https://www.remove.bg (grátis, sem cadastro), arrasta a foto, faz o download da versão sem fundo, e me manda de volta! Vai levar uns 15 segundos e o resultado 3D vai ficar muito mais fiel. 🚀"
- Si main_issue_type == "objeto_cortado" : demande une nouvelle photo avec objet complet dans le cadre
- Si main_issue_type == "ilustracao_2d" : explique que Meshy travaille mieux avec des photos réelles (statuettes, jouets) ou une illustration bien contrastée sur fond blanc, propose de chercher une "action figure" sur Google Images
- Si main_issue_type == "baixa_qualidade" : demande une photo plus nette / meilleure résolution
- Si main_issue_type == "multiplos_objetos" : demande une photo avec seulement l'objet principal
- Tone toujours amigável, court (max 4 lignes), avec 1-2 emojis max

RÈGLE : sois EXIGEANT. Une image "bof" doit être rejetée. Meshy fait des rendus dégueulasses si l'input est bof. Mieux vaut demander une meilleure photo que de gaspiller un crédit.`;

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
