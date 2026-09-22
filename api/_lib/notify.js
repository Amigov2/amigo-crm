// Envoi d'emails de notification (escalade humaine, etc.) via Resend.
// Partagé entre les endpoints AMIGO.

const RESEND_URL = "https://api.resend.com/emails";
const TEAM = ["anthony.donzel@gmail.com", "harold.grenouilleau@gmail.com", "labo3drio@gmail.com"];
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

export async function notifyPendingQuote({ conv, quoteText, clientDemand, imageBase64, imageMime, approveUrl, takeUrl, priceUrl }) {
  const contactLabel = conv.contact_name || conv.phone;
  const subject = `💰 [LABO 3D] Devis à valider — ${contactLabel}`;
  const safeText = (s) => (s || "").replace(/</g, "&lt;").replace(/\n/g, "<br>");
  const imgHtml = imageBase64
    ? `<p style="margin:16px 0"><img src="data:${imageMime || "image/jpeg"};base64,${imageBase64}" style="max-width:100%;border-radius:8px;border:1px solid #ddd" /></p>`
    : "";
  // Ordre : boutons EN HAUT (Gmail tronque au-delà de ~100KB, on met le critique
  // avant la photo qui pèse lourd en base64).
  const html = `<div style="font-family:system-ui,sans-serif;max-width:640px;margin:20px auto;color:#111">
    <h2 style="color:#0ea5e9;margin-bottom:4px">💰 Devis IA à valider — ${safeText(contactLabel)}</h2>
    <p style="color:#666;margin-top:0;font-size:14px">LABO 3D · Le bot attend ton feu vert avant envoi au client.</p>
    <div style="background:#ecfeff;padding:14px;border-radius:8px;border-left:3px solid #0ea5e9;white-space:pre-wrap;margin:16px 0;font-size:14px">${safeText(quoteText)}</div>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0"><tr>
      ${approveUrl ? `<td style="padding-right:10px"><a href="${approveUrl}" style="display:inline-block;padding:16px 20px;background:#22c55e;color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">✅ Approuver et envoyer</a></td>` : ""}
      ${priceUrl ? `<td style="padding-right:10px"><a href="${priceUrl}" style="display:inline-block;padding:16px 20px;background:#0ea5e9;color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">✏️ Modifier le prix</a></td>` : ""}
      ${takeUrl ? `<td><a href="${takeUrl}" style="display:inline-block;padding:16px 20px;background:#f59e0b;color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">🖐 Prendre la main</a></td>` : ""}
    </tr></table>
    <p style="color:#666;font-size:13px;margin:0 0 20px">
      <strong>Approuver</strong> = envoie le devis tel quel au client sur WhatsApp.<br>
      <strong>Modifier le prix</strong> = ouvre un formulaire pour saisir un nouveau prix, puis envoie au client.<br>
      <strong>Prendre la main</strong> = coupe le bot, tu gères depuis AMIGO CRM.
    </p>
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0">
    <p style="margin:12px 0"><strong>Client:</strong> ${safeText(contactLabel)} (${conv.phone})</p>
    ${clientDemand ? `<p style="margin:12px 0"><strong>Dernier message client:</strong></p><div style="background:#f4f4f5;padding:12px;border-radius:8px;font-style:italic">${safeText(clientDemand.slice(0, 400))}</div>` : ""}
    ${imgHtml}
    <p style="margin-top:20px">
      <a href="https://amigo-crm-gamma.vercel.app/#/print3d/chat" style="display:inline-block;padding:10px 18px;background:#0ea5e9;color:white;border-radius:6px;text-decoration:none;font-weight:600">Ouvrir AMIGO CRM</a>
    </p>
    <p style="font-size:11px;color:#999;margin-top:20px">— AMIGO CRM · Alerte auto</p>
  </div>`;
  return notifyTeam({ subject, html });
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
