const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://sujdarqrksqwcmtapcjw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1amRhcnFya3Nxd2NtdGFwY2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzI1NDgsImV4cCI6MjA4ODc0ODU0OH0.X1UaTAq6zdxwYCoAllUDE_GoTS-TlvgZrK1OWKkc_nM"
);

const EMAIL_FIXES = {
  "contact@leconservatoiredumaquillage.fr": "contact@cdm-paris.com",
  "academy@makeupforever.com": "hoyon@makeupforever.fr",
  "contact@slamakeupacademy.com": "contact@sla-academy.fr",
  "contact@lisaa.com": "admissions@lisaa.com",
  "paris@ecoleterrade.com": "emailcontact@ecoleterrade.com",
  "bordeaux@ecoleterrade.com": "emailcontact@ecoleterrade.com",
  "contact@ecole-fam.com": "contact@ecole-fam.fr",
  "s.renard@academie-maquillage.fr": null,
  "contact@efmm.fr": null,
  "a.fontaine@modshair.fr": null,
  "carole.dupuis@isma-bordeaux.fr": null,
  "t.morel@cfa-beaute-nantes.fr": null,
  "contact@cfa-beaute-marseille.fr": null,
  "contact@ife-toulouse.fr": null,
  "contact@ema-strasbourg.fr": null,
};

async function run() {
  const { data: row, error } = await supabase
    .from("amigo_data")
    .select("value")
    .eq("key", "amigo-v9")
    .single();

  if (error) { console.error("Erreur lecture:", error); return; }

  const allData = JSON.parse(row.value);
  let prospects = allData.makeup || [];
  console.log(`\n${prospects.length} prospects makeup trouvés\n`);

  let updated = 0;
  let removed = [];

  prospects = prospects.filter(p => {
    if (!p.email) return true;

    if (p.email in EMAIL_FIXES) {
      const newEmail = EMAIL_FIXES[p.email];
      if (newEmail === null) {
        console.log(`  x SUPPRIME: ${p.name} (${p.email})`);
        removed.push(p.name);
        return false;
      } else {
        console.log(`  v CORRIGE: ${p.name} -- ${p.email} -> ${newEmail}`);
        p.email = newEmail;
        updated++;
        return true;
      }
    }
    return true;
  });

  console.log(`\n--- Resume ---`);
  console.log(`Corriges: ${updated}`);
  console.log(`Supprimes: ${removed.length} (${removed.join(", ")})`);
  console.log(`Restants: ${prospects.length}`);
  console.log(`\nProspects avec email valide:`);
  prospects.filter(p => p.email).forEach(p => console.log(`  ${p.name} -- ${p.email}`));

  allData.makeup = prospects;

  const { error: saveError } = await supabase
    .from("amigo_data")
    .upsert({ key: "amigo-v9", value: JSON.stringify(allData), updated_at: new Date().toISOString() });

  if (saveError) { console.error("Erreur sauvegarde:", saveError); return; }
  console.log("\nBase mise a jour !");
}

run();
