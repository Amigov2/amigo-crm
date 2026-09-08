// Construit les prompts Meshy (art_style, style_prompt, texture_prompt, negative_prompt)
// à partir du contexte de la conversation WhatsApp — analyse les derniers messages
// pour extraire type de peça, style souhaité, couleurs, détails.
//
// Utilise Claude Haiku pour analyser la conv et sortir un JSON de prompts optimisés.

const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const NEGATIVE_UNIVERSAL = "blurry, deformed face, low quality, extra limbs, disfigured, warped anatomy, floating parts";

const SYSTEM = `Você é um assistente que analisa uma conversa WhatsApp entre uma cliente e um vendedor de impressão 3D (LABO 3D, Rio).

Sua missão : ler o histórico e extrair os melhores prompts Meshy AI para gerar uma prévia 3D fiel ao que a cliente quer.

Retorne APENAS um JSON válido no seguinte formato :
{
  "art_style": "cartoon" | "realistic" | "sculpture",
  "style_prompt": "descrição em INGLÊS do estilo visual (ex: 'cute stylized cake topper figurine, chibi proportions, smooth surfaces')",
  "texture_prompt": "descrição em INGLÊS das cores, roupas, acessórios detectados na conversa (ex: 'purple v-neck t-shirt, gray baggy jeans, red converse sneakers, black spiky hair, muscular anime character')",
  "confidence": 0.0-1.0,
  "reasoning_ptbr": "1 frase curta em PT-BR explicando as escolhas"
}

REGRAS :
- art_style: "cartoon" para cake topper / miniatura fofinha ; "realistic" para desenho manga/anime já estilizado ; "sculpture" para retrato realista.
- style_prompt e texture_prompt SEMPRE em INGLÊS (Meshy entende melhor).
- Se a conversa menciona "bolo" ou "cake topper" → cartoon obrigatório.
- Se a imagem é um desenho anime/manga → realistic com prompts anime.
- Se detectar cores/roupas específicas → colocar em texture_prompt.
- Se cliente disse "quero realista" mas contexto é cake topper → aviso em reasoning.
- Confidence : 0.9+ se contexto muito claro, 0.5 se ambíguo, 0.3 se muito pouca info.`;

export async function buildMeshyPromptFromConv(conversation) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { art_style: undefined, style_prompt: undefined, texture_prompt: undefined, negative_prompt: NEGATIVE_UNIVERSAL, confidence: 0, reasoning_ptbr: "no_api_key, fallback baseline" };
  }

  const msgs = (conversation.messages || []).slice(-20);
  const transcript = msgs.map(m => `${m.direction === "inbound" ? "CLIENTE" : "BOT"}: ${m.content || ""}`).join("\n");

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
        messages: [{ role: "user", content: `Conversa WhatsApp :\n\n${transcript}\n\nRetorne o JSON de prompts Meshy otimizados.` }],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${data?.error?.message || "?"}`);
    const text = data.content?.map(c => c.text || "").join("").trim();
    // Extrait le JSON du texte (parfois entouré de markdown code fence)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON in response: " + text.slice(0, 100));
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      art_style: parsed.art_style,
      style_prompt: parsed.style_prompt,
      texture_prompt: parsed.texture_prompt,
      negative_prompt: NEGATIVE_UNIVERSAL,
      confidence: parsed.confidence || 0.5,
      reasoning_ptbr: parsed.reasoning_ptbr || "",
    };
  } catch (e) {
    console.error("[meshy-prompt-builder] failed:", e.message);
    return { negative_prompt: NEGATIVE_UNIVERSAL, confidence: 0, reasoning_ptbr: "fallback: " + e.message };
  }
}
