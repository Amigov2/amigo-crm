// Génération de réponse IA pour Labo 3D — appelle Claude Haiku avec la KB
// (site labo3d.com.br scrappé + company info) + l'historique de la conversation.
//
// Retourne : { text, usage, skipped, skip_reason }
// Skip si : pas d'API key, KB absente, escalate keywords détectés, humain a répondu récemment.

const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_HISTORY = 12; // 12 derniers messages (in + out)
const ESCALATE_KEYWORDS = [
  "reclamação","reclamacao","reclamar",
  "advogado","procon","juizado","justiça","justica",
  "falar com humano","falar com pessoa","atendente humano","pessoa real",
  "estelionato","fraude","golpe","enganado",
  "cancelar","cancelamento","reembolso","estorno","devolução","devolucao",
];

// Cooldown : si un humain a envoyé un message outbound dans les N secondes,
// le bot n'intervient pas — l'humain gère cette conv.
const HUMAN_COOLDOWN_SEC = 60;

function buildSystemPrompt(kb) {
  const c = kb?.company || {};
  const pages = kb?.pages || [];
  const kbText = pages.map(p => `## ${p.label} (${p.url})\n${p.text}`).join("\n\n---\n\n");
  return `Você é um assistente comercial da ${c.name || "Labo 3D"}, uma empresa de impressão 3D artesanal em ${c.address || "Rio de Janeiro/RJ"}.

Sua missão: responder de forma natural, amigável e útil às mensagens de clientes no WhatsApp, com base APENAS nas informações da empresa fornecidas abaixo.

REGRAS ABSOLUTAS:
1. Sempre responder em português brasileiro, tom amigável mas profissional (você, não senhor/senhora).
2. **PREÇOS SEMPRE "A PARTIR DE"**: NUNCA cite uma faixa de preço (tipo "R$ 15 a R$ 40"). Sempre use "a partir de R$ X" com o valor MÍNIMO da faixa. Exemplo: se o site diz "R$ 15-40", você fala "a partir de R$ 15 — o valor exato depende dos detalhes". Isso vale para todos os produtos.
3. **PRAZO PADRÃO: 24 horas a 7 dias úteis para peças únicas.** IGNORE os prazos específicos mencionados nas páginas do site (tipo "10-15 dias" ou "7-14 dias"). Para grandes lotes (mais de 50 unidades), o prazo pode subir para 10-15 dias, então nesses casos você pode falar isso.
4. Se a pessoa pedir algo que NÃO está nas informações da empresa (ex: entrega internacional, produto que a Labo 3D não faz), diga que vai verificar com o time e responde em seguida. NUNCA invente.
5. Se a pessoa parecer frustrada, com problema pós-venda ou falando de reclamação/reembolso/procon, responda algo curto tipo "Deixa eu chamar alguém do time aqui para te ajudar pessoalmente" e pare.
6. Respostas curtas (2-4 frases máximo por padrão). Vá direto ao ponto. Não repita informações que já foram ditas na conversa.
7. Sempre que fizer sentido, peça UM detalhe específico para avançar o orçamento: referência visual, tamanho, quantidade, data, ou tema.
8. Emojis com moderação (1-2 por mensagem no máximo, quando natural).

INFORMAÇÕES DA EMPRESA:
- Nome: ${c.name || "Labo 3D"}
- Razão social: ${c.legal_entity || ""}
- CNPJ: ${c.cnpj || ""}
- Endereço atelier: ${c.address || ""}
- WhatsApp/Telefone: ${c.phone || ""}
- Instagram: ${c.instagram || ""}
- Site: ${c.website || ""}
- Horários: ${c.hours || ""}

CATÁLOGO E POLÍTICAS (extraídos do site labo3d.com.br):

${kbText}

Responda APENAS com a mensagem para o cliente, sem prefixos tipo "Resposta:" ou explicações meta.`;
}

function buildMessages(conversation) {
  const msgs = (conversation.messages || []).slice(-MAX_HISTORY);
  // Convertit l'historique en format Anthropic messages (roles user/assistant)
  const out = [];
  for (const m of msgs) {
    const role = m.direction === "inbound" ? "user" : "assistant";
    const content = m.content || "";
    if (!content.trim()) continue;
    // Fusionne les messages consécutifs du même role
    if (out.length && out[out.length - 1].role === role) {
      out[out.length - 1].content += "\n" + content;
    } else {
      out.push({ role, content });
    }
  }
  // L'API exige que la conversation démarre par user
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

function detectEscalate(text) {
  const lower = (text || "").toLowerCase();
  return ESCALATE_KEYWORDS.some(kw => lower.includes(kw));
}

export async function generateResponse({ conversation, knowledge_base }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { skipped: true, skip_reason: "no_api_key" };
  if (!knowledge_base || !knowledge_base.pages?.length) {
    return { skipped: true, skip_reason: "no_kb" };
  }

  const msgs = conversation.messages || [];
  const lastInbound = [...msgs].reverse().find(m => m.direction === "inbound");
  if (!lastInbound) return { skipped: true, skip_reason: "no_inbound" };

  // Escalade
  if (detectEscalate(lastInbound.content)) {
    return { skipped: true, skip_reason: "escalate_keyword" };
  }

  // Cooldown : dernier outbound humain (sender_email et pas ai) dans les N sec
  const lastOutbound = [...msgs].reverse().find(m => m.direction === "outbound");
  if (lastOutbound && lastOutbound.sender_email && !lastOutbound.sender_email.startsWith("ai@")) {
    const age = Date.now() - new Date(lastOutbound.timestamp).getTime();
    if (age < HUMAN_COOLDOWN_SEC * 1000) {
      return { skipped: true, skip_reason: "human_replied_recently" };
    }
  }

  const system = buildSystemPrompt(knowledge_base);
  const messages = buildMessages(conversation);
  if (!messages.length) return { skipped: true, skip_reason: "no_valid_messages" };

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
      system,
      messages,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Anthropic API ${resp.status}: ${data?.error?.message || JSON.stringify(data)}`);
  }
  const text = data.content?.map(c => c.text || "").join("").trim();
  if (!text) return { skipped: true, skip_reason: "empty_response" };

  return {
    text,
    usage: data.usage || null,
    skipped: false,
  };
}
