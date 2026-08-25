import crypto from "node:crypto";
import { loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";
import { sendMetaMessage } from "./_lib/meta-send.js";
import { generateResponse } from "./_lib/labo3d-ai.js";

// Raw body pour vérifier signature HMAC Meta
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function verifyMetaSignature(rawBody, signatureHeader) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractContent(msg) {
  const t = msg.type;
  if (t === "text") return { type: t, content: msg.text?.body || "" };
  if (t === "image") return { type: t, content: msg.image?.caption || "[image]", media_id: msg.image?.id };
  if (t === "audio") return { type: t, content: "[audio]", media_id: msg.audio?.id };
  if (t === "video") return { type: t, content: msg.video?.caption || "[video]", media_id: msg.video?.id };
  if (t === "document") return { type: t, content: msg.document?.caption || `[document: ${msg.document?.filename || "?"}]`, media_id: msg.document?.id };
  if (t === "location") return { type: t, content: `[location ${msg.location?.latitude},${msg.location?.longitude}]` };
  if (t === "contacts") return { type: t, content: `[contact: ${msg.contacts?.[0]?.name?.formatted_name || "?"}]` };
  if (t === "button") return { type: t, content: msg.button?.text || "[button]" };
  if (t === "interactive") {
    const ir = msg.interactive;
    if (ir?.type === "button_reply") return { type: t, content: ir.button_reply?.title || "[button_reply]" };
    if (ir?.type === "list_reply") return { type: t, content: ir.list_reply?.title || "[list_reply]" };
    return { type: t, content: "[interactive]" };
  }
  return { type: t, content: `[${t}]` };
}

async function handleIncomingMessage(state, msg, contact, metadata) {
  const phone = msg.from;
  const ts = new Date(parseInt(msg.timestamp, 10) * 1000).toISOString();
  const contactName = contact?.profile?.name || null;

  let conv = state.conversations.find(c => c.phone === phone);
  if (!conv) {
    conv = {
      id: newId("conv"),
      phone,
      contact_name: contactName || phone,
      wa_display_name: contactName,
      status: "novo",
      assigned_to: null,
      linked_prospect_id: null,
      created_at: ts,
      last_message_at: ts,
      unread: true,
      messages: []
    };
    state.conversations.push(conv);
  } else if (contactName && conv.wa_display_name !== contactName) {
    conv.wa_display_name = contactName;
  }

  // Déduplique sur meta_id (Meta peut renvoyer un webhook en cas de timeout)
  if (conv.messages.some(m => m.meta_id === msg.id)) return;

  const { type, content, media_id } = extractContent(msg);
  conv.messages.push({
    id: newId("msg"),
    direction: "inbound",
    type,
    content,
    media_id: media_id || null,
    timestamp: ts,
    meta_id: msg.id,
    from_phone_id: metadata?.phone_number_id || null
  });
  conv.last_message_at = ts;
  conv.unread = true;
}

async function handleStatusUpdate(state, status) {
  // status.status: sent | delivered | read | failed
  const wamid = status.id;
  for (const conv of state.conversations) {
    const m = conv.messages?.find(x => x.meta_id === wamid);
    if (m) {
      m.delivery_status = status.status;
      if (status.status === "failed") m.error = status.errors?.[0]?.title || "failed";
      return;
    }
  }
}

async function processWebhook(body) {
  console.log("[wa-labo3d] processWebhook START object=", body.object);
  if (body.object !== "whatsapp_business_account") {
    console.log("[wa-labo3d] SKIP: wrong object");
    return { convIdsWithNewInbound: [] };
  }
  let state;
  try {
    state = await loadWaLabo3d();
    console.log("[wa-labo3d] loadWaLabo3d OK, conversations count=", state.conversations.length);
  } catch (err) {
    console.error("[wa-labo3d] loadWaLabo3d threw:", err.message);
    throw err;
  }

  const convIdsWithNewInbound = new Set();
  let messagesProcessed = 0;
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const value = change.value || {};
      const metadata = value.metadata || {};
      const contacts = value.contacts || [];

      for (const msg of value.messages || []) {
        const contact = contacts.find(c => c.wa_id === msg.from) || contacts[0];
        const beforeCount = (state.conversations.find(c => c.phone === msg.from)?.messages?.length) || 0;
        await handleIncomingMessage(state, msg, contact, metadata);
        const conv = state.conversations.find(c => c.phone === msg.from);
        const afterCount = conv?.messages?.length || 0;
        // Nouveau inbound (pas juste un dédoublonnage) → trigger AI plus tard
        if (conv && afterCount > beforeCount) convIdsWithNewInbound.add(conv.id);
        messagesProcessed++;
      }
      for (const status of value.statuses || []) {
        await handleStatusUpdate(state, status);
      }
    }
  }
  console.log("[wa-labo3d] messages processed:", messagesProcessed, "final conversations count=", state.conversations.length);

  try {
    await saveWaLabo3d(state);
    console.log("[wa-labo3d] saveWaLabo3d OK");
  } catch (err) {
    console.error("[wa-labo3d] saveWaLabo3d threw:", err.message);
    throw err;
  }
  return { convIdsWithNewInbound: Array.from(convIdsWithNewInbound) };
}

