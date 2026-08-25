import { loadCertFromEnv } from "./_lib/cert.js";

export default function handler(req, res) {
  try {
    const info = loadCertFromEnv();
    const now = new Date();
    const expiresIn = Math.round((new Date(info.validTo) - now) / 86400000);

    res.status(200).json({
      ok: true,
      subject: info.subject,
      issuer: info.issuer,
      serialNumber: info.serialNumber,
      validFrom: info.validFrom,
      validTo: info.validTo,
      expiresInDays: expiresIn,
      warning: expiresIn < 30 ? `Certificat expire dans ${expiresIn} jours — renouvelle vite !` : null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
