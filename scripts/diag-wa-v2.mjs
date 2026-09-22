// Diagnostic V2 — trouve tous les WABAs et phone numbers accessibles au token
// Usage: node scripts/diag-wa-v2.mjs

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
if (!token) { console.error("❌ META_WA_ACCESS_TOKEN absent"); process.exit(1); }

const APP_ID = "2106417340270048"; // Labo 3D
const USER_ID = "122110361493433329"; // Labo3d system user

async function get(url, label) {
  console.log(`\n═══ ${label} ═══`);
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

// Tenter tous les endpoints qui listent des WABAs
await get(`https://graph.facebook.com/v21.0/${USER_ID}?fields=id,name,assigned_business_asset_groups`, "System User assets");
await get(`https://graph.facebook.com/v21.0/${APP_ID}/subscribed_apps`, "App subscribed_apps");
await get(`https://graph.facebook.com/v21.0/${APP_ID}?fields=owner_business,id,name,category`, "App owner_business");
await get(`https://graph.facebook.com/v21.0/${USER_ID}/assigned_whatsapp_business_accounts`, "SysUser assigned_whatsapp_business_accounts");

// Tester tous les WABA IDs qu'on connait
for (const wabaId of ["1965215307498601", "1658819425358172"]) {
  await get(`https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,status,quality_rating,name_status`, `WABA ${wabaId} phones`);
}

// Tester le phone number direct via différents chemins
for (const phoneId of ["1223344024203503", "1269713672884550"]) {
  await get(`https://graph.facebook.com/v21.0/${phoneId}?fields=id,display_phone_number,verified_name,status,quality_rating,name_status,account_mode`, `Phone ${phoneId}`);
}
