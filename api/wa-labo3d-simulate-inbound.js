// Endpoint de test — simule un message inbound WhatsApp sans passer par Meta.
// Injecte le message dans amigo_data + déclenche le bot IA.
// Protégé par un token shared (env AMIGO_TEST_TOKEN) pour éviter abus public.
//
// Usage :
//   curl -X POST https://amigo-labo3d.vercel.app/api/wa-labo3d-simulate-inbound \
//     -H "x-test-token: $AMIGO_TEST_TOKEN" \
//     -H "Content-Type: application/json" \
//     -d '{"phone":"+5521987654321","text":"Ola, quero um cake topper para minha filha"}'
//
// Réponse : { ok, conversation_id, ai_result: { text, skipped, skip_reason, usage } }

import { loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";
import { sendMetaMessage } from "./_lib/meta-send.js";
import { generateResponse } from "./_lib/labo3d-ai.js";

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }
  const token = req.headers["x-test-token"];
  const expected = process.env.AMIGO_TEST_TOKEN;
  if (!expected || token !== expected) {
    return res.status(401).json({ error: "invalid token" });
  }

  const body = req.body || {};
  const { phone, text, dry_run, actually_send } = body;
  if (!phone || !text) {
    return res.status(400).json({ error: "phone and text required" });
  }
  const normalizedPhone = phone.replace(/^\+/, "");

  const state = await loadWaLabo3d();

  // Trouve ou crée la conv (contact_name = "TEST BOT")
  let conv = state.conversations.find(c => c.phone === normalizedPhone || c.phone === "+" + normalizedPhone);
  const now = new Date().toISOString();
  if (!conv) {
    conv = {
      id: newId("conv"),
      phone: normalizedPhone,
      contact_name: "TEST · " + normalizedPhone,
      wa_display_name: "TEST",
      status: "novo",
      assigned_to: null,
      linked_prospect_id: null,
      created_at: now,
      last_message_at: now,
      unread: true,
      messages: [],
    };
    state.conversations.push(conv);
  }

  conv.messages.push({
    id: newId("msg"),
    direction: "inbound",
    type: "text",
    content: text,
    timestamp: now,
    meta_id: "test_" + newId("m"),
  });
  conv.last_message_at = now;
  conv.unread = true;

  if (!dry_run) {
    await saveWaLabo3d(state);
  }

  // Génère la réponse IA
  const kb = state.knowledge_base;
  const aiResult = await generateResponse({ conversation: conv, knowledge_base: kb });

  // Envoi Meta réel uniquement si actually_send=true (par défaut : simule sans envoyer)
  let metaMessageId = null;
  if (!aiResult.skipped && actually_send === true) {
    try {
      metaMessageId = await sendMetaMessage({ phone: conv.phone, text: aiResult.text });
    } catch (err) {
      return res.status(500).json({ error: `meta send failed: ${err.message}`, ai_result: aiResult });
    }
  }

  // Sauve la réponse dans l'historique conv si generated + not dry_run
  if (!aiResult.skipped && !dry_run) {
    conv.messages.push({
      id: newId("msg"),
      direction: "outbound",
      type: "text",
      content: aiResult.text,
      timestamp: new Date().toISOString(),
      meta_id: metaMessageId,
      sender_email: "ai@labo3d",
      delivery_status: metaMessageId ? "sent" : "simulated",
      ai_usage: aiResult.usage,
    });
    conv.last_message_at = new Date().toISOString();
    await saveWaLabo3d(state);
  }

  return res.status(200).json({
    ok: true,
    conversation_id: conv.id,
    ai_result: aiResult,
    meta_message_id: metaMessageId,
    dry_run: !!dry_run,
    actually_sent: !!metaMessageId,
  });
}
