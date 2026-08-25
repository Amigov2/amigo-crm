// Route one-shot pour register un numéro WhatsApp Cloud API
// Usage : POST /api/wa-register?phone_number_id=1341579219030949&pin=112233

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "POST or GET only" });
  }
  const phoneId = (req.query?.phone_number_id) || (req.body?.phone_number_id) || process.env.META_WA_PHONE_NUMBER_ID_LABO3D;
  const pin = (req.query?.pin) || (req.body?.pin) || "112233";
  if (!phoneId) return res.status(400).json({ error: "phone_number_id required (query param ou env META_WA_PHONE_NUMBER_ID_LABO3D)" });
  const token = process.env.META_WA_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "META_WA_ACCESS_TOKEN absent from env" });
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/register`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messaging_product: "whatsapp", pin: String(pin) })
    });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    return res.status(r.status).json({
      httpStatus: r.status,
      phoneNumberId: phoneId,
      pinTried: pin,
      metaResponse: body
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.split("\n").slice(0, 5) });
  }
}
