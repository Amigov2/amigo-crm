import { getSupabase, loadWaLabo3d, saveWaLabo3d, isWaLocking3dEnabled, resolvePendingQuoteAtomic } from "./_lib/supabase.js";
import { sendMetaImageByUrl, sendMetaTemplate, sendMetaImageByMediaId, uploadMetaMedia } from "./_lib/meta-send.js";
import { replacePriceInQuote } from "./_lib/quote-approval.js";
import { pixPayload, pixQrCodeUrl } from "./_lib/pix.js";

const META_GRAPH_VERSION = "v20.0";

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function renderTemplate(text, variables) {
  if (!variables) return text;
  return text.replace(/\{(\w+)\}/g, (_, key) => (variables[key] != null ? String(variables[key]) : `{${key}}`));
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

async function sendMetaMessage({ phone, text }) {
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID_LABO3D;
  const accessToken = process.env.META_WA_ACCESS_TOKEN;
  if (!phoneNumberId) throw new Error("META_WA_PHONE_NUMBER_ID_LABO3D absent");
  if (!accessToken) throw new Error("META_WA_ACCESS_TOKEN absent");

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone.replace(/^\+/, ""),
    type: "text",
    text: { body: text, preview_url: true }
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await resp.json();
  if (!resp.ok) {
    const err = data?.error?.message || `Meta API error ${resp.status}`;
    throw new Error(err);
  }
  return data.messages?.[0]?.id || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  // Auth : token Supabase du user AMIGO connecté
  const userEmail = await verifyUser(req);
  if (!userEmail) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const body = req.body || {};

  // Approbation d'un pending_quote depuis l'UI AMIGO (endpoint fusionné pour
  // rester sous la limite Vercel Hobby de 12 functions).
  // Body: { approval_action: "approve"|"price"|"custom"|"reject", conv_id, value? }
  if (body.approval_action) {
    return handleApproval(req, res, userEmail, body);
  }

  // Envoi PIX manuel depuis l'UI AMIGO (fusionné pour même raison).
  // Body: { pix_amount: number, conversation_id }
  if (body.pix_amount != null) {
    return handlePixSend(req, res, userEmail, body);
  }

  let { conversation_id, phone, text, template_name, variables, image_url, caption, meta_template } = body;

  const hasImage = !!image_url;
  const hasMetaTemplate = !!meta_template?.name;
  if (!text && !template_name && !hasImage && !hasMetaTemplate) {
    return res.status(400).json({ error: "text, template_name, meta_template or image_url required" });
  }
  if (!conversation_id && !phone) {
    return res.status(400).json({ error: "conversation_id or phone required" });
  }

  const state = await loadWaLabo3d();

  // Résout template si demandé
  let finalText = text;
  if (template_name && !finalText) {
    const tpl = state.templates.find(t => t.name === template_name);
    if (!tpl) return res.status(404).json({ error: `template ${template_name} not found` });
    finalText = renderTemplate(tpl.text, variables);
  } else if (template_name && finalText) {
    // Si les deux fournis : on prend le template rendu (text = override optionnel)
    const tpl = state.templates.find(t => t.name === template_name);
    if (tpl) finalText = renderTemplate(tpl.text, variables);
  }

  // Résout conversation
  let conv = null;
  if (conversation_id) {
    conv = state.conversations.find(c => c.id === conversation_id);
    if (!conv) return res.status(404).json({ error: "conversation not found" });
  } else {
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/^0+/, "")}`;
    conv = state.conversations.find(c => c.phone === normalizedPhone);
    if (!conv) {
      conv = {
        id: newId("conv"),
        phone: normalizedPhone,
        contact_name: normalizedPhone,
        wa_display_name: null,
        status: "novo",
        assigned_to: userEmail,
        linked_prospect_id: null,
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        unread: false,
        messages: []
      };
      state.conversations.push(conv);
    }
  }

  // Envoi via Meta
  let metaMessageId = null;
  try {
    if (hasMetaTemplate) {
      metaMessageId = await sendMetaTemplate({
        phone: conv.phone,
        template_name: meta_template.name,
        language: meta_template.language || "pt_BR",
        variables: meta_template.variables_ordered || [],
      });
    } else if (hasImage) {
      metaMessageId = await sendMetaImageByUrl({
        phone: conv.phone,
        imageUrl: image_url,
        caption: caption || finalText || "",
      });
    } else {
      metaMessageId = await sendMetaMessage({ phone: conv.phone, text: finalText });
    }
  } catch (err) {
    return res.status(502).json({ error: `Meta send failed: ${err.message}` });
  }

  // Enregistre côté AMIGO
  const now = new Date().toISOString();
  const msg = {
    id: newId("msg"),
    direction: "outbound",
    type: hasMetaTemplate ? "template" : (hasImage ? "image" : "text"),
    content: hasMetaTemplate
      ? (meta_template.preview_text || `[template ${meta_template.name}]`)
      : (hasImage ? (caption || finalText || "[image]") : finalText),
    media_url: hasImage ? image_url : undefined,
    timestamp: now,
    meta_id: metaMessageId,
    sender_email: userEmail,
    template_name: template_name || null,
    meta_template: hasMetaTemplate ? { name: meta_template.name, variables_ordered: meta_template.variables_ordered || [] } : undefined,
    delivery_status: "sent"
  };
  conv.messages.push(msg);
  conv.last_message_at = now;
  conv.unread = false;
  // Sécurité anti-contradiction : dès qu'un humain envoie un message manuel via AMIGO,
  // on désactive le bot sur cette conv. L'humain reprend le contrôle. Il pourra
  // re-toggler Bot ON explicitement s'il veut re-déléguer au bot.
  // Exception : les templates de ré-engagement (envoyés automatiquement) laissent le bot ON.
  if (!hasMetaTemplate) {
    conv.ai_auto = false;
    conv.human_took_over_at = now;
  }

  await saveWaLabo3d(state);

  return res.status(200).json({
    ok: true,
    conversation_id: conv.id,
    message_id: msg.id,
    meta_id: metaMessageId
  });
}

// Dispatch d'une action d'approbation sur un pending_quote depuis l'UI AMIGO.
// Alternative au workflow WA admin (qui échoue silencieusement si la fenêtre
// 24h Meta est fermée entre le business account et le numéro admin).
async function handleApproval(req, res, userEmail, body) {
  const { approval_action: action, conv_id, value } = body;
  if (!conv_id) return res.status(400).json({ error: "conv_id required" });
  if (!["approve", "price", "custom", "reject"].includes(action)) {
    return res.status(400).json({ error: "approval_action must be approve|price|custom|reject" });
  }
  if (action === "price") {
    const n = Number(value);
    if (!isFinite(n) || n < 10) return res.status(400).json({ error: "value must be a price >= 10" });
  }
  if (action === "custom") {
    if (!value || !String(value).trim()) return res.status(400).json({ error: "value required for custom" });
  }

  const state = await loadWaLabo3d();
  const conv = (state.conversations || []).find(c => c.id === conv_id);
  if (!conv) return res.status(404).json({ error: "conversation not found" });

  const pending = conv.pending_quote;
  if (!pending) return res.status(404).json({ error: "no pending_quote on this conv" });
  if (pending.resolved_at) {
    return res.status(409).json({
      error: "already resolved",
      resolved_by: pending.resolved_by,
      resolved_at: pending.resolved_at,
      resolved_action: pending.resolved_action,
    });
  }

  const now = new Date().toISOString();
  let finalText = null;
  let resolvedAction;

  if (action === "approve") {
    finalText = pending.text;
    resolvedAction = "approved";
  } else if (action === "price") {
    finalText = replacePriceInQuote(pending.text, Number(value));
    resolvedAction = "price_override";
  } else if (action === "custom") {
    finalText = String(value).trim();
    resolvedAction = "custom_text";
  } else {
    resolvedAction = "rejected";
  }

  let metaMessageId = null;
  let outboundMsg = null;
  if (finalText) {
    try {
      metaMessageId = await sendMetaMessage({ phone: conv.phone, text: finalText });
    } catch (e) {
      return res.status(502).json({ error: `Meta send failed: ${String(e.message || e).slice(0, 200)}` });
    }
    outboundMsg = {
      id: newId("msg"),
      direction: "outbound",
      type: "text",
      content: finalText,
      timestamp: now,
      meta_id: metaMessageId,
      sender_email: userEmail,
      approval_action: resolvedAction,
      approval_source: "amigo_ui",
      delivery_status: "sent",
    };
    conv.messages = conv.messages || [];
    conv.messages.push(outboundMsg);
    conv.last_message_at = now;
    conv.unread = false;
  }

  const resolvedFields = {
    resolved_at: now,
    resolved_by: `amigo:${userEmail}`,
    resolved_action: resolvedAction,
    final_text: finalText,
  };
  Object.assign(pending, resolvedFields);

  await saveWaLabo3d(state);

  if (isWaLocking3dEnabled()) {
    try {
      const ok = await resolvePendingQuoteAtomic(conv.id, resolvedFields, outboundMsg, now);
      if (!ok) console.warn("[approval-ui] resolvePendingQuoteAtomic returned false for", conv.id);
    } catch (rpcErr) {
      console.error("[approval-ui] resolvePendingQuoteAtomic failed:", rpcErr.message);
    }
  }

  return res.status(200).json({
    ok: true,
    conversation_id: conv.id,
    resolved_action: resolvedAction,
    message_id: outboundMsg?.id || null,
    meta_id: metaMessageId,
    final_text: finalText,
  });
}

// Envoi PIX manuel : réplique le comportement du bot IA quand il tag [SEND_PIX amount=X].
// Envoie 2 messages au client (EMV Copia-e-Cola + QR code image) et passe la conv en
// status "aguardando_pagamento". Utilisable même quand le bot est OFF.
async function handlePixSend(req, res, userEmail, body) {
  const { conversation_id, pix_amount } = body;
  const amount = Number(pix_amount);
  if (!conversation_id) return res.status(400).json({ error: "conversation_id required" });
  if (!isFinite(amount) || amount < 1) return res.status(400).json({ error: "pix_amount must be >= 1" });
  if (amount > 10000) return res.status(400).json({ error: "pix_amount too large (>10000)" });

  const state = await loadWaLabo3d();
  const conv = (state.conversations || []).find(c => c.id === conversation_id);
  if (!conv) return res.status(404).json({ error: "conversation not found" });

  const txid = conv.id.slice(0, 25).replace(/[^A-Za-z0-9]/g, "");
  const emv = pixPayload(amount, txid);
  const qrUrl = pixQrCodeUrl(amount, txid);

  // Message 1 : PIX Copia e Cola texte
  const emvMsg = `📋 *PIX Copia e Cola* (R$ ${amount.toFixed(2)}):\n\n${emv}\n\nOu escaneie o QR abaixo 👇`;
  let emvMetaId;
  try {
    emvMetaId = await sendMetaMessage({ phone: conv.phone, text: emvMsg });
  } catch (e) {
    return res.status(502).json({ error: `Meta send (EMV) failed: ${String(e.message || e).slice(0, 200)}` });
  }
  const now1 = new Date().toISOString();
  conv.messages = conv.messages || [];
  conv.messages.push({
    id: newId("msg"), direction: "outbound", type: "text", content: emvMsg,
    timestamp: now1, meta_id: emvMetaId, sender_email: userEmail,
    delivery_status: "sent", pix_meta: { amount, txid, kind: "copiacola", source: "amigo_ui" },
  });

  // Message 2 : QR code image (upload direct chez Meta, fallback URL externe)
  let qrMetaId = null;
  let qrError = null;
  try {
    const qrResp = await fetch(qrUrl);
    if (!qrResp.ok) throw new Error(`QR download HTTP ${qrResp.status}`);
    const qrBuf = Buffer.from(await qrResp.arrayBuffer());
    const mediaId = await uploadMetaMedia({ buffer: qrBuf, mimeType: "image/png", filename: `pix-${txid}.png` });
    qrMetaId = await sendMetaImageByMediaId({ phone: conv.phone, mediaId, caption: `QR PIX — R$ ${amount.toFixed(2)}` });
  } catch (uploadErr) {
    console.error("[pix-send] QR upload failed, fallback URL:", uploadErr.message);
    try {
      qrMetaId = await sendMetaImageByUrl({ phone: conv.phone, imageUrl: qrUrl, caption: `QR PIX — R$ ${amount.toFixed(2)}` });
    } catch (urlErr) {
      qrError = urlErr.message;
      console.error("[pix-send] QR URL fallback also failed:", urlErr.message);
    }
  }
  const now2 = new Date().toISOString();
  if (qrMetaId) {
    conv.messages.push({
      id: newId("msg"), direction: "outbound", type: "image", content: `[QR PIX R$ ${amount.toFixed(2)}]`,
      timestamp: now2, meta_id: qrMetaId, media_id: null, sender_email: userEmail,
      delivery_status: "sent", pix_meta: { amount, txid, kind: "qrcode", qr_url: qrUrl, source: "amigo_ui" },
    });
  }

  conv.status = "aguardando_pagamento";
  conv.last_message_at = now2;

  await saveWaLabo3d(state);

  return res.status(200).json({
    ok: true,
    conversation_id: conv.id,
    amount,
    txid,
    emv_meta_id: emvMetaId,
    qr_meta_id: qrMetaId,
    qr_error: qrError,
  });
}
