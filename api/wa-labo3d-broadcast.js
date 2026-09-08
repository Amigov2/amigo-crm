// Broadcast texte libre WhatsApp — envoi séquentiel du même message à N conversations.
// Respecte la règle Meta 24h : par défaut n'envoie qu'aux conv dont le dernier message
// inbound est < 24h. Les autres sont reportées comme "blocked_24h".
//
// Auth : JWT Supabase du user AMIGO connecté.
// Body :
//   { text: string, only_recent_24h?: boolean (default true), conv_ids?: string[] }
// Réponse :
//   { total, sent, failed, blocked_24h, errors: [{conv_id, error}] }

import { getSupabase, loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";
import { sendMetaMessage } from "./_lib/meta-send.js";

const MS_24H = 24 * 60 * 60 * 1000;
const SEND_DELAY_MS = 250; // throttle : évite flag Meta

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function verifyUser(req) {
  const auth = req.headers.authorization || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!jwt) return null;
  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.getUser(jwt);
    if (error || !data?.user?.email) return null;
    return data.user.email;
  } catch {
    return null;
  }
}

// Trouve le dernier message inbound d'une conv, retourne timestamp ISO ou null.
function lastInboundAt(conv) {
  const msgs = conv.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].direction === "inbound") return msgs[i].timestamp;
  }
  return null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  const userEmail = await verifyUser(req);
  if (!userEmail) return res.status(401).json({ error: "unauthorized" });

  const { text, only_recent_24h = true, conv_ids = null } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text required" });
  }
  const trimmedText = text.trim();
  if (trimmedText.length > 4000) {
    return res.status(400).json({ error: "text too long (max 4000)" });
  }

  const state = await loadWaLabo3d();
  const now = Date.now();

  // Sélection des convs
  let targets = state.conversations || [];
  if (Array.isArray(conv_ids) && conv_ids.length > 0) {
    const wanted = new Set(conv_ids);
    targets = targets.filter(c => wanted.has(c.id));
  }

  const results = { total: targets.length, sent: 0, failed: 0, blocked_24h: 0, errors: [] };

  for (const conv of targets) {
    // Vérifie la fenêtre 24h Meta si demandé
    if (only_recent_24h) {
      const ts = lastInboundAt(conv);
      const inWindow = ts && (now - new Date(ts).getTime() < MS_24H);
      if (!inWindow) {
        results.blocked_24h++;
        continue;
      }
    }

    try {
      const metaMessageId = await sendMetaMessage({ phone: conv.phone, text: trimmedText });
      const nowIso = new Date().toISOString();
      const msg = {
        id: newId("msg"),
        direction: "outbound",
        type: "text",
        content: trimmedText,
        timestamp: nowIso,
        meta_id: metaMessageId,
        sender_email: userEmail,
        broadcast: true,
        delivery_status: "sent",
      };
      conv.messages = conv.messages || [];
      conv.messages.push(msg);
      conv.last_message_at = nowIso;
      conv.unread = false;
      results.sent++;
    } catch (e) {
      results.failed++;
      results.errors.push({ conv_id: conv.id, phone: conv.phone, error: String(e?.message || e).slice(0, 200) });
    }

    await sleep(SEND_DELAY_MS);
  }

  await saveWaLabo3d(state);
  return res.status(200).json({ ok: true, ...results, triggered_by: userEmail });
}
