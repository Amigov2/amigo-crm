// Envoie un email quand une nouvelle idée est déposée dans IdeasBox
// Body: { idea: { text, type, byLabel, at } }

const TYPE_LABELS = { idee: "💡 Idée", bug: "🐛 Bug", amelioration: "🚀 Amélioration" };
const RECIPIENTS = ["anthony.donzel@gmail.com", "harold.grenouilleau@gmail.com"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { idea } = req.body || {};
  if (!idea?.text) return res.status(400).json({ error: "idea.text required" });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: "RESEND_API_KEY missing" });

  const typeLabel = TYPE_LABELS[idea.type] || idea.type || "Note";
  const subject = `[AMIGO] ${typeLabel} de ${idea.byLabel || idea.by || "quelqu'un"}`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:20px auto">
    <h2 style="color:#22c55e">${typeLabel}</h2>
    <p style="color:#666;font-size:13px">Nouvelle contribution dans la boîte à idées AMIGO</p>
    <div style="background:#f5f5f5;padding:16px;border-radius:8px;border-left:3px solid #22c55e;margin:16px 0">
      <p style="margin:0;white-space:pre-wrap">${idea.text.replace(/</g,"&lt;")}</p>
    </div>
    <p style="font-size:12px;color:#999">Par : ${idea.byLabel || idea.by || "?"}<br>Le : ${new Date(idea.at || Date.now()).toLocaleString("fr-FR")}</p>
    <p style="font-size:11px;color:#bbb;margin-top:20px">— AMIGO CRM · <a href="https://amigo-crm-gamma.vercel.app" style="color:#22c55e">Ouvrir</a></p>
  </div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "AMIGO <noreply@jadetech.pro>",
      to: RECIPIENTS,
      subject,
      html,
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(500).json({ error: body?.message || "resend failed", body });
  return res.status(200).json({ ok: true, id: body?.id });
}
