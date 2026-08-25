// ─── AMIGO CRM — Script de peuplement Supabase v2 ────────────────────────────
// Lance depuis le terminal Mac :
//   cd /Users/AD/Documents/GitHub/amigo-crm && node seed.js
// Anti-doublon par nom — ne touche JAMAIS aux données existantes

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://sujdarqrksqwcmtapcjw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1amRhcnFya3Nxd2NtdGFwY2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzI1NDgsImV4cCI6MjA4ODc0ODU0OH0.X1UaTAq6zdxwYCoAllUDE_GoTS-TlvgZrK1OWKkc_nM"
);

const KEY = "amigo-v9";
const uid = () => Math.random().toString(36).slice(2, 8);
const mkSchool = f => ({ id:"seed_"+uid(), valeur:0, status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, tags:[], email:"", phone:"", contact:"", note:"", _proj:"makeup", ...f });
const mk3D = f => ({ id:"seed_"+uid(), valeur:0, status:"Prospect", assignedTo:null, lastEditBy:null, lastEditAt:null, tags:[], email:"", phone:"", contact:"", note:"", _proj:"print3d", ...f });

const ECOLES = [
  // ── Maquillage classique
  mkSchool({ name:"ITM Paris — Institut des Métiers", geo:"Paris 🇫🇷", sub:"10ème", email:"contact@itmparis.com", phone:"+33 1 42 08 23 20", tags:["Prestige","Bachelor"], note:"40 ans. Bachelor maquillage, cinéma, SFX. Connections LVMH." }),
  mkSchool({ name:"Conservatoire du Maquillage", geo:"Paris 🇫🇷", sub:"Marais", email:"contact@leconservatoiredumaquillage.fr", phone:"+33 1 48 04 70 70", tags:["1er prix IMATS","SFX"], note:"Prix IMATS New York. 9 mois. Top réputation terrain." }),
  mkSchool({ name:"Make Up For Ever Academy", geo:"Paris 🇫🇷", sub:"Opéra", email:"academy@makeupforever.com", tags:["LVMH","CPF","Cinéma"], note:"LVMH. Cinéma + prothèses. RNCP reconnu. Masterclass stars." }),
  mkSchool({ name:"École F.A.M — Fashion And Makeup", geo:"Paris 🇫🇷", sub:"République", email:"contact@ecole-fam.com", tags:["Cinéma","Réseaux"], note:"3 ans. Cinéma, théâtre, réseaux. 100% réussite 2023. Masterclass Londres." }),
  mkSchool({ name:"SLA Make Up Academy", geo:"Valence 🇫🇷", sub:"Drôme", email:"contact@slamakeupacademy.com", tags:["CPF","International"], note:"25 ans. Campus Valence + Sydney, Chypre, Suisse. Qualiopi." }),
  mkSchool({ name:"École Sophie Lecomte", geo:"Aix-en-Provence 🇫🇷", email:"contact@sophie-lecomte.com", tags:["Pionnière"], note:"35 ans. Pionnière France. Réseau pros cinéma." }),
  mkSchool({ name:"Peyrefitte Make-Up", geo:"Paris 🇫🇷", sub:"Pigalle", email:"contact@peyrefitte-maquillage.com", tags:["SFX","Prothèses"], note:"Spécialité SFX + prothèses. 10 mois. Pro cinéma/TV." }),
  // ── Effets spéciaux
  mkSchool({ name:"Metamorphoses — École SFX Strasbourg", geo:"Strasbourg 🇫🇷", email:"contact@metamake-up.com", tags:["SFX","Oscar","BAFTA"], note:"Référence européenne SFX. Masterclass Oscar/BAFTA/Emmy. Atelier prothèses pro." }),
  mkSchool({ name:"Metamorphoses — Campus Montpellier", geo:"Montpellier 🇫🇷", email:"montpellier@metamake-up.com", tags:["SFX","Essential FX"], note:"Essential FX 6 semaines. Même qualité Strasbourg." }),
  mkSchool({ name:"EICAR — Bachelor Plasticien Maquilleur FX", geo:"Paris 🇫🇷", sub:"Nation", email:"candidatures@eicar.fr", phone:"+33 1 53 27 05 35", tags:["Bachelor FX","Cinéma","Costumes"], note:"3 ans. Maquillage FX, costumes, décors. Partenariat MUFE/LVMH." }),
  // ── Acte Académie 4 campus
  mkSchool({ name:"Acte Académie Paris", geo:"Paris 🇫🇷", email:"paris@acte-academie.com", phone:"+33 1 40 26 01 15", tags:["4 campus","SFX"], note:"4 campus FR. Accord national possible. Partenariat Esmod." }),
  mkSchool({ name:"Acte Académie Lyon", geo:"Lyon 🇫🇷", email:"lyon@acte-academie.com", tags:["4 campus"], note:"Campus Lyon. Accord global 4 villes." }),
  mkSchool({ name:"Acte Académie Bordeaux", geo:"Bordeaux 🇫🇷", email:"bordeaux@acte-academie.com", tags:["4 campus"], note:"Campus Bordeaux." }),
  mkSchool({ name:"Acte Académie Lille", geo:"Lille 🇫🇷", email:"lille@acte-academie.com", tags:["4 campus","Nord"], note:"Partenariat Esmod Roubaix." }),
  // ── Costumes & Scénographie
  mkSchool({ name:"ENSATT — Arts et Techniques du Théâtre", geo:"Lyon 🇫🇷", sub:"5ème", email:"accueil@ensatt.fr", phone:"+33 4 78 15 05 05", tags:["Costumes","Scénographie"], note:"École nationale. Costumes scène + écran. Opéra Bastille, Comédie Française." }),
  mkSchool({ name:"ENSAD — Arts Décoratifs Paris", geo:"Paris 🇫🇷", sub:"5ème", email:"info@ensad.fr", phone:"+33 1 42 34 97 00", tags:["Arts Déco","Scénographie"], note:"Grande école nationale. Scénographie et costumes. Très sélective." }),
  mkSchool({ name:"École Duperré — Licence Costume", geo:"Paris 🇫🇷", sub:"3ème", email:"contact@duperre.org", tags:["Costumes","Cinéma"], note:"Licence costume de scène et d'écran. Cinéma, théâtre, opéra." }),
  mkSchool({ name:"École du TNS — Section Scénographie", geo:"Strasbourg 🇫🇷", email:"communication@tns.fr", phone:"+33 3 88 35 63 60", tags:["Scénographie","Théâtre"], note:"École nationale TNS. Décors + costumes." }),
  mkSchool({ name:"CFPTS — Centre Formation Techniques du Spectacle", geo:"Paris 🇫🇷", sub:"19ème", email:"cfpts@cfpts.com", tags:["Spectacle","Costumiers"], note:"Formation costumiers spectacle, théâtre, cinéma, TV." }),
  mkSchool({ name:"La FÉMIS — École Cinéma", geo:"Paris 🇫🇷", sub:"18ème", email:"contact@femis.fr", phone:"+33 1 53 41 21 00", tags:["Cinéma","Décors","Prestige"], note:"L'école cinéma française. Département Décor. Contacts clés." }),
  mkSchool({ name:"ESMOD Paris", geo:"Paris 🇫🇷", sub:"9ème", email:"paris@esmod.com", phone:"+33 1 44 83 81 50", tags:["Mode","Design textile"], note:"Grande école mode. Costumes de scène + défilés. 5 campus FR." }),
  mkSchool({ name:"ESMOD Lyon", geo:"Lyon 🇫🇷", email:"lyon@esmod.com", tags:["Mode","Campus"], note:"Campus Lyon ESMOD." }),
  mkSchool({ name:"ESMOD Bordeaux", geo:"Bordeaux 🇫🇷", email:"bordeaux@esmod.com", tags:["Mode","Campus"], note:"Campus Bordeaux ESMOD." }),
  mkSchool({ name:"Sorbonne Nouvelle — Licence Scénographie", geo:"Paris 🇫🇷", email:"theatre@sorbonne-nouvelle.fr", tags:["Université","Scénographie"], note:"Partenariat Boulle + Duperré. Licence scénographie théâtrale." }),
  // ── Beaux-Arts & Arts plastiques
  mkSchool({ name:"École Nationale Supérieure des Beaux-Arts Paris", geo:"Paris 🇫🇷", sub:"6ème", email:"info@beauxartsparis.fr", phone:"+33 1 47 03 50 00", tags:["Beaux-Arts","Prestige"], note:"La grande école des beaux-arts. Séjour Rio = expérience artistique ultime." }),
  mkSchool({ name:"École Boulle — Arts Appliqués Paris", geo:"Paris 🇫🇷", sub:"12ème", email:"ce.0750661c@ac-paris.fr", tags:["Arts Appliqués","Design","Luxe"], note:"Référence design et arts appliqués. Décors + accessoires de mode." }),
  mkSchool({ name:"HEAR — Haute École des Arts du Rhin", geo:"Strasbourg 🇫🇷", email:"info@hear.fr", tags:["Beaux-Arts","Scénographie"], note:"DNA/DNSEP. Option Scénographie et Design textile." }),
  mkSchool({ name:"Villa Arson — École Nationale d'Art", geo:"Nice 🇫🇷", email:"info@villa-arson.fr", phone:"+33 4 92 07 73 73", tags:["Art contemporain","Méditerranée"], note:"École nationale Nice. Proximité Monaco, Cannes." }),
  mkSchool({ name:"ENSBA Toulouse", geo:"Toulouse 🇫🇷", email:"contact@beauxarts-toulouse.fr", tags:["Beaux-Arts"], note:"École nationale Toulouse. Carrefour Sud-Ouest." }),
  mkSchool({ name:"École Supérieure des Beaux-Arts Nantes", geo:"Nantes 🇫🇷", email:"esba@esba-nantes.fr", tags:["Beaux-Arts","Atlantique"], note:"Nantes = forte scène culturelle + Carnaval local." }),
  mkSchool({ name:"ISBA Besançon", geo:"Besançon 🇫🇷", email:"isba@besancon.fr", tags:["Beaux-Arts","Design"], note:"École nationale. DNA + DNSEP." }),
  mkSchool({ name:"École Supérieure d'Art d'Avignon", geo:"Avignon 🇫🇷", email:"contact@esaa-avignon.fr", tags:["Art","Festival"], note:"Proximité Festival d'Avignon. Spectacle vivant." }),
  mkSchool({ name:"LISAA Paris", geo:"Paris 🇫🇷", sub:"Montparnasse", email:"contact@lisaa.com", phone:"+33 1 45 44 97 00", tags:["Design","Mode","Scénographie"], note:"Arts appliqués, mode, scénographie. 4 campus FR." }),
  // ── Cirque & Spectacle vivant
  mkSchool({ name:"CNAC — Centre National des Arts du Cirque", geo:"Châlons-en-Champagne 🇫🇷", email:"cnac@cnac.fr", phone:"+33 3 26 21 12 43", tags:["Cirque","Costumes","Corps"], note:"École nationale cirque. Costumes spéciaux, maquillage corps." }),
  mkSchool({ name:"Académie Fratellini — École du Cirque", geo:"Saint-Denis 🇫🇷", email:"contact@academie-fratellini.com", tags:["Cirque","Spectacle"], note:"Grande école cirque. Maquillage clown, personnages. Proche Carnaval." }),
  mkSchool({ name:"CNSMD Lyon — Conservatoire Musique et Danse", geo:"Lyon 🇫🇷", email:"cnsmd@cnsmd-lyon.fr", phone:"+33 4 72 19 26 26", tags:["Danse","Opéra"], note:"Conservatoire national. Danse + musique. Costumes de scène." }),
  mkSchool({ name:"CNSMDP — Conservatoire National Supérieur Paris", geo:"Paris 🇫🇷", sub:"19ème", email:"contact@cnsmdp.fr", tags:["Danse","Opéra","Prestige"], note:"Top conservatoire France. Costumes, maquillage premium." }),
  // ── Terrade réseau
  mkSchool({ name:"École Terrade Paris", geo:"Paris 🇫🇷", sub:"Nation", email:"paris@ecoleterrade.com", phone:"+33 1 43 73 35 35", tags:["65 campus","CPF","Alternance"], note:"65 campus France. Accord national = démultiplication maximum." }),
  mkSchool({ name:"École Terrade Lyon", geo:"Lyon 🇫🇷", email:"lyon@ecoleterrade.com", tags:["65 campus"], note:"Campus Lyon. Réseau Terrade." }),
  mkSchool({ name:"École Terrade Bordeaux", geo:"Bordeaux 🇫🇷", email:"bordeaux@ecoleterrade.com", tags:["65 campus"], note:"Campus Bordeaux. Réseau Terrade." }),
  mkSchool({ name:"École Terrade Marseille", geo:"Marseille 🇫🇷", email:"marseille@ecoleterrade.com", tags:["65 campus"], note:"Campus Marseille." }),
  mkSchool({ name:"École Terrade Toulouse", geo:"Toulouse 🇫🇷", email:"toulouse@ecoleterrade.com", tags:["65 campus"], note:"Campus Toulouse." }),
];

