// Générateur PIX EMV statique pour LABO 3D (3A IMPORT LTDA)
// Port serveur du pixPayload() de src/App.jsx pour usage dans le bot IA webhook.

const PIX_KEY = "21496846000134"; // CNPJ 3A IMPORT LTDA
const MERCHANT_NAME = "3A IMPORT LTDA";
const MERCHANT_CITY = "RIO DE JANEIRO";

function f(id, val) {
  return id + String(val.length).padStart(2, "0") + val;
}

function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function pixPayload(amountBRL, txid) {
  const merchantAccount = f("00", "BR.GOV.BCB.PIX") + f("01", PIX_KEY);
  const additional = f("05", (txid || "***").slice(0, 25));
  let payload =
    f("00", "01") +
    f("26", merchantAccount) +
    f("52", "0000") +
    f("53", "986") +
    (amountBRL > 0 ? f("54", amountBRL.toFixed(2)) : "") +
    f("58", "BR") +
    f("59", MERCHANT_NAME.slice(0, 25)) +
    f("60", MERCHANT_CITY.slice(0, 15)) +
    f("62", additional) +
    "6304";
  return payload + crc16(payload);
}

export function pixQrCodeUrl(amountBRL, txid) {
  const emv = pixPayload(amountBRL, txid);
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(emv)}`;
}
