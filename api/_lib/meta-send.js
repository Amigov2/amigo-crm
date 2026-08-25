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
