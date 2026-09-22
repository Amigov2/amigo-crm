import crypto from "node:crypto";
import { loadWaLabo3d, saveWaLabo3d, isWaLocking3dEnabled, setPendingQuoteAtomic, resolvePendingQuoteAtomic } from "./_lib/supabase.js";
import { sendMetaMessage, sendMetaImageByUrl, uploadMetaMedia, sendMetaImageByMediaId } from "./_lib/meta-send.js";
import { generateResponse } from "./_lib/labo3d-ai.js";
import { pushToAllSubscribers } from "./_lib/push.js";
import { pixPayload, pixQrCodeUrl } from "./_lib/pix.js";
import { downloadMetaMedia } from "./_lib/meta-media.js";
import { notifyHumanEscalation, notifyPendingQuote, notifyTeam } from "./_lib/notify.js";
import { buildApprovalLink, verifySig, approvalHtmlPage } from "./_lib/approval-link.js";
import { buildNanoPromptFromConv } from "./_lib/nano-prompt-builder.js";
import { nanoRenderPrintedFigurine } from "./_lib/nano-render.js";
import { uploadImageForMeshy, downloadAndUploadMedia } from "./_lib/supabase-storage.js";
import { watermarkImageAndUpload } from "./_lib/watermark.js";
import { preCheckImageForMeshy } from "./_lib/image-precheck.js";
import { transcribeAudioViaGemini } from "./_lib/audio-transcribe.js";
import { fixTypos } from "./_lib/typo-fix.js";
import {
  containsQuote,
  isAdminPhone,
  parseAdminReply,
  replacePriceInQuote,
  findMostRecentPending,
  sendPendingQuoteAlert,
  sendToClient,
  getAdminPhones,
} from "./_lib/quote-approval.js";

// Raw body pour vérifier signature HMAC Meta
export const config = { api: { bodyParser: false }, maxDuration: 60 };

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
  if (t === "audio") return { type: t, content: "[áudio]", media_id: msg.audio?.id };
  if (t === "video") return { type: t, content: msg.video?.caption || "[vídeo]", media_id: msg.video?.id };
  if (t === "document") return {
    type: t,
    content: msg.document?.caption || `[documento: ${msg.document?.filename || "?"}]`,
    media_id: msg.document?.id,
    doc_filename: msg.document?.filename || null,
    doc_mime: msg.document?.mime_type || null,
  };
  if (t === "sticker") return { type: t, content: "[figurinha]", media_id: msg.sticker?.id };
  if (t === "reaction") return {
    type: t,
    content: msg.reaction?.emoji || "",
    reaction_emoji: msg.reaction?.emoji || "",
    reaction_to_meta_id: msg.reaction?.message_id || null,
  };
  if (t === "location") return { type: t, content: `[localização ${msg.location?.latitude},${msg.location?.longitude}]` };
  if (t === "contacts") return { type: t, content: `[contato: ${msg.contacts?.[0]?.name?.formatted_name || "?"}]` };
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

  // ═══ APPROVAL WORKFLOW : intercept si l'expéditeur est un admin ═══
  // L'admin répond à une alerte de devis pending. On ne traite PAS ce message
  // comme un message client normal — on l'utilise pour approuver/modifier/personnaliser
  // le devis IA en attente.
  if (isAdminPhone(phone)) {
    const { type, content } = extractContent(msg);
    if (type === "text") {
      await handleAdminApprovalReply(state, phone, content, msg.id);
    }
    return; // ne pas stocker dans une conv client
  }

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

  const extracted = extractContent(msg);
  const { type, content, media_id, doc_filename, doc_mime, reaction_emoji, reaction_to_meta_id } = extracted;

  // ── Reactions : n'ajoutent PAS de nouveau message dans la conv.
  // On les attache au message parent via reactions[] pour affichage inline.
  if (type === "reaction" && reaction_to_meta_id) {
    const parent = conv.messages.find(m => m.meta_id === reaction_to_meta_id);
    if (parent) {
      parent.reactions = parent.reactions || [];
      // Retire une éventuelle réaction précédente du même expéditeur avant d'ajouter (Meta envoie
      // un event avec emoji="" quand l'utilisateur retire sa réaction).
      parent.reactions = parent.reactions.filter(r => r.from !== phone);
      if (reaction_emoji) {
        parent.reactions.push({ from: phone, emoji: reaction_emoji, at: ts, meta_id: msg.id });
      }
      conv.last_message_at = ts;
    }
    return;
  }

  // ── Télécharge et upload immédiatement le media (image/video/audio/document/sticker).
  // Meta ne garde ses medias que 30j — on veut une copie durable sur Supabase.
  let media_url = null;
  let mime_type = null;
  let size = null;
  let transcription = null;
  const isMediaType = ["image", "video", "audio", "document", "sticker"].includes(type);
  if (isMediaType && media_id) {
    try {
      const dl = await downloadAndUploadMedia({
        media_id,
        hint_filename: doc_filename || null,
        prefix: `wa-${type}`,
      });
      media_url = dl.url;
      mime_type = dl.mime_type;
      size = dl.size;
      // Transcrit tout de suite les audios pour que le bot puisse répondre au
      // contenu (au lieu de dire "não consigo ouvir áudio").
      if (type === "audio" && media_url) {
        try {
          const tr = await transcribeAudioViaGemini({ audio_url: media_url, mime_type });
          transcription = tr.transcription;
          console.log("[wa-labo3d-webhook] audio transcribed:", transcription.slice(0, 100));
        } catch (trErr) {
          console.error("[wa-labo3d-webhook] audio transcription failed:", trErr.message);
        }
      }
    } catch (dlErr) {
      console.error(`[wa-labo3d-webhook] media download failed (${type}):`, dlErr.message);
      // On garde quand même le message avec media_id → refresh-media pourra retenter plus tard.
    }
  }

  conv.messages.push({
    id: newId("msg"),
    direction: "inbound",
    type,
    content,
    media_id: media_id || null,
    media_url: media_url || null,
    mime_type: mime_type || doc_mime || null,
    size: size || null,
    doc_filename: doc_filename || null,
    transcription: transcription || null,
    timestamp: ts,
    meta_id: msg.id,
    from_phone_id: metadata?.phone_number_id || null,
  });
  conv.last_message_at = ts;
  conv.unread = true;

  // Client répond → annule tout rappel programmé (le bot ne doit pas relancer si le client est revenu)
  if (conv.scheduled_reminder && !conv.scheduled_reminder.done) {
    conv.scheduled_reminder.done = true;
    conv.scheduled_reminder.cancelled_by_reply_at = ts;
  }
}

