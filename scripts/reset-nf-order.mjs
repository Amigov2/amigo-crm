// Reset les champs nf* d'une commande AMIGO bloquée par un nfNumber pourri.
// Usage : node scripts/reset-nf-order.mjs
// Cible : JADE BRESIL R$500 date 2026-08-25 (adapter FILTER ci-dessous si besoin)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mqaalshpmxzdyjcnxwuc.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xYWFsc2hwbXh6ZHlqY254d3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODIzNzQsImV4cCI6MjA5Njc1ODM3NH0.Y0ZPx8IwwKp-T5OqOYkqhzYygKX6RIqUlXyU49wuBv8";

const FILTER = o =>
  o.prospectName?.includes("JADE BRESIL") &&
  Number(o.amount) === 500 &&
  o.date === "2026-08-25";

const NF_FIELDS = [
  "nfNumber", "nfStatus", "nfProtocolo", "nfEnviadoAt", "nfEmitidaAt",
  "nfErrors", "nfLastTriedAt", "nfRpsNumber", "nfEnv",
  "nfCodigoVerificacao", "nfNumeroLote", "nfDataEmissao", "nfXml"
];

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

const { data, error } = await sb
  .from("amigo_data")
  .select("value")
  .eq("key", "orders")
  .single();

if (error) { console.error("Erreur load:", error); process.exit(1); }

const orders = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
const candidates = orders.filter(FILTER);

console.log(`Candidats trouvés : ${candidates.length}`);
candidates.forEach(o => console.log("  -", { id: o.id, product: o.product, amount: o.amount, date: o.date, nfNumber: o.nfNumber, nfStatus: o.nfStatus }));

if (candidates.length !== 1) {
  if (candidates.length === 0) {
    console.log("\nAucun candidat exact. Toutes les commandes JADE BRESIL R$500 :");
    orders
      .filter(o => o.prospectName?.includes("JADE BRESIL") && Number(o.amount) === 500)
      .forEach(o => console.log("  -", { id: o.id, date: o.date, product: o.product, nfNumber: o.nfNumber }));
  }
  process.exit(1);
}

const o = candidates[0];
console.log("\nReset ID:", o.id);
console.log("Avant :", Object.fromEntries(NF_FIELDS.filter(f => f in o).map(f => [f, o[f]])));

for (const f of NF_FIELDS) delete o[f];

const { error: upErr } = await sb
  .from("amigo_data")
  .upsert({ key: "orders", value: JSON.stringify(orders), updated_at: new Date().toISOString() });

if (upErr) { console.error("Erreur save:", upErr); process.exit(1); }
console.log("\n✓ Reset OK — refresh AMIGO dans le browser");
