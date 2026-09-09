// Helper d'envoi Meta WhatsApp Cloud API — partagé entre wa-labo3d-send (endpoint
// utilisateur avec JWT) et l'appel AI en fire-and-forget depuis le webhook.

const META_GRAPH_VERSION = "v20.0";

export async function sendMetaMessage({ phone, text, phoneNumberId, accessToken }) {
  const phoneId = phoneNumberId || process.env.META_WA_PHONE_NUMBER_ID_LABO3D;
  const token = accessToken || process.env.META_WA_ACCESS_TOKEN;
  if (!phoneId) throw new Error("META_WA_PHONE_NUMBER_ID_LABO3D absent");
  if (!token) throw new Error("META_WA_ACCESS_TOKEN absent");

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone.replace(/^\+/, ""),
    type: "text",
    text: { body: text, preview_url: true },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) {
    const err = data?.error?.message || `Meta API error ${resp.status}`;
    throw new Error(err);
  }
  return data.messages?.[0]?.id || null;
}

export async function sendMetaImageByUrl({ phone, imageUrl, caption, phoneNumberId, accessToken }) {
  const phoneId = phoneNumberId || process.env.META_WA_PHONE_NUMBER_ID_LABO3D;
  const token = accessToken || process.env.META_WA_ACCESS_TOKEN;
  if (!phoneId) throw new Error("META_WA_PHONE_NUMBER_ID_LABO3D absent");
  if (!token) throw new Error("META_WA_ACCESS_TOKEN absent");

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone.replace(/^\+/, ""),
    type: "image",
    image: { link: imageUrl, caption: caption || "" },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Meta API error ${resp.status}`);
  return data.messages?.[0]?.id || null;
}

// Upload une image binaire vers Meta Media API, retourne media_id (24h validité)
// Preferable à sendMetaImageByUrl quand l'URL externe est peu fiable (api.qrserver.com)
export async function uploadMetaMedia({ buffer, mimeType, filename, phoneNumberId, accessToken }) {
  const phoneId = phoneNumberId || process.env.META_WA_PHONE_NUMBER_ID_LABO3D;
  const token = accessToken || process.env.META_WA_ACCESS_TOKEN;
  if (!phoneId || !token) throw new Error("phoneId/token missing");

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", new Blob([buffer], { type: mimeType }), filename || "upload");

  const resp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneId}/media`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
    body: form,
  });
  const data = await resp.json();
  if (!resp.ok || !data.id) throw new Error(data?.error?.message || `Meta upload error ${resp.status}`);
  return data.id;
}

// Envoi d'un template WhatsApp approuvé — seule voie autorisée hors fenêtre 24h.
// variables : tableau ordonné pour {{1}}, {{2}}, ... du corps. Ex: ["Maurício"] pour {{1}}.
export async function sendMetaTemplate({ phone, template_name, language, variables, phoneNumberId, accessToken }) {
  const phoneId = phoneNumberId || process.env.META_WA_PHONE_NUMBER_ID_LABO3D;
  const token = accessToken || process.env.META_WA_ACCESS_TOKEN;
  if (!phoneId) throw new Error("META_WA_PHONE_NUMBER_ID_LABO3D absent");
  if (!token) throw new Error("META_WA_ACCESS_TOKEN absent");
  if (!template_name) throw new Error("template_name required");

  const components = [];
  if (Array.isArray(variables) && variables.length > 0) {
    components.push({
      type: "body",
      parameters: variables.map(v => ({ type: "text", text: String(v) })),
    });
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone.replace(/^\+/, ""),
    type: "template",
    template: {
      name: template_name,
      language: { code: language || "pt_BR" },
      ...(components.length ? { components } : {}),
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Meta API error ${resp.status}`);
  return data.messages?.[0]?.id || null;
}

export async function sendMetaImageByMediaId({ phone, mediaId, caption, phoneNumberId, accessToken }) {
  const phoneId = phoneNumberId || process.env.META_WA_PHONE_NUMBER_ID_LABO3D;
  const token = accessToken || process.env.META_WA_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone.replace(/^\+/, ""),
    type: "image",
    image: { id: mediaId, caption: caption || "" },
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Meta API error ${resp.status}`);
  return data.messages?.[0]?.id || null;
}
