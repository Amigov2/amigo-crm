import crypto from "node:crypto";
import { loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";
import { sendMetaMessage, sendMetaImageByUrl, uploadMetaMedia, sendMetaImageByMediaId } from "./_lib/meta-send.js";
import { generateResponse } from "./_lib/labo3d-ai.js";
import { pushToAllSubscribers } from "./_lib/push.js";
import { pixPayload, pixQrCodeUrl } from "./_lib/pix.js";
import { downloadMetaMedia } from "./_lib/meta-media.js";
import { notifyHumanEscalation } from "./_lib/notify.js";
import { meshyStartImageTo3D } from "./_lib/meshy.js";
import { buildMeshyPromptFromConv } from "./_lib/meshy-prompt-builder.js";
import { uploadImageForMeshy } from "./_lib/supabase-storage.js";
import { preCheckImageForMeshy } from "./_lib/image-precheck.js";
import { fixTypos } from "./_lib/typo-fix.js";

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

  // Client répond → annule tout rappel programmé (le bot ne doit pas relancer si le client est revenu)
  if (conv.scheduled_reminder && !conv.scheduled_reminder.done) {
    conv.scheduled_reminder.done = true;
    conv.scheduled_reminder.cancelled_by_reply_at = ts;
  }
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
      // Si le dernier message inbound est une image, la downloader depuis Meta pour Vision
      let lastInboundImage = null;
      const lastInbound = [...conv.messages].reverse().find(m => m.direction === "inbound");
      if (lastInbound?.type === "image" && lastInbound?.media_id) {
        try {
          console.log("[wa-labo3d-ai] downloading image media_id=", lastInbound.media_id);
          lastInboundImage = await downloadMetaMedia(lastInbound.media_id);
          console.log("[wa-labo3d-ai] image downloaded, size=", lastInboundImage.size, "mime=", lastInboundImage.mimeType);
          // Upload sur Supabase Storage pour affichage inline dans AMIGO UI
          if (!lastInbound.media_url) {
            try {
              const buf = Buffer.from(lastInboundImage.base64, "base64");
              const publicUrl = await uploadImageForMeshy({ buffer: buf, filename: `wa-${lastInbound.media_id}.jpg`, mimeType: lastInboundImage.mimeType });
              lastInbound.media_url = publicUrl;
              dirty = true;
              console.log("[wa-labo3d-ai] image cached for UI:", publicUrl);
            } catch (upErr) {
              console.error("[wa-labo3d-ai] image cache upload failed:", upErr.message);
            }
          }
        } catch (mediaErr) {
          console.error("[wa-labo3d-ai] image download failed:", mediaErr.message);
        }
      }
      const result = await generateResponse({ conversation: conv, knowledge_base: kb, lastInboundImage });
      if (result.skipped) {
        console.log("[wa-labo3d-ai] skip", convId, "reason=" + result.skip_reason);
        // Escalade humaine : désactive le bot + notifie Anthony + Harold par email
        if (result.skip_reason === "escalate_keyword") {
          // CRITIQUE : désactive le bot durablement sur cette conv (silence total tant qu'un humain ne le réactive pas)
          conv.ai_auto = false;
          conv.escalated_at = new Date().toISOString();
          conv.status = "escalado_humano";
          dirty = true;
          try {
            const r = await notifyHumanEscalation({ conv, lastMessage: lastInbound?.content || "" });
            console.log("[wa-labo3d-ai] escalation notify result:", JSON.stringify(r));
            await pushToAllSubscribers({
              title: `🚨 ESCALADE — ${conv.contact_name || conv.phone}`,
              body: (lastInbound?.content || "").slice(0, 100),
              url: "/#/print3d/chat",
              badgeCount: (state.conversations || []).filter(c => c.unread).length,
            });
          } catch (escErr) {
            console.error("[wa-labo3d-ai] escalation notify failed:", escErr.message, escErr.stack);
          }
        }
        continue;
      }
      // Détecte les tags du prompt IA : [SEND_PIX amount=X], [GENERATE_PREVIEW], [SCHEDULE_FOLLOWUP date=YYYY-MM-DD]
      const pixMatch = result.text.match(/\[SEND_PIX\s+amount=(\d+(?:\.\d+)?)\]/i);
      const previewMatch = result.text.match(/\[GENERATE_PREVIEW\]/i);
      const scheduleMatch = result.text.match(/\[SCHEDULE_FOLLOWUP\s+date=(\d{4}-\d{2}-\d{2})\]/i);
      // Guardrail typos : corrige les fautes courantes (Boan oite → Boa noite, etc.)
      const cleanText = fixTypos(
        result.text
          .replace(/\[SEND_PIX[^\]]*\]/gi, "")
          .replace(/\[GENERATE_PREVIEW\]/gi, "")
          .replace(/\[SCHEDULE_FOLLOWUP[^\]]*\]/gi, "")
          .trim()
      );

      const now = new Date().toISOString();

      // 1. Envoie le message texte principal (sans la tag)
      const metaMessageId = await sendMetaMessage({ phone: conv.phone, text: cleanText });
      conv.messages.push({
        id: newId("msg"),
        direction: "outbound",
        type: "text",
        content: cleanText,
        timestamp: now,
        meta_id: metaMessageId,
        sender_email: aiSender,
        delivery_status: "sent",
        ai_usage: result.usage,
      });
      conv.last_message_at = now;
      conv.unread = false;
      dirty = true;
      console.log("[wa-labo3d-ai] responded", convId, "in_tokens=", result.usage?.input_tokens, "out_tokens=", result.usage?.output_tokens, "pix=", !!pixMatch);

      // 2a. Si tag SCHEDULE_FOLLOWUP → programme une relance auto (attempt 1)
      if (scheduleMatch) {
        const dateStr = scheduleMatch[1];
        // 9h Rio (America/Sao_Paulo, UTC-3) = 12h UTC. Format ISO stable.
        const at = new Date(`${dateStr}T12:00:00.000Z`).toISOString();
        const nowMs = Date.now();
        const atMs = new Date(at).getTime();
        if (atMs > nowMs) {
          conv.scheduled_reminder = { at, attempt: 1, done: false, created_at: now };
          console.log("[wa-labo3d-ai] scheduled_reminder set for", convId, "at=", at);
        } else {
          console.log("[wa-labo3d-ai] scheduled_reminder skipped (date in past):", dateStr);
        }
      }

      // 2b. Si tag GENERATE_PREVIEW → pré-check qualité photo, puis lance Meshy async
      if (previewMatch && lastInboundImage?.base64) {
        const MAX_FREE_PREVIEWS = 2;
        const currentCount = conv.meshy_preview_count || 0;
        if (currentCount >= MAX_FREE_PREVIEWS && !conv.sinal_received_at) {
          await sendMetaMessage({
            phone: conv.phone,
            text: `Já fizemos ${currentCount} prévias 3D pra você (obrigado pela paciência 🙏). Pra continuar refinando, precisamos avançar pro pagamento do sinal. Se quiser, me confirma o valor de novo e mando o PIX!`,
          });
          console.log("[wa-labo3d-ai] preview rate limit hit for", convId, "count=", currentCount);
        } else {
          try {
            // 🎯 PRE-CHECK QUALITÉ IMAGE avant de brûler un crédit Meshy
            console.log("[wa-labo3d-ai] pre-checking image quality for", convId);
            const check = await preCheckImageForMeshy({ base64: lastInboundImage.base64, mimeType: lastInboundImage.mimeType });
            console.log("[wa-labo3d-ai] precheck result:", JSON.stringify({ ready: check.ready_for_3d, confidence: check.confidence, issues: check.issues, object: check.detected_object }));

            if (!check.ready_for_3d) {
              // Photo pas OK → demande une meilleure photo au client, ne lance PAS Meshy
              const askMsg = check.suggested_message_ptbr
                || `A foto tá com uns pontos que dificultam gerar uma boa prévia 3D (${check.issue_labels_ptbr || "qualidade insuficiente"}). Você consegue mandar outra foto do ${check.detected_object || "objeto"} com fundo branco/neutro, vista de frente, sem cortes? Assim eu gero uma prévia bem mais fiel! 📸`;
              await sendMetaMessage({ phone: conv.phone, text: askMsg });
              conv.status = "aguardando_melhor_foto";
              console.log("[wa-labo3d-ai] photo rejected, asking better photo");
            } else {
              // Photo OK → upload + build prompts intelligents + lance Meshy
              const buf = Buffer.from(lastInboundImage.base64, "base64");
              const publicUrl = await uploadImageForMeshy({ buffer: buf, filename: `${conv.id}.jpg`, mimeType: lastInboundImage.mimeType });
              const meshyPrompts = await buildMeshyPromptFromConv(conv);
              console.log("[wa-labo3d-ai] Meshy prompts built:", JSON.stringify(meshyPrompts));
              const task_id = await meshyStartImageTo3D({ image_url: publicUrl, ...meshyPrompts });
              conv.pending_meshy = { task_id, started_at: new Date().toISOString(), input_url: publicUrl, precheck: check, prompts: meshyPrompts };
              conv.status = "gerando_preview";
              console.log("[wa-labo3d-ai] Meshy started", convId, "task=", task_id, "preview_count=", currentCount, "art_style=", meshyPrompts.art_style);
            }
          } catch (meshyErr) {
            console.error("[wa-labo3d-ai] Meshy pre-check/start failed:", meshyErr.message);
            await sendMetaMessage({ phone: conv.phone, text: "Tô com um problema técnico gerando a prévia agora 😅 O Anthony vai te ajudar pessoalmente, é só um instante!" });
          }
        }
      }

      // 2. Si tag PIX présent → envoie 2 messages supplémentaires (EMV + QR)
      if (pixMatch) {
        const amount = parseFloat(pixMatch[1]);
        const txid = conv.id.slice(0, 25).replace(/[^A-Za-z0-9]/g, "");
        const emv = pixPayload(amount, txid);
        const qrUrl = pixQrCodeUrl(amount, txid);
        try {
          // Message 1 : PIX Copia e Cola
          const emvMsg = `📋 *PIX Copia e Cola* (R$ ${amount.toFixed(2)}):\n\n${emv}\n\nOu escaneie o QR abaixo 👇`;
          const emvId = await sendMetaMessage({ phone: conv.phone, text: emvMsg });
          conv.messages.push({
            id: newId("msg"), direction: "outbound", type: "text", content: emvMsg,
            timestamp: new Date().toISOString(), meta_id: emvId,
            sender_email: aiSender, delivery_status: "sent",
            pix_meta: { amount, txid, kind: "copiacola" },
          });
          // Message 2 : QR code image — upload direct chez Meta (URL externe api.qrserver
          // passait mal). On download le QR généré puis on l'upload en /media puis on l'envoie.
          let qrId = null;
          try {
            const qrResp = await fetch(qrUrl);
            const qrBuf = Buffer.from(await qrResp.arrayBuffer());
            const mediaId = await uploadMetaMedia({ buffer: qrBuf, mimeType: "image/png", filename: `pix-${txid}.png` });
            qrId = await sendMetaImageByMediaId({ phone: conv.phone, mediaId, caption: `QR PIX — R$ ${amount.toFixed(2)}` });
          } catch (qrErr) {
            console.error("[wa-labo3d-ai] QR upload failed, fallback URL:", qrErr.message);
            qrId = await sendMetaImageByUrl({ phone: conv.phone, imageUrl: qrUrl, caption: `QR PIX — R$ ${amount.toFixed(2)}` });
          }
          conv.messages.push({
            id: newId("msg"), direction: "outbound", type: "image", content: `[QR PIX R$ ${amount.toFixed(2)}]`,
            timestamp: new Date().toISOString(), meta_id: qrId, media_id: null,
            sender_email: aiSender, delivery_status: "sent",
            pix_meta: { amount, txid, kind: "qrcode", qr_url: qrUrl },
          });
          conv.status = "aguardando_pagamento";
          conv.last_message_at = new Date().toISOString();
          console.log("[wa-labo3d-ai] PIX sent for", convId, "amount=", amount, "txid=", txid);
        } catch (pixErr) {
          console.error("[wa-labo3d-ai] PIX send failed:", pixErr.message);
        }
      }
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
      // Push notif immédiate (avant AI response, pour latence min)
      try {
        const state = await loadWaLabo3d();
        const unreadTotal = (state.conversations || []).filter(c => c.unread).length;
        for (const convId of convIdsWithNewInbound) {
          const conv = state.conversations.find((c) => c.id === convId);
          if (!conv) continue;
          const last = conv.messages[conv.messages.length - 1];
          if (!last || last.direction !== "inbound") continue;
          await pushToAllSubscribers({
            title: `💬 ${conv.contact_name || conv.phone}`,
            body: (last.content || "[message]").slice(0, 120),
            url: "/#/print3d/chat",
            badgeCount: unreadTotal,
          });
        }
      } catch (pushErr) {
        console.error("[wa-labo3d-webhook] push error:", pushErr.message);
      }
      await processAiResponses(convIdsWithNewInbound);
    }
  } catch (err) {
    console.error("[wa-labo3d-webhook] processing error:", err);
  }
  res.status(200).json({ received: true });
}
