import { getSupabase, loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";

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
  let { conversation_id, phone, text, template_name, variables } = body;

  if (!text && !template_name) {
    return res.status(400).json({ error: "text or template_name required" });
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
    metaMessageId = await sendMetaMessage({ phone: conv.phone, text: finalText });
  } catch (err) {
    return res.status(502).json({ error: `Meta send failed: ${err.message}` });
  }

  // Enregistre côté AMIGO
  const now = new Date().toISOString();
  const msg = {
    id: newId("msg"),
    direction: "outbound",
    type: "text",
    content: finalText,
    timestamp: now,
    meta_id: metaMessageId,
    sender_email: userEmail,
    template_name: template_name || null,
    delivery_status: "sent"
  };
  conv.messages.push(msg);
  conv.last_message_at = now;
  conv.unread = false;

  await saveWaLabo3d(state);

  return res.status(200).json({
    ok: true,
    conversation_id: conv.id,
    message_id: msg.id,
    meta_id: metaMessageId
  });
}
