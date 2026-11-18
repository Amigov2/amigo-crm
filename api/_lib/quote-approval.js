// Workflow d'approbation des devis IA par un admin humain via WhatsApp.
// - Le bot génère un devis avec un prix → intercept, WA aux admins avec forward photo
// - Admin répond "OK" → envoie devis tel quel au client
// - Admin répond "120" ou "R$ 120" → override le prix dans le devis, envoie
// - Admin répond autre chose → transmis tel quel au client comme message

import { sendMetaMessage, sendMetaImageByMediaId } from "./meta-send.js";

const PRICE_RE = /R\$\s*[\d]+(?:[.,]\d+)?/i;
const ADMIN_PRICE_ONLY_RE = /^R?\$?\s*(\d+(?:[.,]\d+)?)\s*(?:reais?)?\s*$/i;
const MIN_PRICE_TO_REVIEW = 30; // en dessous, on considère pas comme devis (frais broutille)

// Récupère la liste des numéros admin depuis env
export function getAdminPhones() {
  return (process.env.ALERT_WA_PHONES || "")
    .split(",")
    .map(s => s.trim().replace(/^\+/, ""))
    .filter(Boolean);
}

// Est-ce que ce numéro est un admin ?
export function isAdminPhone(phone) {
  const p = String(phone).replace(/^\+/, "");
  return getAdminPhones().includes(p);
}

// Parse un prix au format brésilien : "19", "19,90", "1.330", "1.330,50"
// ("1.330" = mille trois cent trente — le point est un séparateur de milliers)
function parsePriceBR(str) {
  let s = String(str).trim().replace(/R\$/i, "").replace(/\s/g, "");
  if (!s) return NaN;
  const hasComma = s.includes(","), hasDot = s.includes(".");
  if (hasComma && hasDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma) s = s.replace(",", ".");
  else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return parseFloat(s);
}

// Est-ce que ce texte contient un devis (N'IMPORTE QUEL prix >= seuil) ?
// FIX 18/11 : avant, seul le PREMIER prix était vérifié → un prix unitaire bas
// masquait le total (ex: "R$ 19/un = R$ 1.330 total" passait inaperçu et le
// devis partait au client SANS validation). On scanne désormais tous les prix.
export function containsQuote(text) {
  const matches = String(text).match(new RegExp(PRICE_RE.source, "gi")) || [];
  for (const m of matches) {
    const price = parsePriceBR(m);
    if (!isNaN(price) && price >= MIN_PRICE_TO_REVIEW) return true;
  }
  return false;
}

// Extrait le prix numérique du texte (le premier trouvé)
export function extractPrice(text) {
  const m = String(text).match(PRICE_RE);
  if (!m) return null;
  const n = parsePriceBR(m[0]);
  return isNaN(n) ? null : n;
}

// Parse la réponse admin : "OK" | { newPrice } | { customText }
export function parseAdminReply(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { customText: "" };

  // "OK" ou variantes (case insensitive, avec ou sans emoji)
  if (/^(ok|okay|okey|beleza|ç?ç?|👍|✅)\s*!?\.?$/i.test(trimmed)) {
    return { approve: true };
  }

  // Prix seul : "120", "R$ 120", "120 reais", "R$120,50"
  const priceMatch = trimmed.match(ADMIN_PRICE_ONLY_RE);
  if (priceMatch) {
    const n = parseFloat(priceMatch[1].replace(",", "."));
    if (!isNaN(n) && n >= 10) return { newPrice: n };
  }

  // Sinon : texte libre, à envoyer tel quel au client
  return { customText: trimmed };
}

// Remplace le prix dans le devis par un nouveau
export function replacePriceInQuote(quoteText, newPrice) {
  const formatted = `R$ ${Number.isInteger(newPrice) ? newPrice : newPrice.toFixed(2).replace(".", ",")}`;
  return quoteText.replace(PRICE_RE, formatted);
}

// Trouve la conv avec pending_quote non résolu la plus récente (FIFO du plus récent)
export function findMostRecentPending(state) {
  const convs = (state.conversations || []).filter(c => c.pending_quote && !c.pending_quote.resolved_at);
  if (!convs.length) return null;
  convs.sort((a, b) =>
    new Date(b.pending_quote.ai_generated_at).getTime() -
    new Date(a.pending_quote.ai_generated_at).getTime()
  );
  return convs[0];
}

// Envoie WA d'alerte aux admins avec forward photo si dispo
export async function sendPendingQuoteAlert({ conv, quoteText, imageMediaId }) {
  const phones = getAdminPhones();
  if (!phones.length) return { skipped: "no_admins" };

  const lastInbound = [...(conv.messages || [])]
    .reverse()
    .find(m => m.direction === "inbound");
  const clientDemand = (lastInbound?.content || "").slice(0, 200);

  const alertText =
    `🎂 *DEVIS EN ATTENTE*\n\n` +
    `👤 Client : ${conv.contact_name || conv.phone}\n` +
    `📞 ${conv.phone}\n\n` +
    `📝 Demande :\n"${clientDemand}"\n\n` +
    `💰 *Devis IA proposé :*\n${quoteText}\n\n` +
    `━━━━━━━━━━\n` +
    `Réponds :\n` +
    `✅ *OK* → envoyer tel quel\n` +
    `✏️ *120* (ou R$120) → envoyer avec ce prix\n` +
    `💬 Autre texte → transmis tel quel au client`;

  const results = [];
  for (const phone of phones) {
    try {
      // Forward photo d'abord si dispo
      if (imageMediaId) {
        try {
          await sendMetaImageByMediaId({ phone, mediaId: imageMediaId, caption: `📸 Photo de ${conv.contact_name || conv.phone}` });
        } catch (imgErr) {
          console.error("[quote-approval] photo forward failed:", imgErr.message);
        }
      }
      const id = await sendMetaMessage({ phone, text: alertText });
      results.push({ phone, ok: true, meta_id: id });
    } catch (e) {
      results.push({ phone, ok: false, error: String(e.message || e).slice(0, 200) });
    }
  }
  return { alerted: results };
}

// Envoie un message texte au client (utilisé quand admin approuve ou fournit texte custom)
export async function sendToClient(conv, text) {
  return sendMetaMessage({ phone: conv.phone, text });
}
