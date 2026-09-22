// Magic-link d'approbation devis pending (email → 1 clic).
// HMAC-SHA256(conv + "|" + action) avec META_APP_SECRET.

import crypto from "node:crypto";

export function verifySig(conv, action, sig) {
  const secret = process.env.META_APP_SECRET || "";
  if (!secret || !sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${conv}|${action}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export function buildApprovalLink(convId, action) {
  const secret = process.env.META_APP_SECRET || "";
  const sig = crypto.createHmac("sha256", secret).update(`${convId}|${action}`).digest("hex");
  const base = process.env.APPROVAL_BASE_URL || "https://amigo-crm-gamma.vercel.app";
  return `${base}/api/wa-labo3d-webhook?approve=1&conv=${encodeURIComponent(convId)}&action=${action}&sig=${sig}`;
}

export function approvalHtmlPage(code, title, message, color = "#0ea5e9") {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;background:#f4f4f5;margin:0;padding:40px 20px;">
  <div style="max-width:520px;margin:auto;background:white;border-radius:12px;padding:28px 24px;box-shadow:0 4px 12px rgba(0,0,0,0.08)">
    <h1 style="color:${color};margin:0 0 16px">${title}</h1>
    <div style="color:#333;line-height:1.5">${message}</div>
    <p style="margin-top:28px"><a href="https://amigo-crm-gamma.vercel.app/#/print3d/chat" style="display:inline-block;padding:10px 18px;background:#0ea5e9;color:white;border-radius:6px;text-decoration:none;font-weight:600">Ouvrir AMIGO CRM</a></p>
  </div>
</body></html>`;
}