async function processAiResponses(convIds) {
  if (!convIds?.length) return;
  let state;
  try {
    state = await loadWaLabo3d();
  } catch (err) {
    console.error("[wa-labo3d-ai] load failed:", err.message);
    return;
  }
  const kb = state.knowledge_base;
  if (!kb) {
    console.log("[wa-labo3d-ai] no knowledge_base — skip all");
    return;
  }
  const aiSender = "ai@labo3d";
  let dirty = false;
  for (const convId of convIds) {
    const conv = state.conversations.find(c => c.id === convId);
    if (!conv) continue;
    // Toggle par conv : conv.ai_auto === false → off. Default = on.
    if (conv.ai_auto === false) {
      console.log("[wa-labo3d-ai] skip", convId, "reason=ai_auto_off");
      continue;
    }
    try {
      const result = await generateResponse({ conversation: conv, knowledge_base: kb });
      if (result.skipped) {
        console.log("[wa-labo3d-ai] skip", convId, "reason=" + result.skip_reason);
        continue;
      }
      const metaMessageId = await sendMetaMessage({ phone: conv.phone, text: result.text });
      const now = new Date().toISOString();
      conv.messages.push({
        id: newId("msg"),
        direction: "outbound",
        type: "text",
        content: result.text,
        timestamp: now,
        meta_id: metaMessageId,
        sender_email: aiSender,
        delivery_status: "sent",
        ai_usage: result.usage,
      });
      conv.last_message_at = now;
      conv.unread = false;
      dirty = true;
      console.log("[wa-labo3d-ai] responded", convId, "in_tokens=", result.usage?.input_tokens, "out_tokens=", result.usage?.output_tokens);
    } catch (err) {
      console.error("[wa-labo3d-ai] failed for", convId, ":", err.message);
    }
  }
  if (dirty) {
    try { await saveWaLabo3d(state); } catch (err) {
      console.error("[wa-labo3d-ai] save failed:", err.message);
    }
  }
}

export default async function handler(req, res) {
  // GET : Meta verify webhook subscription
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: "invalid verify token" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    return res.status(400).json({ error: "unable to read body" });
  }

  const signature = req.headers["x-hub-signature-256"];
  if (!verifyMetaSignature(rawBody, signature)) {
    return res.status(401).json({ error: "invalid signature" });
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "invalid json" });
  }

  // Fait le processing AVANT de répondre. Sur Vercel Serverless, un `await`
  // après `res.end()` peut être frozen → risque d'écriture Supabase interrompue.
  // Le processing (save inbound) + AI response reste sous les 20s Meta timeout.
  try {
    const { convIdsWithNewInbound } = await processWebhook(body);
    if (convIdsWithNewInbound.length) {
      await processAiResponses(convIdsWithNewInbound);
    }
  } catch (err) {
    console.error("[wa-labo3d-webhook] processing error:", err);
  }
  res.status(200).json({ received: true });
}
