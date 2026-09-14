// Construit un prompt Nano Banana (Gemini 2.5 Flash Image) à partir du contexte
// de la conversation WhatsApp entre client et vendeur LABO 3D.
//
// Le prompt DOIT renforcer le contexte "pièce physique imprimée 3D" pour éviter
// que Nano ne produise une illustration digitale/cartoon qui ne représente pas
// le rendu réel de la commande.

const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Structure imposée au prompt final : préfixe + description IA + suffixe.
// Ce cadrage garantit qu'on obtient toujours une PHOTO PRODUIT d'un objet PLA
// imprimé, quel que soit le contexte de la conv.
const PREFIX =
  "Ultra-realistic product photograph of a 3D printed PLA plastic figurine of ";
const SUFFIX =
  ". Physical tangible object, matte PLA finish with subtle FDM layer lines visible on close inspection, tabletop size (~15cm tall unless otherwise specified), sitting on a clean white studio background, soft even studio lighting, sharp focus, product photography, 4k, DSLR photo. Do NOT render as digital art, illustration, cartoon, painting or CGI game asset — this MUST look like a real photograph of a physical printed object.";

const FALLBACK_DESCRIPTION = "the character shown in the reference image";

const SYSTEM = `Você analisa uma conversa WhatsApp entre um cliente e o vendedor de impressão 3D (LABO 3D, Rio) e escreve UMA descrição em INGLÊS do objeto a imprimir, para gerar uma FOTO REALISTA da peça acabada.

Retorne APENAS um JSON:
{
  "description": "descrição em INGLÊS do objeto/personagem/pose/couleurs/acessórios (SEM mencionar impressão 3D, PLA, fundo — isso é adicionado automaticamente)",
  "size_hint": "cake topper style (~10cm)" | "small figurine (~15cm)" | "medium collector figurine (~20-25cm)" | null,
  "reasoning_ptbr": "1 frase curta em PT-BR"
}

REGRAS de description:
- Escreva SOMENTE o que o objeto É — pose, cores, roupas, acessórios, estilo (anime, chibi, réaliste, cartoon).
- NÃO mencione "3D print", "PLA", "matte", "background" — isso é adicionado por código.
- Se cliente diz "cake topper" → size_hint = "cake topper style (~10cm)".
- Se cliente diz um tamanho específico ("20 cm") → colocar em size_hint em cm.
- Se referência é foto de personagem anime/manga → mencionar "anime style" + traços visuais.
- Se referência é foto real de pessoa → "realistic portrait" + traits.
- Se ambíguo → describe apenas o que se vê na foto de referência.`;

export async function buildNanoPromptFromConv(conversation) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      prompt: PREFIX + FALLBACK_DESCRIPTION + SUFFIX,
      reasoning_ptbr: "no_api_key, fallback baseline",
    };
  }

  const msgs = (conversation.messages || []).slice(-20);
  const transcript = msgs
    .map((m) => `${m.direction === "inbound" ? "CLIENTE" : "BOT"}: ${m.content || ""}`)
    .join("\n");

  try {
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
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Conversa WhatsApp:\n\n${transcript}\n\nRetorne o JSON conforme instrução.`,
          },
        ],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${data?.error?.message || "?"}`);
    const text = data.content?.map((c) => c.text || "").join("").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON in response: " + text.slice(0, 100));
    const parsed = JSON.parse(jsonMatch[0]);
    const description = parsed.description?.trim() || FALLBACK_DESCRIPTION;
    const sizeHint = parsed.size_hint ? `, ${parsed.size_hint}` : "";
    return {
      prompt: PREFIX + description + sizeHint + SUFFIX,
      description,
      size_hint: parsed.size_hint || null,
      reasoning_ptbr: parsed.reasoning_ptbr || "",
    };
  } catch (e) {
    console.error("[nano-prompt-builder] failed:", e.message);
    return {
      prompt: PREFIX + FALLBACK_DESCRIPTION + SUFFIX,
      reasoning_ptbr: "fallback: " + e.message,
    };
  }
}
