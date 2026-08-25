import forge from "node-forge";

export function loadCertFromEnv() {
  const b64 = process.env.CERT_A1_PFX_BASE64;
  const password = process.env.CERT_A1_PASSWORD;
  if (!b64) throw new Error("CERT_A1_PFX_BASE64 absent (env Vercel)");
  if (!password) throw new Error("CERT_A1_PASSWORD absent (env Vercel)");

  const der = forge.util.decode64(b64);
  const p12Asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!certBag || !keyBag) throw new Error("PFX invalide (cert ou key manquant)");

  const cert = certBag.cert;
  const privateKey = keyBag.key;
  const subject = cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(", ");
  const issuer = cert.issuer.attributes.map(a => `${a.shortName}=${a.value}`).join(", ");

  return {
    cert,
    privateKey,
    certPem: forge.pki.certificateToPem(cert),
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    subject,
    issuer,
    serialNumber: cert.serialNumber,
    validFrom: cert.validity.notBefore.toISOString(),
    validTo: cert.validity.notAfter.toISOString()
  };
}
