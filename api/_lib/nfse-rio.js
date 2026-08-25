import { SignedXml } from "xml-crypto";
import https from "node:https";

const NOTA_CARIOCA_WSDL_PROD = "https://notacarioca.rio.gov.br/WSNacional/nfse.asmx";
const NOTA_CARIOCA_WSDL_HOMOL = "https://notacariocahom.rio.gov.br/WSNacional/nfse.asmx";

export const NFSE_ENV = {
  PROD: NOTA_CARIOCA_WSDL_PROD,
  HOMOL: NOTA_CARIOCA_WSDL_HOMOL
};

function escapeXml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function todayBR() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Construit un InfRps au format ABRASF v1.00 Nota Carioca.
 * Le résultat doit ensuite être enveloppé dans <Rps> + signé.
 */
export function buildInfRps(p) {
  const dataEmissao = `${todayBR()}T${new Date().toISOString().slice(11, 19)}`;
  const valor = Number(p.servico.value).toFixed(2);
  const tomadorIsCnpj = (p.tomador.cnpjOuCpf || "").replace(/\D/g, "").length === 14;
  const tomadorDoc = (p.tomador.cnpjOuCpf || "").replace(/\D/g, "");

  return `<InfRps Id="rps${p.rpsNumber}"><IdentificacaoRps><Numero>${p.rpsNumber}</Numero><Serie>${escapeXml(p.rpsSeries || "A")}</Serie><Tipo>1</Tipo></IdentificacaoRps><DataEmissao>${dataEmissao}</DataEmissao><NaturezaOperacao>1</NaturezaOperacao><OptanteSimplesNacional>1</OptanteSimplesNacional><IncentivadorCultural>2</IncentivadorCultural><Status>1</Status><Servico><Valores><ValorServicos>${valor}</ValorServicos><IssRetido>2</IssRetido></Valores><ItemListaServico>${escapeXml(p.servico.codigoServico || "1305")}</ItemListaServico><CodigoTributacaoMunicipio>${escapeXml(p.servico.codigoTributacaoMunicipio || "130500188")}</CodigoTributacaoMunicipio><Discriminacao>${escapeXml(p.servico.description)}</Discriminacao><CodigoMunicipio>3304557</CodigoMunicipio></Servico><Prestador><Cnpj>${escapeXml(p.cnpjPrestador)}</Cnpj><InscricaoMunicipal>${escapeXml(p.inscricaoMunicipal)}</InscricaoMunicipal></Prestador><Tomador><IdentificacaoTomador><CpfCnpj>${tomadorIsCnpj ? `<Cnpj>${tomadorDoc}</Cnpj>` : `<Cpf>${tomadorDoc}</Cpf>`}</CpfCnpj></IdentificacaoTomador><RazaoSocial>${escapeXml(p.tomador.name)}</RazaoSocial></Tomador></InfRps>`;
}

// Alias rétro-compat (le code appelle encore buildRpsXml en dry-run)
export function buildRpsXml(p) {
  const infRps = buildInfRps(p);
  return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd">
  <LoteRps Id="lote1">
    <NumeroLote>1</NumeroLote>
    <Cnpj>${escapeXml(p.cnpjPrestador)}</Cnpj>
    <InscricaoMunicipal>${escapeXml(p.inscricaoMunicipal)}</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps><Rps>${infRps}</Rps></ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;
}

/**
 * Signe le XML RPS avec le cert A1.
 * @param {string} xml
 * @param {string} privateKeyPem
 * @param {string} certPem
 * @param {string} referenceXPath — ex "//*[@Id='rps123']"
 */
export function signXml(xml, privateKeyPem, certPem, referenceXPath) {
  const sig = new SignedXml({ privateKey: privateKeyPem });
  sig.publicCert = certPem;
  sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
  sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
  sig.addReference({
    xpath: referenceXPath,
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
    ]
  });
  sig.computeSignature(xml);
  return sig.getSignedXml();
}

/**
 * Enveloppe SOAP pour RecepcionarLoteRps de Nota Carioca.
 * À AJUSTER avec le WSDL exact de Nota Carioca (action SOAP + namespace).
 */
/**
 * Construit l'enveloppe SOAP pour RecepcionarLoteRps.
 * signedRpsBlock = bloc <Rps><InfRps>...</InfRps><Signature/></Rps> déjà signé
 * cnpj, im = données du prestador pour LoteRps
 */