const CLIENTS_3D = [
  // ── Studios 3D Rio
  mk3D({ name:"DeltaThinkers Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Botafogo", email:"contato@deltathinkers.com", tags:["Hub 3D","Laser","Partenariat"], note:"Hub 3D + laser + CNC. Le plus équipé de Rio. Sous-traitance possible." }),
  mk3D({ name:"Create 3D Rio — Urca", geo:"Rio de Janeiro 🇧🇷", sub:"Urca", email:"create3d@gmail.com", tags:["Prototypes","Trophées"], note:"Urca. Prototypes ingénierie, trophées, maquettes." }),
  mk3D({ name:"Universe 3D", geo:"Rio de Janeiro 🇧🇷", sub:"Barra da Tijuca", email:"contato@universe3d.com.br", tags:["Architecture","Médical","Résine"], note:"Architecture, médecine, orthodontie. Filament + résine. Location imprimantes." }),
  mk3D({ name:"Algom 3D — Manufatura Digital", geo:"Rio de Janeiro 🇧🇷", sub:"Centro", email:"contato@algom3d.com.br", tags:["Architecture","Décoration"], note:"Maquettes archi + déco sur mesure. Architectes et designers." }),
  mk3D({ name:"Elabora 3D Estúdio", geo:"Rio de Janeiro 🇧🇷", sub:"Centro", email:"elabora3destudio@gmail.com", tags:["Studio","Modélisation"], note:"Rua do Ouvidor 63. Spécialistes 3D et modélisation. 3500 abonnés." }),
  mk3D({ name:"Fácil 3D Rio de Janeiro", geo:"Rio de Janeiro 🇧🇷", sub:"Méier", email:"contato@facil3d.com.br", tags:["Service","B2B"], note:"Service 3D RJ. Bon rapport qualité-prix." }),
  // ── Architecture
  mk3D({ name:"Bernardes Arquitetura", geo:"Rio de Janeiro 🇧🇷", sub:"Leblon", email:"contato@bernardes.arq.br", tags:["Architecture","Résidentiel"], note:"Cabinet archi reconnu. Maisons prestige Zona Sul. Maquettes." }),
  mk3D({ name:"Jacobsen Arquitetura", geo:"Rio de Janeiro 🇧🇷", sub:"Ipanema", email:"contato@jacobsenarquitetura.com", tags:["Architecture","Luxe"], note:"Top cabinet archi luxe RJ. Projets résidentiels et commerciaux." }),
  mk3D({ name:"Isay Weinfeld — Bureau Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Leblon", email:"rio@isayweinfeld.com", tags:["Architecture","Design","International"], note:"Architecte-designer star mondial. Projets mixtes archi + design d'objets." }),
  mk3D({ name:"Escritório de Arquitetura Zanettini", geo:"Rio de Janeiro 🇧🇷", sub:"Ipanema", email:"rio@zanettini.com.br", phone:"+55 21 2522-0000", tags:["Architecture","Prestige"], note:"Cabinet archi prestige. Maquettes 3D pour clients. Budget confortable." }),
  mk3D({ name:"NBBJ Brasil", geo:"Rio de Janeiro 🇧🇷", sub:"Leblon", email:"rio@nbbj.com", tags:["Architecture","International"], note:"Cabinet international. Maquettes + prototypes premium." }),
  mk3D({ name:"Studio MK27 Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Botafogo", email:"rio@studiomk27.com.br", tags:["Design Intérieur","Premium"], note:"Design d'intérieur reconnu. Pièces décoratives sur mesure." }),
  mk3D({ name:"Ateliê Marko Brajovic", geo:"Rio de Janeiro 🇧🇷", sub:"Jardim Botânico", email:"rio@brajovic.com.br", phone:"+55 21 2294-0000", tags:["Design","Star"], note:"Designer star brésilien. Pièces uniques. Clients VVIP Rio." }),
  // ── Institutions culturelles
  mk3D({ name:"Museu do Amanhã — Boutique Design", geo:"Rio de Janeiro 🇧🇷", sub:"Porto Maravilha", email:"loja@museudeamanha.org.br", phone:"+55 21 3812-1800", tags:["Culture","Design","Visible"], note:"Musée futuriste. Boutique design. Pièces 3D exclusives. Très visible." }),
  mk3D({ name:"MAR — Museu de Arte do Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Praça Mauá", email:"contato@museudeartedorio.org.br", tags:["Art","Scénographie"], note:"Musée art contemporain. Scénographie + pièces artistiques." }),
  mk3D({ name:"Instituto Moreira Salles", geo:"Rio de Janeiro 🇧🇷", sub:"Gávea", email:"ims@ims.com.br", phone:"+55 21 3284-7400", tags:["Culture","Prestige"], note:"Institut culturel prestige. Expositions premium. Scénographies." }),
  // ── Universités
  mk3D({ name:"PUC-Rio — Lab Fabricação Digital", geo:"Rio de Janeiro 🇧🇷", sub:"Gávea", email:"fablab@puc-rio.br", phone:"+55 21 3527-0000", tags:["Université","FabLab","Récurrent"], note:"Fab Lab PUC-Rio. Partenariat filaments + sous-traitance. Volume récurrent." }),
  mk3D({ name:"FGV Rio — Lab Innovation", geo:"Rio de Janeiro 🇧🇷", sub:"Botafogo", email:"inovacao@fgv.br", tags:["Éducation","Innovation"], note:"Grande école gestion. Lab innovation. Prototypes pédagogiques." }),
  mk3D({ name:"SENAI Rio — Tecnologia Industrial", geo:"Rio de Janeiro 🇧🇷", sub:"Maracanã", email:"rio@senai.br", tags:["Industrie","Formation","Volume"], note:"Centre formation industrielle. Grand volume." }),
  mk3D({ name:"IED Rio — Instituto Europeu de Design", geo:"Rio de Janeiro 🇧🇷", sub:"Flamengo", email:"rio@ied.edu.br", tags:["Design","Mode","International"], note:"École design internationale. Prototypes mode et produit premium." }),
  mk3D({ name:"ESDI — Escola Superior de Desenho Industrial", geo:"Rio de Janeiro 🇧🇷", sub:"Lapa", email:"contato@esdi.uerj.br", phone:"+55 21 2332-8000", tags:["Design Industriel"], note:"1ère école design industriel Amérique Latine. Prototypes étudiants." }),
  mk3D({ name:"UFRJ — Lab de Modelagem 3D", geo:"Rio de Janeiro 🇧🇷", sub:"Cidade Universitária", email:"laboratorio3d@ufrj.br", tags:["Université","Recherche"], note:"Université fédérale RJ. Projets recherche + enseignement." }),
  // ── Carnaval & Samba
  mk3D({ name:"LIESA — Liga das Escolas de Samba", geo:"Rio de Janeiro 🇧🇷", sub:"Cidade Nova", email:"contato@liesa.com.br", phone:"+55 21 2502-6614", tags:["Carnaval","Chars","CLEF"], note:"⭐ Organisation officielle Carnaval RJ. Chars allégoriques = pièces 3D GÉANTES. Contact clé absolu." }),
  mk3D({ name:"Imperatriz Leopoldinense", geo:"Rio de Janeiro 🇧🇷", sub:"Ramos", email:"imperatriz@imperatrizleopoldinense.com.br", tags:["Carnaval","Samba"], note:"Grande école samba. Accessoires costumes, éléments décoratifs chars. 3D couleur." }),
  mk3D({ name:"Beija-Flor de Nilópolis", geo:"Rio de Janeiro 🇧🇷", sub:"Nilópolis", email:"contato@beija-flor.com.br", tags:["Carnaval","Champion"], note:"École samba champion. Accessoires costumes. Volume important." }),
  mk3D({ name:"Escola de Samba Salgueiro", geo:"Rio de Janeiro 🇧🇷", sub:"Andaraí", email:"salgueiro@salgueiro.com.br", tags:["Carnaval","Samba"], note:"Grande école samba. Chars + costumes. Éléments fantastiques 3D." }),
  mk3D({ name:"Mangueira — Estação Primeira", geo:"Rio de Janeiro 🇧🇷", sub:"Mangueira", email:"mangueira@mangueira.com.br", tags:["Carnaval","Prestige"], note:"Plus ancienne école samba RJ. Symbole culturel fort." }),
  // ── Événementiel & Production
  mk3D({ name:"RioFilme — Empresa de Cinema RJ", geo:"Rio de Janeiro 🇧🇷", sub:"Centro", email:"contato@riofilme.com.br", phone:"+55 21 2976-2030", tags:["Cinéma","Accessoires"], note:"Production cinéma municipale. Props, décors, accessoires 3D pour films." }),
  mk3D({ name:"Globo Filmes", geo:"Rio de Janeiro 🇧🇷", sub:"Jacarepaguá", email:"globofilmes@globo.com", tags:["TV","Cinéma","Volume"], note:"Bras cinéma Rede Globo. TV + films. Props 3D plateau. Énorme budget." }),
  mk3D({ name:"T4F — Time for Fun Brazil", geo:"Rio de Janeiro 🇧🇷", sub:"Barra da Tijuca", email:"contato@t4f.com", tags:["Événementiel","Concerts"], note:"1er producteur shows BR. Accessoires scéniques, props 3D." }),
  // ── Immobilier luxe
  mk3D({ name:"CYRELA — Incorporadora Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Barra da Tijuca", email:"rio@cyrela.com.br", phone:"+55 21 2122-5800", tags:["Immobilier","Promoteur"], note:"Top promoteur immobilier. Maquettes projets résidentiels. Grands budgets." }),
  mk3D({ name:"Gafisa Rio de Janeiro", geo:"Rio de Janeiro 🇧🇷", sub:"Ipanema", email:"rj@gafisa.com.br", tags:["Immobilier","Prestige"], note:"Promoteur haut de gamme. Maquettes commerciales Ipanema, Leblon." }),
  // ── Joaillerie
  mk3D({ name:"H.Stern — Joalheria", geo:"Rio de Janeiro 🇧🇷", sub:"Ipanema", email:"contact@hstern.com.br", phone:"+55 21 2106-0011", tags:["Joaillerie","Luxe","Prototypes"], note:"Joaillier brésilien mondial. Prototypage bijoux 3D résine/cire. Premium absolu." }),
  mk3D({ name:"Antonio Bernardo Joalheria", geo:"Rio de Janeiro 🇧🇷", sub:"Leblon", email:"contato@antoniobernardo.com.br", tags:["Joaillerie","Design"], note:"Joaillier design contemporain. Prototypes bijoux. Artisanal haut de gamme." }),
  // ── Médical & Dentaire
  mk3D({ name:"OrthoCenter Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Copacabana", email:"rio@orthocenter.com.br", tags:["Orthodontie","Médical","Récurrent"], note:"Centre orthodontie. Aligneurs, modèles dentaires 3D. Très récurrent." }),
  mk3D({ name:"Hospital Samaritano Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Botafogo", email:"contato@samaritano.org.br", phone:"+55 21 3296-8282", tags:["Médical","Chirurgie"], note:"Hôpital privé prestige. Modèles anatomiques 3D pour chirurgies planifiées." }),
];

