// Envoi d'emails de notification (escalade humaine, etc.) via Resend.
// Partagé entre les endpoints AMIGO.

const RESEND_URL = "https://api.resend.com/emails";
const TEAM = ["anthony.donzel@gmail.com", "harold.grenouilleau@gmail.com"];
const FROM = "AMIGO <noreply@jadetech.pro>";

export async function notifyTeam({ subject, html, extraTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: "no-resend-key" };
  const to = [...TEAM, ...(extraTo || [])];
  const resp = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body?.message || `Resend ${resp.status}`);
  return { ok: true, id: body?.id };
}

export async function notifyHumanEscalation({ conv, lastMessage }) {
  const contactLabel = conv.contact_name || conv.phone;
  const subject = `🚨 [LABO 3D] Client ${contactLabel} demande un humain`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:20px auto">
    <h2 style="color:#ef4444">🚨 Escalade humaine — LABO 3D</h2>
    <p><strong>Client:</strong> ${contactLabel} (${conv.phone})</p>
    <p><strong>Dernier message reçu:</strong></p>
    <div style="background:#fee;padding:14px;border-radius:8px;border-left:3px solid #ef4444;margin:12px 0;font-style:italic">
      ${(lastMessage || "").replace(/</g,"&lt;").slice(0, 400)}
    </div>
    <p>Le bot IA s'est mis en pause automatiquement. Il faut prendre la main.</p>
    <p style="margin-top:20px">
      <a href="https://amigo-crm-gamma.vercel.app" style="display:inline-block;padding:10px 20px;background:#22c55e;color:white;border-radius:6px;text-decoration:none;font-weight:600">Ouvrir AMIGO</a>
    </p>
    <p style="font-size:11px;color:#999;margin-top:20px">— AMIGO CRM · Escalade auto</p>
  </div>`;
  return notifyTeam({ subject, html });
}
