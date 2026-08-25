import { loadCertFromEnv } from "./_lib/cert.js";
import {
  signXml,
  buildConsultarLoteSoap,
  sendToNotaCarioca,
  parseConsultarLoteResponse,
  urlValidacaoNotaCarioca
} from "./_lib/nfse-rio.js";
import { loadAmigoData, updateOrder } from "./_lib/supabase.js";

const CNPJ_3A = "21496846000134";

export default async function handler(req, res) {
  try {
    const orderId = req.method === "GET" ? req.query.orderId : req.body?.orderId;
    if (!orderId) return res.status(400).json({ error: "orderId required" });

    const CCM = process.env.CCM_3AIMPORT;
    if (!CCM) return res.status(500).json({ error: "CCM_3AIMPORT env missing" });

    const allData = await loadAmigoData();
    const order = (allData.orders || []).find(o => o.id === orderId);
    if (!order) return res.status(404).json({ error: `Order ${orderId} not found` });
    if (!order.nfProtocolo) return res.status(409).json({ error: "Order n'a pas été envoyée à Nota Carioca (nfProtocolo manquant)" });
    if (order.nfNumber) return res.status(200).json({
      ok: true,
      status: "deja_emise",
      nfNumber: order.nfNumber,
      nfCodigoVerificacao: order.nfCodigoVerificacao,
      validacaoUrl: urlValidacaoNotaCarioca(CNPJ_3A, order.nfNumber, order.nfCodigoVerificacao)
    });

    const env = order.nfEnv || "HOMOL";
    const cert = loadCertFromEnv();
    const soap = buildConsultarLoteSoap(order.nfProtocolo, CNPJ_3A, CCM);
    const response = await sendToNotaCarioca(soap, env, "ConsultarLoteRps", cert.certPem, cert.privateKeyPem);
    const parsed = parseConsultarLoteResponse(response.body);

    if (parsed.errors.length > 0 && parsed.nfes.length === 0) {
      return res.status(422).json({
        ok: false,
        status: "erro_consulta",
        errors: parsed.errors,
        rawResponse: response.body.slice(0, 3000)
      });
    }

    if (parsed.nfes.length === 0) {
      return res.status(200).json({
        ok: true,
        status: "em_processamento",
        message: "NFS-e pas encore traitée par la mairie, réessayer dans quelques secondes"
      });
    }

    const nfe = parsed.nfes[0];
    // Validation : le numéro NFS-e Nota Carioca est TOUJOURS numérique.
    // Si le parser XML a chopé autre chose (bloc erreur, tag Numero du RPS, etc.),
    // on refuse de stocker dans nfNumber pour éviter de bloquer la commande.
    const numeroValide = nfe.numero && /^\d+$/.test(String(nfe.numero).trim());
    if (!numeroValide) {
      await updateOrder(orderId, {
        nfStatus: "erro_parse",
        nfErrors: [{ code: "PARSE", message: `nfe.numero invalide (non-numérique) : ${nfe.numero}` }],
        nfLastTriedAt: Date.now()
      });
      return res.status(422).json({
        ok: false,
        status: "erro_parse",
        error: `Numéro NFS-e invalide reçu : ${nfe.numero}`,
        rawNfe: nfe
      });
    }
    await updateOrder(orderId, {
      nfStatus: "emitida",
      nfNumber: nfe.numero,
      nfCodigoVerificacao: nfe.codigoVerificacao,
      nfDataEmissao: nfe.dataEmissao,
      nfXml: nfe.xml,
      nfEmitidaAt: Date.now()
    });

    return res.status(200).json({
      ok: true,
      status: "emitida",
      nfNumber: nfe.numero,
      nfCodigoVerificacao: nfe.codigoVerificacao,
      dataEmissao: nfe.dataEmissao,
      validacaoUrl: urlValidacaoNotaCarioca(CNPJ_3A, nfe.numero, nfe.codigoVerificacao)
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.split("\n").slice(0, 5) });
  }
}
