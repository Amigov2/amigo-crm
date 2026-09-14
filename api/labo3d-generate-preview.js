// Endpoint dédié : reçoit un job de génération de prévia IA d'une pièce imprimée
// 3D. Fait tout le pipeline sync (Nano Banana → upload → watermark → send Meta)
// puis met à jour l'état de la conv.
//
// Appelé en fire-and-forget depuis wa-labo3d-webhook.js quand le bot décide de
// générer une prévia (tag GENERATE_PREVIEW).
//
// Sécurité : header x-internal-secret vérifié pour éviter qu'un externe déclenche.

import { loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";
import { nanoRenderPrintedFigurine } from "./_lib/nano-render.js";
import { uploadImageForMeshy } from "./_lib/supabase-storage.js";
import { watermarkImageAndUpload } from "./_lib/watermark.js";
import { sendMetaMessage, sendMetaImageByUrl } from "./_lib/meta-send.js";
import { notifyHumanEscalation } from "./_lib/notify.js";
import { pushToAllSubscribers } from "./_lib/push.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const internalSecret = process.env.INTERNAL_SECRET;
  if (internalSecret && req.headers["x-internal-secret"] !== internalSecret) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { conv_id, image_url, prompt } = req.body || {};
  if (!conv_id || !image_url || !prompt) {
    return res.status(400).json({ error: "missing conv_id, image_url or prompt" });
  }

  let state;
  try {
    state = await loadWaLabo3d();
  } catch (e) {
    console.error("[nano-preview] load state failed:", e.message);
    return res.status(500).json({ error: e.message });
  }
  const conv = (state.conversations || []).find((c) => c.id === conv_id);
  if (!conv) {
    console.error("[nano-preview] conv not found:", conv_id);
    return res.status(404).json({ error: "conv not found" });
  }

  console.log("[nano-preview] start conv=", conv_id, "prompt=", prompt.slice(0, 120));

  try {
    // 1. Génère l'image via Nano Banana (~5-10s)
    const t0 = Date.now();
    const out = await nanoRenderPrintedFigurine({ image_url, prompt });
    console.log("[nano-preview] nano done in", Date.now() - t0, "ms, out size=", out.base64.length);

    // 2. Upload raw output sur Supabase
    const rawBuf = Buffer.from(out.base64, "base64");
    const rawUrl = await uploadImageForMeshy({
      buffer: rawBuf,
      filename: `nano-${conv_id}-${Date.now()}.png`,
      mimeType: out.mimeType,
    });

    // 3. Watermark
    let watermarkedUrl = rawUrl;
    try {
      watermarkedUrl = await watermarkImageAndUpload(rawUrl, conv_id);
    } catch (wmErr) {
      console.error("[nano-preview] watermark failed, using raw:", wmErr.message);
    }

    // 4. Envoi WhatsApp au client
    const now = new Date().toISOString();
    await sendMetaMessage({
      phone: conv.phone,
      text: "Prévia da sua peça prontinha! Olha só como ela deve ficar depois de impressa 👇\n\n⚠️ *Importante:* isso é uma prévia gerada por IA pra te dar uma noção. O modelo final vai ser refeito na mão pelo Anthony com mais detalhe e acabamento — bem melhor que essa prévia!\n\nSe aprovar a direção, é só me falar 'sim' que mando o PIX pra começar a modelagem definitiva.",
    });
    try {
      await sendMetaImageByUrl({
        phone: conv.phone,
        imageUrl: watermarkedUrl,
        caption: "🎨 Prévia IA — LABO 3D",
      });
    } catch (imgErr) {
      console.error("[nano-preview] image send failed:", imgErr.message);
    }

    // 5. Update conv state
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

    console.log("[nano-preview] sent conv=", conv_id, "count=", conv.meshy_preview_count);
    return res.status(200).json({ ok: true, preview_count: conv.meshy_preview_count });
  } catch (e) {
    console.error("[nano-preview] failed conv=", conv_id, e.message);
    // Escalade humain sur échec
    try {
      conv.pending_meshy = {
        ...(conv.pending_meshy || {}),
        completed_at: new Date().toISOString(),
        error: e.message,
        backend: "nano",
      };
      conv.ai_auto = false;
      conv.status = "escalado_humano";
      conv.escalated_at = new Date().toISOString();
      await saveWaLabo3d(state);
      try {
        await sendMetaMessage({
          phone: conv.phone,
          text: "Opa, tive um problema técnico gerando a prévia 😅 Vou passar direto pro Anthony que te ajuda pessoalmente em minutos!",
        });
      } catch {}
      await notifyHumanEscalation({ conv, lastMessage: "🎨 Nano prévia FAILED — passer en manuel" });
      try {
        await pushToAllSubscribers({
          title: `🚨 PRÉVIA IA FAIL — ${conv.contact_name || conv.phone}`,
          body: e.message.slice(0, 100),
          url: "/#/print3d/chat",
        });
      } catch {}
    } catch (e2) {
      console.error("[nano-preview] failure handling failed:", e2.message);
    }
    return res.status(500).json({ error: e.message });
  }
}
