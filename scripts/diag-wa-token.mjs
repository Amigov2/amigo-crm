// Diagnostic : liste tout ce que le token META_WA_ACCESS_TOKEN peut voir
// Usage: node scripts/diag-wa-token.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8").split("\n").forEach(line => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  });
}
const token = env.META_WA_ACCESS_TOKEN;
if (!token) { console.error("❌ META_WA_ACCESS_TOKEN absent de .env.local"); process.exit(1); }
console.log(`Token: ${token.slice(0, 12)}...${token.slice(-6)} (${token.length} chars)\n`);

async function get(url, label) {
  console.log(`\n=== ${label} ===`);
  console.log(`GET ${url}`);
  const r = await fetch(url + (url.includes("?") ? "&" : "?") + `access_token=${token}`);
  const text = await r.text();
  try {
    const j = JSON.parse(text);
    console.log(JSON.stringify(j, null, 2));
    return j;
  } catch {
    console.log(text);
    return null;
  }
}

// 1. Token debug — révèle app_id, user_id, expiration, scopes
await get(`https://graph.facebook.com/v21.0/debug_token?input_token=${token}`, "Debug token (app + user + scopes)");

// 2. /me — qui est l'owner du token ?
await get(`https://graph.facebook.com/v21.0/me?fields=id,name`, "Who am I ?");

// 3. Businesses accessibles
await get(`https://graph.facebook.com/v21.0/me/businesses?fields=id,name`, "Businesses accessibles");

// 4. Le phone number LABO 3D est-il accessible ?
await get(`https://graph.facebook.com/v21.0/1223344024203503?fields=id,display_phone_number,verified_name,quality_rating,status`, "Phone LABO 3D (1223344024203503)");

// 5. Le WABA Locarei — pour comparer (on sait qu'il marche)
await get(`https://graph.facebook.com/v21.0/1965215307498601?fields=id,name`, "WABA Locarei (1965215307498601)");

// 6. Liste des phone numbers du WABA Locarei
await get(`https://graph.facebook.com/v21.0/1965215307498601/phone_numbers?fields=id,display_phone_number,verified_name,status`, "Phones du WABA Locarei");
