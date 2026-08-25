export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: "amigo-crm-api",
    time: new Date().toISOString(),
    nfseEndpoint: "/api/emit-nfse",
    certEndpoint: "/api/cert-info"
  });
}