async function seed() {
  console.log("🌱 Lecture Supabase...");
  const r = await supabase.from("amigo_data").select("value").eq("key", KEY).single();
  if (!r.data) { console.error("❌ Impossible de lire Supabase"); process.exit(1); }
  const data = JSON.parse(r.data.value);

  const existingMakeup = new Set((data.makeup||[]).map(p=>p.name.toLowerCase().trim()));
  const existing3d     = new Set((data.print3d||[]).map(p=>p.name.toLowerCase().trim()));
  const newMakeup = ECOLES.filter(e=>!existingMakeup.has(e.name.toLowerCase().trim()));
  const new3d     = CLIENTS_3D.filter(e=>!existing3d.has(e.name.toLowerCase().trim()));

  console.log(`💄 ${newMakeup.length} nouvelles écoles (${ECOLES.length-newMakeup.length} doublons ignorés)`);
  console.log(`🧊 ${new3d.length} nouveaux clients 3D (${CLIENTS_3D.length-new3d.length} doublons ignorés)`);

  const updated = { ...data, makeup:[...(data.makeup||[]),...newMakeup], print3d:[...(data.print3d||[]),...new3d] };
  const { error } = await supabase.from("amigo_data").upsert({ key:KEY, value:JSON.stringify(updated), updated_at:new Date().toISOString() });
  if (error) { console.error("❌ Erreur:", error.message); process.exit(1); }
  console.log(`\n✅ Terminé !`);
  console.log(`   💄 Total écoles : ${updated.makeup.length}`);
  console.log(`   🧊 Total clients 3D : ${updated.print3d.length}`);
}

seed();
