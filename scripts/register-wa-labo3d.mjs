// Register un numéro WhatsApp Cloud API stuck "En attente"
// Usage:
//   1. Créer .env.local dans le repo AMIGO avec:
//      META_WA_ACCESS_TOKEN=EAA... (token de l'app "Labo 3D API", 24h validité)
//      META_WA_PHONE_NUMBER_ID_LABO3D=1223344024203503 (nouveau id après re-création WABA 27/08/2026)
//   2. node scripts/register-wa-labo3d.mjs
//
// Le fichier .env.local est déjà dans .gitignore (patterns .env / .env.*)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach(line => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  });
} else {
  console.error(`❌ Fichier ${envPath} introuvable.`);
  console.error(`Crée-le avec :`);
  console.error(`  META_WA_ACCESS_TOKEN=EAA... (récupérable dans Vercel dashboard → projet amigo-labo3d → Settings → Environment Variables)`);
  console.error(`  META_WA_PHONE_NUMBER_ID_LABO3D=1341579219030949`);
  process.exit(1);
}

const token = env.META_WA_ACCESS_TOKEN;
const phoneId = env.META_WA_PHONE_NUMBER_ID_LABO3D || "1223344024203503";
const pin = env.META_WA_PIN || "112233";

if (!token) { console.error("❌ META_WA_ACCESS_TOKEN manquant dans .env.local"); process.exit(1); }

console.log(`→ Register phone_number_id=${phoneId} avec PIN=${pin}`);
console.log(`→ Token: ${token.slice(0, 12)}...${token.slice(-6)} (${token.length} chars)`);

const url = `https://graph.facebook.com/v21.0/${phoneId}/register`;
const r = await fetch(url, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ messaging_product: "whatsapp", pin: String(pin) })
});
const text = await r.text();
console.log(`\n← HTTP ${r.status}`);
try {
  const json = JSON.parse(text);
  console.log(JSON.stringify(json, null, 2));
  if (json.success === true) {
    console.log("\n✅ SUCCESS — numéro activé. Test immédiatement en envoyant un WhatsApp au +55 21 97450-9981");
  } else if (json.error) {
    console.log(`\n❌ Meta error [${json.error.code}]: ${json.error.message}`);
    if (json.error.error_data) console.log("Details:", json.error.error_data);
  }
} catch {
  console.log(text);
}
