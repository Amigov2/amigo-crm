// Batch bot IA : pour chaque conv éligible (< 24h Meta + dernier message = inbound + pas déjà répondue par humain récemment),
// génère une réponse via generateResponse (Claude Haiku vision) et l'envoie via Meta.
//
// Ce n'est pas un broadcast texte générique — c'est le webhook labo3d exécuté en batch sur les conv qui attendent.
//
// Auth : JWT Supabase.
// Body : {} (optionnel : { conv_ids: [] } pour limiter à certaines convs)
// Réponse : { total, replied, skipped_by_reason, failed, errors }

import { getSupabase, loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";
import { sendMetaMessage } from "./_lib/meta-send.js";
import { generateResponse } from "./_lib/labo3d-ai.js";
import { downloadMetaMedia } from "./_lib/meta-media.js";
import { uploadImageForMeshy } from "./_lib/supabase-storage.js";

const MS_24H = 24 * 60 * 60 * 1000;
const SEND_DELAY_MS = 400;
const AI_KB_KEY = "wa_labo3d_kb";

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

async function loadKnowledgeBase() {
  try {
    const sb = getSupabase();
    const { data } = await sb.from("amigo_data").select("value").eq("key", AI_KB_KEY).maybeSingle();
    if (!data?.value) return null;
    const kb = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    return kb && kb.pages?.length ? kb : null;
  } catch {
    return null;
  }
}

function lastInbound(conv) {
  const msgs = conv.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].direction === "inbound") return msgs[i];
  }
  return null;
}

function lastMessage(conv) {
  const msgs = conv.messages || [];
  return msgs[msgs.length - 1] || null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  const userEmail = await verifyUser(req);
  if (!userEmail) return res.status(401).json({ error: "unauthorized" });

  const { conv_ids = null } = req.body || {};

  const kb = await loadKnowledgeBase();
  if (!kb) {
    return res.status(400).json({ error: "no knowledge_base — le bot n'a rien à répondre. Configure la KB d'abord." });
  }

  const state = await loadWaLabo3d();
  const now = Date.now();

  let targets = state.conversations || [];
  if (Array.isArray(conv_ids) && conv_ids.length > 0) {
    const wanted = new Set(conv_ids);
    targets = targets.filter(c => wanted.has(c.id));
  }

  const results = {
    total: 0,
    replied: 0,
    failed: 0,
    skipped_by_reason: {},
    errors: [],
  };

  for (const conv of targets) {
    const lastIn = lastInbound(conv);
    const lastMsg = lastMessage(conv);

    // Skip : pas de message inbound
    if (!lastIn) {
      results.skipped_by_reason.no_inbound = (results.skipped_by_reason.no_inbound || 0) + 1;
      continue;
    }
    // Skip : dernier message = outbound (déjà répondu, on ne relance pas)
    if (lastMsg?.direction === "outbound") {
      results.skipped_by_reason.already_answered = (results.skipped_by_reason.already_answered || 0) + 1;
      continue;
    }
    // Skip : hors fenêtre 24h Meta
    const ageMs = now - new Date(lastIn.timestamp).getTime();
    if (ageMs >= MS_24H) {
      results.skipped_by_reason.out_of_24h_window = (results.skipped_by_reason.out_of_24h_window || 0) + 1;
      continue;
    }

    results.total++;

    // Si le dernier inbound est une image, télécharge pour Vision (comme le webhook fait)
    let lastInboundImage = null;
    if (lastIn.type === "image" && lastIn.media_id) {
      try {
        lastInboundImage = await downloadMetaMedia(lastIn.media_id);
        if (!lastIn.media_url) {
          try {
            const buf = Buffer.from(lastInboundImage.base64, "base64");
            const publicUrl = await uploadImageForMeshy({
              buffer: buf, filename: `wa-batch-${lastIn.media_id}.jpg`, mimeType: lastInboundImage.mimeType,
            });
            lastIn.media_url = publicUrl;
          } catch {}
        }
      } catch (e) {
        // image indisponible (peut-être expirée Meta) — on continue sans vision
        console.error("[batch] media download failed:", e.message);
      }
    }

    let aiResult;
    try {
      aiResult = await generateResponse({ conversation: conv, knowledge_base: kb, lastInboundImage });
    } catch (e) {
      results.failed++;
      results.errors.push({ conv_id: conv.id, phone: conv.phone, error: `AI: ${String(e?.message || e).slice(0, 150)}` });
      continue;
    }

    if (aiResult.skipped) {
      results.skipped_by_reason[aiResult.skip_reason || "unknown"] = (results.skipped_by_reason[aiResult.skip_reason || "unknown"] || 0) + 1;
      continue;
    }

    const text = aiResult.text?.trim();
    if (!text) {
      results.skipped_by_reason.empty_response = (results.skipped_by_reason.empty_response || 0) + 1;
      continue;
    }

    try {
      const metaMessageId = await sendMetaMessage({ phone: conv.phone, text });
      const nowIso = new Date().toISOString();
      conv.messages = conv.messages || [];
      conv.messages.push({
        id: newId("msg"),
        direction: "outbound",
        type: "text",
        content: text,
        timestamp: nowIso,
        meta_id: metaMessageId,
        sender_email: `ai@labo3d.batch`,
        ai_generated: true,
        batch: true,
        delivery_status: "sent",
      });
      conv.last_message_at = nowIso;
      conv.unread = false;
      results.replied++;
    } catch (e) {
      results.failed++;
      results.errors.push({ conv_id: conv.id, phone: conv.phone, error: `Meta: ${String(e?.message || e).slice(0, 150)}` });
    }

    await sleep(SEND_DELAY_MS);
  }

  await saveWaLabo3d(state);

  return res.status(200).json({
    ok: true,
    ...results,
    triggered_by: userEmail,
  });
}