export function buildSoapEnvelope(signedRpsBlock, cnpj, im) {
  const cleanRps = signedRpsBlock.replace(/^<\?xml[^>]*\?>\s*/i, "");

  const inner = `<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd"><LoteRps Id="lote1"><NumeroLote>1</NumeroLote><Cnpj>${cnpj}</Cnpj><InscricaoMunicipal>${im}</InscricaoMunicipal><QuantidadeRps>1</QuantidadeRps><ListaRps>${cleanRps}</ListaRps></LoteRps></EnviarLoteRpsEnvio>`;

  const innerEscaped = inner.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RecepcionarLoteRpsRequest xmlns="http://notacarioca.rio.gov.br/">
      <inputXML>${innerEscaped}</inputXML>
    </RecepcionarLoteRpsRequest>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Signe un InfRps et le wrap dans <Rps>...</Rps> avec la Signature.
 */
export function buildSignedRpsBlock(infRpsXml, rpsId, privateKeyPem, certPem) {
  // On signe le InfRps directement (référence Id="rps123")
  const wrapped = `<Rps>${infRpsXml}</Rps>`;
  return signXml(wrapped, privateKeyPem, certPem, `//*[@Id='${rpsId}']`);
}

export async function sendToNotaCarioca(soapXml, env = "HOMOL", soapAction = "RecepcionarLoteRps", certPem, privateKeyPem) {
  const url = new URL(env === "PROD" ? NOTA_CARIOCA_WSDL_PROD : NOTA_CARIOCA_WSDL_HOMOL);
  if (!certPem || !privateKeyPem) throw new Error("certPem + privateKeyPem requis pour mTLS Nota Carioca");

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: "POST",
      cert: certPem,
      key: privateKeyPem,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": `http://notacarioca.rio.gov.br/${soapAction}`,
        "Content-Length": Buffer.byteLength(soapXml, "utf8")
      },
      timeout: 30000
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(new Error("Timeout Nota Carioca (30s)")); });
    req.write(soapXml);
    req.end();
  });
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTag(xml, tag) {
  const decoded = decodeEntities(xml);
  const m = decoded.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : null;
}

function extractAll(xml, tag) {
  const decoded = decodeEntities(xml);
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  return [...decoded.matchAll(re)].map(m => m[1]);
}

/**
 * Parse la réponse de RecepcionarLoteRps.
 * Retourne { protocolo, numeroLote, dataRecebimento, errors }
 */
export function parseRecepcionarLoteResponse(soapBody) {
  const errs = extractAll(soapBody, "MensagemRetorno").map(m => ({
    code: extractTag(m, "Codigo"),
    message: extractTag(m, "Mensagem"),
    correction: extractTag(m, "Correcao")
  }));
  return {
    protocolo: extractTag(soapBody, "Protocolo"),
    numeroLote: extractTag(soapBody, "NumeroLote"),
    dataRecebimento: extractTag(soapBody, "DataRecebimento"),
    errors: errs
  };
}

/**
 * Construit la requête SOAP pour consulter un lot par protocolo.
 */
export function buildConsultarLoteSoap(protocolo, cnpj, im) {
  const inner = `<ConsultarLoteRpsEnvio xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd"><Prestador><Cnpj>${cnpj}</Cnpj><InscricaoMunicipal>${im}</InscricaoMunicipal></Prestador><Protocolo>${protocolo}</Protocolo></ConsultarLoteRpsEnvio>`;

  const innerEscaped = inner.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ConsultarLoteRpsRequest xmlns="http://notacarioca.rio.gov.br/">
      <inputXML>${innerEscaped}</inputXML>
    </ConsultarLoteRpsRequest>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Parse la réponse de ConsultarLoteRps.
 * Retourne { nfes: [{ numero, codigoVerificacao, dataEmissao, xml }], errors }
 */
export function parseConsultarLoteResponse(soapBody) {
  const nfes = extractAll(soapBody, "Nfse").map(inner => ({
    numero: extractTag(inner, "Numero"),
    codigoVerificacao: extractTag(inner, "CodigoVerificacao"),
    dataEmissao: extractTag(inner, "DataEmissao") || extractTag(inner, "DataEmissaoNfse"),
    xml: inner
  }));
  const errs = extractAll(soapBody, "MensagemRetorno").map(m => ({
    code: extractTag(m, "Codigo"),
    message: extractTag(m, "Mensagem")
  }));
  return { nfes, errors: errs };
}

/**
 * Lien public pour vérifier l'authenticité d'une NFS-e Carioca.
 */
export function urlValidacaoNotaCarioca(cnpj, numeroNfse, codigoVerificacao) {
  return `https://notacarioca.rio.gov.br/contribuinte/notaprint.aspx?ccm=&inscricao=&nf=${numeroNfse}&cod=${codigoVerificacao}&v=`;
}