// Traite une réponse d'admin à une alerte de devis pending.
// Trouve le devis en attente le plus récent, applique la décision :
//   - approve → envoie devis IA tel quel au client
//   - newPrice → override le prix dans le devis, envoie
//   - customText → envoie tel quel au client comme message
// First-wins : si Anthony a déjà répondu, Harold reçoit "déjà traité par..."
async function handleAdminApprovalReply(state, adminPhone, adminText, adminMetaId) {
  const conv = findMostRecentPending(state);
  if (!conv) {
    // Pas de devis en attente → envoie un message d'aide à l'admin
    await sendMetaMessage({
      phone: adminPhone,
      text: `ℹ️ Aucun devis en attente d'approbation actuellement.\n\nTa réponse : "${adminText.slice(0, 100)}"`,
    });
    return;
  }

  // First-wins : vérifie si déjà résolu depuis le dernier check
  if (conv.pending_quote?.resolved_at) {
    await sendMetaMessage({
      phone: adminPhone,
      text: `⚠️ Le devis ${conv.contact_name || conv.phone} a déjà été traité par ${conv.pending_quote.resolved_by || "quelqu'un"}.`,
    });
    return;
  }

  const decision = parseAdminReply(adminText);
  const pending = conv.pending_quote;
  const now = new Date().toISOString();
  let finalText;
  let action;

  if (decision.approve) {
    finalText = pending.text;
    action = "approved";
  } else if (decision.newPrice) {
    finalText = replacePriceInQuote(pending.text, decision.newPrice);
    action = "price_override";
  } else {
    finalText = decision.customText;
    action = "custom_text";
  }

  // Envoie au client
  let metaMessageId = null;
  try {
    metaMessageId = await sendToClient(conv, finalText);
  } catch (e) {
    await sendMetaMessage({
      phone: adminPhone,
      text: `❌ Erreur envoi au client ${conv.contact_name || conv.phone} : ${String(e.message || e).slice(0, 200)}`,
    });
    return;
  }

  // Enregistre le message envoyé côté conv
  const newMsg = {
    id: newId("msg"),
    direction: "outbound",
    type: "text",
    content: finalText,
    timestamp: now,
    meta_id: metaMessageId,
    sender_email: `admin:${adminPhone}`,
    approval_action: action,
    delivery_status: "sent",
  };
  conv.messages = conv.messages || [];
  conv.messages.push(newMsg);
  conv.last_message_at = now;
  conv.unread = false;

  // Marque le pending comme résolu
  const resolvedFields = {
    resolved_at: now,
    resolved_by: adminPhone,
    resolved_action: action,
    admin_reply_meta_id: adminMetaId,
    final_text: finalText,
  };
  Object.assign(pending, resolvedFields);

  // Persistance atomique de la résolution + du message outbound côté DB.
  // Empêche qu'un webhook concurrent ré-affiche "aucun devis en attente"
  // ou perde le message envoyé au client.
  if (isWaLocking3dEnabled()) {
    try {
      const ok = await resolvePendingQuoteAtomic(conv.id, resolvedFields, newMsg, now);
      if (!ok) console.warn("[approval] resolvePendingQuoteAtomic returned false for", conv.id);
    } catch (rpcErr) {
      console.error("[approval] resolvePendingQuoteAtomic failed:", rpcErr.message);
    }
  }

  // Confirmation à l'admin
  const summary =
    action === "approved" ? `✅ Devis envoyé tel quel à ${conv.contact_name || conv.phone}` :
    action === "price_override" ? `✅ Envoyé avec prix R$ ${decision.newPrice} à ${conv.contact_name || conv.phone}` :
    `✅ Ton message transmis à ${conv.contact_name || conv.phone}`;
  await sendMetaMessage({ phone: adminPhone, text: summary });
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

export async function processAiResponses(convIds) {
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
      // Récupère la DERNIÈRE IMAGE de l'historique inbound (pas le dernier inbound tout court)
      // — le client peut envoyer une photo puis confirmer par texte "sim", il faut quand même
      // pouvoir passer la photo à l'IA (Vision) et à Meshy à partir des tours suivants.
      let lastInboundImage = null;
      const lastInbound = [...conv.messages].reverse().find(m => m.direction === "inbound");
      const lastImageMsg = [...conv.messages].reverse().find(m => m.direction === "inbound" && m.type === "image" && m.media_id);
      if (lastImageMsg) {
        try {
          console.log("[wa-labo3d-ai] downloading image media_id=", lastImageMsg.media_id);
          lastInboundImage = await downloadMetaMedia(lastImageMsg.media_id);
          console.log("[wa-labo3d-ai] image downloaded, size=", lastInboundImage.size, "mime=", lastInboundImage.mimeType);
          // Upload sur Supabase Storage pour affichage inline dans AMIGO UI (si pas déjà fait)
          if (!lastImageMsg.media_url) {
            try {
              const buf = Buffer.from(lastInboundImage.base64, "base64");
              const publicUrl = await uploadImageForMeshy({ buffer: buf, filename: `wa-${lastImageMsg.media_id}.jpg`, mimeType: lastInboundImage.mimeType });
              lastImageMsg.media_url = publicUrl;
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
      // Détecte les tags du prompt IA : [SEND_PIX amount=X], [GENERATE_PREVIEW], [SCHEDULE_FOLLOWUP date=YYYY-MM-DD], [ESCALATE_HUMAN]
      const pixMatch = result.text.match(/\[SEND_PIX\s+amount=(\d+(?:\.\d+)?)\]/i);
      let previewMatch = result.text.match(/\[GENERATE_PREVIEW\]/i);
      const scheduleMatch = result.text.match(/\[SCHEDULE_FOLLOWUP\s+date=(\d{4}-\d{2}-\d{2})\]/i);
      const escalateMatch = result.text.match(/\[ESCALATE_HUMAN\]/i);

      // Garde anti-hallucination + anti-promesse-sans-suite + trigger client explicite :
      // 3 façons de forcer nano si le bot n'a pas émis [GENERATE_PREVIEW] :
      //   A. Bot hallucine que la prévia est prête
      //   B. Bot promet une prévia à venir
      //   C. Client demande explicitement la prévia (côté inbound)
      const HALLUC_PREVIEW_RE = /(essa é a prévia|aqui está a prévia|ficou exatamente|olha o resultado|a prévia ficou|prévia do seu)/i;
      const PROMISE_PREVIEW_RE = /(tô finalizando|estou finalizando|vou gerar (a )?prévia|gerando (a )?prévia|finalizo a prévia|vou fazer a prévia|vou preparar a prévia|aguarda uns? minutinhos?|1-2 minutinhos|2-3 minutinhos|já te mando a prévia|prévia impressa em 3d|prévia 3d pra você aprovar|assim eu finalizo)/i;
      const CLIENT_ASKS_PREVIEW_RE = /(manda\s*a?\s*pr[ée]via|envia\s*a?\s*pr[ée]via|gera\s*a?\s*pr[ée]via|cadê\s*a\s*pr[ée]via|manda\s*ver|manda\s*a\s*prev)/i;
      const clientAsksPreview = lastInbound?.content && CLIENT_ASKS_PREVIEW_RE.test(lastInbound.content);
      const botPromisesPreview = HALLUC_PREVIEW_RE.test(result.text) || PROMISE_PREVIEW_RE.test(result.text);
      const shouldForcePreview = !previewMatch && (botPromisesPreview || clientAsksPreview);
      if (shouldForcePreview) {
        console.warn("[wa-labo3d-ai] forcing GENERATE_PREVIEW — reason:", clientAsksPreview ? "client_explicit_request" : "bot_promise_or_halluc");
        previewMatch = ["[GENERATE_PREVIEW]"];
      }
      // Guardrail typos : corrige les fautes courantes (Boan oite → Boa noite, etc.)
      const cleanText = fixTypos(
        result.text
          .replace(/\[SEND_PIX[^\]]*\]/gi, "")
          .replace(/\[GENERATE_PREVIEW\]/gi, "")
          .replace(/\[SCHEDULE_FOLLOWUP[^\]]*\]/gi, "")
          .replace(/\[ESCALATE_HUMAN\]/gi, "")
          .trim()
      );

      const now = new Date().toISOString();

      // ═══ PRE-CHECK PRÉVIA AVANT ENVOI ═══
      // Si le bot promet une prévia mais la photo ne convient pas à Nano, on
      // ré-écrit son message pour demander une meilleure photo AU LIEU d'envoyer
      // une promesse contradictoire suivie d'un refus. Évite la double-comm.
      let effectiveText = cleanText;
      let previewPlan = null; // { publicUrl, prompt } → dispatch nano après send
      if (previewMatch && lastInboundImage?.base64) {
        const MAX_FREE_PREVIEWS = 2;
        const currentCount = conv.meshy_preview_count || 0;
        if (currentCount >= MAX_FREE_PREVIEWS && !conv.sinal_received_at) {
          effectiveText = `Já fizemos ${currentCount} prévias 3D pra você (obrigado pela paciência 🙏). Pra continuar refinando, precisamos avançar pro pagamento do sinal. Se quiser, me confirma o valor e mando o PIX!`;
          console.log("[wa-labo3d-ai] preview rate limit hit for", convId, "count=", currentCount);
        } else {
          try {
            console.log("[wa-labo3d-ai] pre-checking image quality for", convId);
            const check = await preCheckImageForMeshy({ base64: lastInboundImage.base64, mimeType: lastInboundImage.mimeType });
            console.log("[wa-labo3d-ai] precheck result:", JSON.stringify({ ready: check.ready_for_3d, confidence: check.confidence, issues: check.issues, object: check.detected_object }));
            if (!check.ready_for_3d) {
              effectiveText = check.suggested_message_ptbr
                || `A foto tá com uns pontos que dificultam gerar uma boa prévia 3D (${check.issue_labels_ptbr || "qualidade insuficiente"}). Você consegue mandar outra foto do ${check.detected_object || "objeto"} com fundo branco/neutro, vista de frente, sem cortes? Assim eu gero uma prévia bem mais fiel! 📸`;
              conv.status = "aguardando_melhor_foto";
              console.log("[wa-labo3d-ai] photo rejected, replacing bot message");
            } else {
              const buf = Buffer.from(lastInboundImage.base64, "base64");
              const publicUrl = await uploadImageForMeshy({ buffer: buf, filename: `${conv.id}.jpg`, mimeType: lastInboundImage.mimeType });
              const nanoPrompts = await buildNanoPromptFromConv(conv);
              previewPlan = { publicUrl, prompt: nanoPrompts.prompt, check };
              console.log("[wa-labo3d-ai] Nano prompt built:", nanoPrompts.prompt.slice(0, 140));
            }
          } catch (renderErr) {
            console.error("[wa-labo3d-ai] pre-check failed, keeping bot msg + skipping preview:", renderErr.message);
          }
        }
      }

      // ═══ QUEUE NANO EN AMONT ═══
      // Si previewPlan a été calculé (pre-check OK), on queue le job MAINTENANT
      // AVANT le pending_quote workflow. Sinon si le message contient un R$X,
      // l'approval intercepte et la queue nano est perdue (les continue skipent
      // le bloc 2b).
      if (previewPlan) {
        conv.pending_meshy = {
          started_at: new Date().toISOString(),
          input_url: previewPlan.publicUrl,
          precheck: previewPlan.check,
          prompt: previewPlan.prompt,
          backend: "nano",
          status: "queued",
          phone: conv.phone,
        };
        conv.status = "gerando_preview";
        console.log("[wa-labo3d-ai] Nano preview QUEUED for cron", convId);
      }

      // ═══ APPROVAL WORKFLOW : intercept si le devis IA contient un prix ═══
      // Ne PAS envoyer au client — sauvegarde comme pending_quote + WA aux admins.
      // L'admin approuve/modifie/personnalise via WA, la réponse est ensuite envoyée au client.
      if (containsQuote(cleanText) && getAdminPhones().length > 0) {
        const pendingObj = {
          text: cleanText,
          ai_generated_at: now,
          ai_usage: result.usage,
          image_media_id: lastImageMsg?.media_id || null,
        };
        conv.pending_quote = pendingObj;
        // Persistance atomique côté DB via RPC pg (verrou row-level, à l'abri d'un save
        // concurrent qui pourrait écraser le pending entre notre RAM et le save final).
        if (isWaLocking3dEnabled()) {
          try {
            const ok = await setPendingQuoteAtomic(conv.id, pendingObj);
            if (!ok) console.warn("[approval] setPendingQuoteAtomic returned false for", convId);
          } catch (rpcErr) {
            console.error("[approval] setPendingQuoteAtomic failed:", rpcErr.message);
          }
        }
        let waOk = false, emailOk = false;
        try {
          const alertResult = await sendPendingQuoteAlert({
            conv,
            quoteText: cleanText,
            imageMediaId: lastImageMsg?.media_id || null,
          });
          waOk = (alertResult?.alerted || []).some(a => a.ok);
          console.log("[approval] pending_quote created for", convId, "WA alert result:", JSON.stringify(alertResult));
        } catch (waErr) {
          console.error("[approval] WA alert failed:", waErr.message);
        }
        // Email alert (canal fiable, WA parfois bloqué par Meta silencieusement)
        try {
          const emailResult = await notifyPendingQuote({
            conv,
            quoteText: cleanText,
            clientDemand: lastInbound?.content || "",
            imageBase64: lastInboundImage?.base64 || null,
            imageMime: lastInboundImage?.mimeType || "image/jpeg",
            approveUrl: buildApprovalLink(conv.id, "ok"),
            takeUrl: buildApprovalLink(conv.id, "take"),
            priceUrl: buildApprovalLink(conv.id, "price"),
          });
          emailOk = emailResult?.ok === true;
          console.log("[approval] email alert result:", JSON.stringify(emailResult));
        } catch (emailErr) {
          console.error("[approval] email alert failed:", emailErr.message);
        }
        // Fallback : si NI WA NI email n'ont marché, envoie direct au client pour pas bloquer
        if (!waOk && !emailOk) {
          console.warn("[approval] both alerts failed, falling back to direct client send for", convId);
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
            approval_skipped: "all_alerts_failed",
          });
          conv.last_message_at = now;
        }
        conv.unread = false;
        dirty = true;
        continue; // skip le send normal ci-dessous
      }

      // 1. Envoie le message texte principal (sans la tag, potentiellement re-écrit par pre-check)
      const metaMessageId = await sendMetaMessage({ phone: conv.phone, text: effectiveText });
      conv.messages.push({
        id: newId("msg"),
        direction: "outbound",
        type: "text",
        content: effectiveText,
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

      // 2. Si tag ESCALATE_HUMAN → coupe le bot + notifie Anthony/Harold
      if (escalateMatch) {
        conv.ai_auto = false;
        conv.escalated_at = new Date().toISOString();
        conv.status = "escalado_humano";
        try {
          const r = await notifyHumanEscalation({ conv, lastMessage: lastInbound?.content || "" });
          console.log("[wa-labo3d-ai] bot self-escalation notify result:", JSON.stringify(r));
          await pushToAllSubscribers({
            title: `🚨 BOT ESCALADE — ${conv.contact_name || conv.phone}`,
            body: (lastInbound?.content || "").slice(0, 100),
            url: "/#/print3d/chat",
            badgeCount: (state.conversations || []).filter(c => c.unread).length,
          });
        } catch (escErr) {
          console.error("[wa-labo3d-ai] bot self-escalation notify failed:", escErr.message);
        }
      }

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

      // 2b. Queue nano déjà faite en amont (avant approval workflow) — voir plus haut

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
      // Log structuré pour debug (JSON parseable dans Vercel logs)
      const conv = state.conversations.find(c => c.id === convId);
      const lastMsg = conv?.messages?.[conv.messages.length - 1];
      console.error("[wa-labo3d-ai] failed", JSON.stringify({
        conv_id: convId,
        conv_phone: conv?.phone,
        conv_name: conv?.contact_name,
        last_msg_ts: lastMsg?.timestamp,
        last_msg_dir: lastMsg?.direction,
        last_msg_preview: (lastMsg?.content || "").slice(0, 100),
        error_name: err.name,
        error_message: err.message,
        stack_head: err.stack?.split("\n").slice(0, 4).join(" | "),
      }));
      // Fallback client : évite le silence radio qui laisse le client sans réponse
      // (le vrai bug prod du 12/09 sur Jon Ben et Mariana Secretaria)
      if (conv?.phone) {
        try {
          const fallbackText = "Um instante, nossa equipe já vai te responder! 🙏";
          const metaId = await sendMetaMessage({ phone: conv.phone, text: fallbackText });
          conv.messages = conv.messages || [];
          conv.messages.push({
            id: newId("msg"),
            direction: "outbound",
            type: "text",
            content: fallbackText,
            timestamp: new Date().toISOString(),
            meta_id: metaId,
            sender_email: aiSender,
            delivery_status: "sent",
            fallback_reason: "ai_generation_failed",
            ai_error: err.message?.slice(0, 200),
          });
          conv.last_message_at = new Date().toISOString();
          conv.needs_human_attention = true;
          dirty = true;
          console.log("[wa-labo3d-ai] fallback message sent to", conv.phone);
        } catch (fbErr) {
          console.error("[wa-labo3d-ai] fallback send failed:", fbErr.message);
        }
        // Push notif admin (déjà envoyé au moment inbound par processWebhook, mais on
        // ajoute un badge urgent pour signaler qu'un humain doit reprendre la main)
        try {
          await pushToAllSubscribers({
            title: `🚨 Bot IA en erreur — ${conv.contact_name || conv.phone}`,
            body: `Erreur : ${err.message?.slice(0, 80) || "inconnue"} · Fallback envoyé, réponds manuel.`,
            url: "/#/print3d/chat",
            badgeCount: (state.conversations || []).filter(c => c.unread || c.needs_human_attention).length,
          });
        } catch (pushErr) {
          console.error("[wa-labo3d-ai] admin push failed:", pushErr.message);
        }
      }
    }
  }
  if (dirty) {
    try { await saveWaLabo3d(state); } catch (err) {
      console.error("[wa-labo3d-ai] save failed:", err.message);
    }
  }
}

function sendHtml(res, code, title, message, color) {
  res.status(code).setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(approvalHtmlPage(code, title, message, color));
}

async function handleApprovalLink(req, res) {
  const { conv: convId, action, sig, newPrice } = req.query || {};
  if (!convId || !action || !sig) return sendHtml(res, 400, "❌ Lien invalide", "Paramètres manquants.", "#ef4444");
  if (!["ok", "take", "price"].includes(action)) return sendHtml(res, 400, "❌ Action inconnue", `Action « ${action} » non supportée.`, "#ef4444");
  if (!verifySig(convId, action, sig)) return sendHtml(res, 403, "❌ Signature invalide", "Ce lien n'est pas authentique ou a été modifié.", "#ef4444");

  const state = await loadWaLabo3d();
  const conv = (state.conversations || []).find(c => c.id === convId);
  if (!conv) return sendHtml(res, 404, "❌ Conversation introuvable", "Cette conv n'existe plus dans le CRM.", "#ef4444");
  const pending = conv.pending_quote;
  if (!pending) return sendHtml(res, 200, "ℹ️ Aucun devis en attente", "Ce devis a peut-être déjà été traité ou annulé.", "#f59e0b");
  if (pending.resolved_at) {
    return sendHtml(res, 200, "⚠️ Déjà traité", `Ce devis a déjà été traité par <strong>${pending.resolved_by || "quelqu'un"}</strong> (${pending.resolved_action || "?"}).`, "#f59e0b");
  }

  const now = new Date().toISOString();
  const clientLabel = conv.contact_name || conv.phone;
  const source = (req.headers["x-forwarded-for"] || "email-link").toString().split(",")[0].trim();

  // Action "price" : formulaire si pas de newPrice, sinon applique et envoie
  if (action === "price") {
    if (!newPrice) {
      // Affiche le form avec le devis courant + input prix
      const currentPrice = (pending.text || "").match(/R\$\s*[\d.,]+/i)?.[0] || "R$ ?";
      const escapedText = (pending.text || "").replace(/</g, "&lt;");
      const formHtml = `
        <p style="color:#666;margin:0 0 8px;font-size:14px">Devis IA courant (prix ${currentPrice}) :</p>
        <div style="background:#ecfeff;padding:12px;border-radius:8px;border-left:3px solid #0ea5e9;white-space:pre-wrap;font-size:13px;max-height:200px;overflow:auto">${escapedText}</div>
        <form method="GET" action="/api/wa-labo3d-webhook" style="margin-top:20px">
          <input type="hidden" name="approve" value="1">
          <input type="hidden" name="conv" value="${convId}">
          <input type="hidden" name="action" value="price">
          <input type="hidden" name="sig" value="${sig}">
          <label style="display:block;font-weight:600;margin-bottom:6px;font-size:14px">Nouveau prix (R$) :</label>
          <input type="number" step="1" min="10" name="newPrice" required autofocus
                 style="width:100%;padding:12px 14px;font-size:18px;border:2px solid #0ea5e9;border-radius:8px;margin-bottom:16px" placeholder="ex: 95">
          <button type="submit" style="width:100%;padding:14px;background:#0ea5e9;color:white;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer">
            Envoyer au client avec ce prix
          </button>
        </form>`;
      return sendHtml(res, 200, `✏️ Modifier le prix — ${clientLabel}`, formHtml, "#0ea5e9");
    }
    // newPrice fourni → applique et envoie
    const priceNum = parseFloat(String(newPrice).replace(",", "."));
    if (isNaN(priceNum) || priceNum < 10) return sendHtml(res, 400, "❌ Prix invalide", `« ${newPrice} » n'est pas un prix valide (min R$ 10).`, "#ef4444");
    const finalText = replacePriceInQuote(pending.text, priceNum);
    let metaMessageId = null;
    try {
      metaMessageId = await sendMetaMessage({ phone: conv.phone, text: finalText });
    } catch (e) {
      return sendHtml(res, 500, "❌ Erreur envoi client", `Impossible d'envoyer via Meta : ${String(e.message || e).slice(0, 200)}`, "#ef4444");
    }
    const newMsg = {
      id: newId("msg"), direction: "outbound", type: "text", content: finalText,
      timestamp: now, meta_id: metaMessageId, sender_email: `email-price:${source}`,
      approval_action: "price_override", delivery_status: "sent",
    };
    conv.messages = conv.messages || [];
    conv.messages.push(newMsg);
    conv.last_message_at = now;
    conv.unread = false;
    const resolvedFields = { resolved_at: now, resolved_by: `email:${source}`, resolved_action: "price_override", final_text: finalText, override_price: priceNum };
    Object.assign(pending, resolvedFields);
    if (isWaLocking3dEnabled()) {
      try { await resolvePendingQuoteAtomic(conv.id, resolvedFields, newMsg, now); }
      catch (e) { console.error("[price-link] atomic resolve failed:", e.message); }
    }
    await saveWaLabo3d(state);
    return sendHtml(res, 200, "✅ Devis envoyé avec nouveau prix", `Prix modifié à <strong>R$ ${priceNum}</strong> et envoyé à <strong>${clientLabel}</strong> (${conv.phone}) sur WhatsApp.`, "#22c55e");
  }

  if (action === "take") {
    conv.ai_auto = false;
    conv.escalated_at = now;
    conv.status = "escalado_humano";
    const resolvedFields = { resolved_at: now, resolved_by: `email:${source}`, resolved_action: "take_over", final_text: null };
    Object.assign(pending, resolvedFields);
    if (isWaLocking3dEnabled()) {
      try { await resolvePendingQuoteAtomic(conv.id, resolvedFields, null, now); }
      catch (e) { console.error("[approve-link] atomic resolve failed:", e.message); }
    }
    await saveWaLabo3d(state);
    return sendHtml(res, 200, "🖐 Tu as pris la main", `Le bot est <strong>désactivé</strong> sur la conv de <strong>${clientLabel}</strong>. Aucun message n'a été envoyé au client. Réponds-lui directement depuis AMIGO CRM.`, "#f59e0b");
  }

  // action === "ok"
  const finalText = pending.text;
  let metaMessageId = null;
  try {
    metaMessageId = await sendMetaMessage({ phone: conv.phone, text: finalText });
  } catch (e) {
    return sendHtml(res, 500, "❌ Erreur envoi client", `Impossible d'envoyer via Meta : ${String(e.message || e).slice(0, 200)}`, "#ef4444");
  }
  const newMsg = {
    id: newId("msg"), direction: "outbound", type: "text", content: finalText,
    timestamp: now, meta_id: metaMessageId, sender_email: `email-approve:${source}`,
    approval_action: "approved", delivery_status: "sent",
  };
  conv.messages = conv.messages || [];
  conv.messages.push(newMsg);
  conv.last_message_at = now;
  conv.unread = false;

  const resolvedFields = { resolved_at: now, resolved_by: `email:${source}`, resolved_action: "approved", final_text: finalText };
  Object.assign(pending, resolvedFields);
  if (isWaLocking3dEnabled()) {
    try { await resolvePendingQuoteAtomic(conv.id, resolvedFields, newMsg, now); }
    catch (e) { console.error("[approve-link] atomic resolve failed:", e.message); }
  }
  await saveWaLabo3d(state);
  return sendHtml(res, 200, "✅ Devis envoyé", `Le devis a été envoyé à <strong>${clientLabel}</strong> (${conv.phone}) sur WhatsApp.`, "#22c55e");
}

export default async function handler(req, res) {
  // GET : Meta verify webhook OU magic-link d'approbation devis pending
  if (req.method === "GET") {
    if (req.query.approve === "1") {
      return handleApprovalLink(req, res);
    }
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

// Génère la prévia Nano, l'upload watermarkée sur Supabase, l'envoie via Meta,
// puis met à jour l'état de la conv. Appelée en fire-and-forget depuis le
// pipeline AI response — ne doit jamais bloquer la réponse au webhook.
async function runNanoPreviewBackground({ convId, phone, image_url, prompt }) {
  const t0 = Date.now();
  console.log("[nano-bg] START conv=", convId, "phone=", phone, "image_url=", image_url?.slice(0, 80), "prompt_len=", prompt?.length);
  try {
    const out = await nanoRenderPrintedFigurine({ image_url, prompt });
    console.log("[nano-bg] nano done in", Date.now() - t0, "ms, out size=", out.base64?.length || 0, "mime=", out.mimeType);

    // Upload output raw sur Supabase
    const rawBuf = Buffer.from(out.base64, "base64");
    const rawUrl = await uploadImageForMeshy({
      buffer: rawBuf,
      filename: `nano-${convId}-${Date.now()}.png`,
      mimeType: out.mimeType,
    });

    // Watermark (fallback = raw si watermark plante)
    let watermarkedUrl = rawUrl;
    try {
      watermarkedUrl = await watermarkImageAndUpload(rawUrl, convId);
    } catch (wmErr) {
      console.error("[nano-bg] watermark failed, using raw:", wmErr.message);
    }

    // Envoi WhatsApp au client
    await sendMetaMessage({
      phone,
      text: "Prévia da sua peça prontinha! Olha só como ela deve ficar depois de impressa 👇\n\n⚠️ *Importante:* isso é uma prévia gerada por IA pra te dar uma noção. O modelo final vai ser refeito na mão pelo Anthony com mais detalhe e acabamento — bem melhor que essa prévia!\n\nSe aprovar a direção, é só me falar 'sim' que mando o PIX pra começar a modelagem definitiva.",
    });
    try {
      await sendMetaImageByUrl({ phone, imageUrl: watermarkedUrl, caption: "🎨 Prévia IA — LABO 3D" });
    } catch (imgErr) {
      console.error("[nano-bg] image send failed:", imgErr.message);
    }

    // Update conv state (relire l'état pour ne pas écraser un autre update entre-temps)
    const state = await loadWaLabo3d();
    const conv = (state.conversations || []).find((c) => c.id === convId);
    if (conv) {
      const now = new Date().toISOString();
      conv.pending_meshy = {
        ...(conv.pending_meshy || {}),
        completed_at: now,
        preview_url: watermarkedUrl,
        raw_output_url: rawUrl,
        backend: "nano",
      };
      conv.meshy_preview_count = (conv.meshy_preview_count || 0) + 1;
      conv.status = "aguardando_aprovacao_preview";
      conv.last_message_at = now;
      await saveWaLabo3d(state);
      console.log("[nano-bg] sent conv=", convId, "count=", conv.meshy_preview_count);
    }
  } catch (e) {
    const errStack = (e.stack || "").split("\n").slice(0, 8).join("\n");
    console.error("[nano-bg] failed conv=", convId, "elapsed=", Date.now() - t0, "ms err=", e.message, "stack:", errStack);
    try {
      const state = await loadWaLabo3d();
      const conv = (state.conversations || []).find((c) => c.id === convId);
      if (conv) {
        conv.pending_meshy = {
          ...(conv.pending_meshy || {}),
          completed_at: new Date().toISOString(),
          error: e.message,
          error_stack: errStack,
          elapsed_ms: Date.now() - t0,
          backend: "nano",
        };
        conv.ai_auto = false;
        conv.status = "escalado_humano";
        conv.escalated_at = new Date().toISOString();
        await saveWaLabo3d(state);
        try {
          // Debug direct : sur le numéro perso Anthony, envoie l'erreur complète pour diagnostic
          const isAnthonyDebug = String(phone).replace(/\D/g, "") === "33688852587";
          const clientText = isAnthonyDebug
            ? `🔧 DEBUG NANO FAIL\n\nErreur: ${(e.message || "").slice(0, 500)}\n\nStack (first 3 lines):\n${errStack.split("\n").slice(0, 3).join("\n")}\n\nPrompt used (200 chars):\n${(prompt || "").slice(0, 200)}\n\nImage URL: ${image_url?.slice(0, 100)}\n\nElapsed: ${Date.now() - t0}ms`
            : "Opa, tive um problema técnico gerando a prévia 😅 Vou passar direto pro Anthony que te ajuda pessoalmente em minutos!";
          await sendMetaMessage({ phone, text: clientText });
        } catch {}
        // Email détaillé avec la vraie erreur nano — permet de débug sans dépendre des logs Vercel
        try {
          await notifyTeam({
            subject: `🚨 [LABO 3D] Prévia IA FAILED — ${conv.contact_name || conv.phone}`,
            html: `<div style="font-family:system-ui,sans-serif;max-width:640px;margin:20px auto">
              <h2 style="color:#ef4444">🎨 Nano prévia FAILED</h2>
              <p><strong>Conv:</strong> ${conv.contact_name || conv.phone} (${conv.phone})</p>
              <p><strong>Elapsed:</strong> ${Date.now() - t0}ms</p>
              <p><strong>Prompt utilisé:</strong></p>
              <pre style="background:#f4f4f5;padding:10px;border-radius:6px;white-space:pre-wrap;font-size:12px">${(prompt || "").replace(/</g, "&lt;").slice(0, 800)}</pre>
              <p><strong>Image URL:</strong> <a href="${image_url}">${image_url}</a></p>
              <p><strong>Erreur:</strong></p>
              <pre style="background:#fee;padding:10px;border-radius:6px;color:#991b1b;white-space:pre-wrap;font-size:12px">${(e.message || "").replace(/</g, "&lt;")}</pre>
              <p><strong>Stack:</strong></p>
              <pre style="background:#f4f4f5;padding:10px;border-radius:6px;white-space:pre-wrap;font-size:11px">${errStack.replace(/</g, "&lt;")}</pre>
              <p>Bot désactivé sur cette conv, escalade auto en cours.</p>
            </div>`,
          });
        } catch (mailErr) {
          console.error("[nano-bg] email fail:", mailErr.message);
        }
        try {
          await pushToAllSubscribers({
            title: `🚨 PRÉVIA IA FAIL — ${conv.contact_name || conv.phone}`,
            body: (e.message || "").slice(0, 100),
            url: "/#/print3d/chat",
          });
        } catch {}
      }
    } catch (e2) {
      console.error("[nano-bg] failure handling failed:", e2.message);
    }
  }
}
