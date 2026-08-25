import { loadCertFromEnv } from "./_lib/cert.js";
import {
  buildRpsXml,
  buildInfRps,
  buildSignedRpsBlock,
  buildSoapEnvelope,
  sendToNotaCarioca,
  parseRecepcionarLoteResponse
} from "./_lib/nfse-rio.js";
import { loadAmigoData, updateOrder, nextRpsNumber } from "./_lib/supabase.js";

const CNPJ_3A = "21496846000134";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { orderId, env = "HOMOL", dryRun = false } = req.body || {};
    if (!orderId) return res.status(400).json({ error: "orderId required" });

    const CCM = process.env.CCM_3AIMPORT;
    if (!CCM) return res.status(500).json({ error: "CCM_3AIMPORT env missing" });

    const allData = await loadAmigoData();
    const order = (allData.orders || []).find(o => o.id === orderId);
    if (!order) return res.status(404).json({ error: `Order ${orderId} not found` });
    if (order.nfNumber) return res.status(409).json({
      error: "Order already has NFS-e",
      nfNumber: order.nfNumber,
      nfCodigoVerificacao: order.nfCodigoVerificacao
    });

    const prospect = (allData[order.proj] || []).find(p => p.id === order.prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });

    const rpsNumber = dryRun ? 999999 : await nextRpsNumber();
    const total = Number(order.amount) * Number(order.qty || 1);

    const rpsParams = {
      inscricaoMunicipal: CCM,
      cnpjPrestador: CNPJ_3A,
      rpsNumber,
      rpsSeries: "A",
      tomador: {
        cnpjOuCpf: prospect.cpf || prospect.cnpj || "",
        name: prospect.name
      },
      servico: {
        description: `${order.product || "Impressão 3D"} — ${order.qty || 1} unid.`,
        value: total,
        codigoServico: "1305",
        codigoTributacaoMunicipio: "130500188"
      }
    };

    if (dryRun) {
      return res.status(200).json({ ok: true, dryRun: true, rpsNumber, rpsXml: buildRpsXml(rpsParams) });
    }

    const cert = loadCertFromEnv();
    const infRps = buildInfRps(rpsParams);
    const signedRpsBlock = buildSignedRpsBlock(infRps, `rps${rpsNumber}`, cert.privateKeyPem, cert.certPem);
    const soap = buildSoapEnvelope(signedRpsBlock, CNPJ_3A, CCM);

    const response = await sendToNotaCarioca(soap, env, "RecepcionarLoteRps", cert.certPem, cert.privateKeyPem);
    const parsed = parseRecepcionarLoteResponse(response.body);

    if (parsed.errors.length > 0 || !parsed.protocolo) {
      await updateOrder(orderId, {
        nfStatus: "erro_envio",
        nfErrors: parsed.errors,
        nfLastTriedAt: Date.now(),
        nfRpsNumber: rpsNumber,
        nfEnv: env
      });
      return res.status(422).json({
        ok: false,
        errors: parsed.errors,
        rawResponse: response.body.slice(0, 3000)
      });
    }

    await updateOrder(orderId, {
      nfStatus: "enviado",
      nfRpsNumber: rpsNumber,
      nfProtocolo: parsed.protocolo,
      nfNumeroLote: parsed.numeroLote,
      nfEnviadoAt: Date.now(),
      nfEnv: env
    });

    return res.status(200).json({
      ok: true,
      status: "enviado",
      protocolo: parsed.protocolo,
      numeroLote: parsed.numeroLote,
      rpsNumber,
      nextStep: `Appeler /api/consult-nfse?orderId=${orderId} dans 3-10s pour récupérer le numéro NFS-e final`
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.split("\n").slice(0, 5) });
  }
}
