// ─── AMIGO CRM — Script de peuplement Supabase v3 ────────────────────────────
// Lance depuis le terminal Mac :
//   cd /Users/AD/Documents/GitHub/amigo-crm && node seed-v2.js
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

// ─────────────────────────────────────────────────────────────────────────────
// NOUVEAUX PROSPECTS FRANCE — Univers artistique, musique, opéra, carnaval
// ─────────────────────────────────────────────────────────────────────────────
const ECOLES_V2 = [

  // ── Lutherie & Facture instrumentale
  mkSchool({ name:"ITEMM — Institut Technologique Européen des Métiers de la Musique", geo:"Le Mans 🇫🇷", sub:"Sarthe", email:"contact@itemm.fr", phone:"+33 2 43 39 89 00", tags:["Lutherie","Facture instrumentale","Prototypes"], note:"École nationale lutherie + facture instrumentale. Gabarits, contre-formes, prototypes 3D. Contact direction pédagogique." }),
  mkSchool({ name:"Lycée Jean-Baptiste Vuillaume — École Nationale de Lutherie", geo:"Mirecourt 🇫🇷", sub:"Vosges", email:"ce.0880049d@ac-nancy-metz.fr", phone:"+33 3 29 37 05 27", tags:["Lutherie","DMA","Quatuor"], note:"Seule école publique lutherie quatuor en France. DMA 3 ans. Gabarits + pièces complexes en 3D = besoin direct." }),
  mkSchool({ name:"Lycée Fernand Léger — CAP Lutherie Guitare", geo:"Bédarieux 🇫🇷", sub:"Hérault", email:"ce.0340018g@ac-montpellier.fr", phone:"+33 4 67 23 10 50", tags:["Lutherie","Guitare","CAP"], note:"Formation CAP lutherie guitare. Prototypes pièces, gabarits de fabrication. Approche budget modeste." }),
  mkSchool({ name:"Centre National de Formation Facteurs d'Orgues d'Eschau", geo:"Eschau 🇫🇷", sub:"Alsace", email:"contact@cfao-eschau.fr", phone:"+33 3 88 64 40 05", tags:["Orgues","Facture","Alsace"], note:"Unique formation facteurs d'orgues FR. Pièces mécaniques, tuyaux, prototypes. Niche très haute valeur." }),
  mkSchool({ name:"CFMI de Lille — Atelier Lutheries Expérimentales ALEx", geo:"Lille 🇫🇷", sub:"Nord", email:"cfmi@univ-lille.fr", phone:"+33 3 20 41 60 00", tags:["Lutherie expérimentale","Recherche","Prototypes"], note:"Atelier lutheries expérimentales lié à l'université. Recherche sur nouveaux instruments. Impression 3D déjà dans leur process." }),

  // ── Opéra & grandes maisons de spectacle
  mkSchool({ name:"Opéra National de Paris — Ateliers Costumes & Décors", geo:"Paris 🇫🇷", sub:"Bastille / Garnier", email:"communication@operadeparis.fr", phone:"+33 1 71 25 24 23", tags:["Opéra","Costumes","Accessoires","Prestige"], note:"Ateliers internes costumes + décors. Accessoires scène, masques, bijoux, props. Budget énorme. Contacter responsable ateliers techniques." }),
  mkSchool({ name:"Opéra de Lyon", geo:"Lyon 🇫🇷", sub:"Presqu'île", email:"contact@opera-lyon.com", phone:"+33 4 69 85 54 54", tags:["Opéra","Scénographie","Accessoires"], note:"Grand opéra régional. Ateliers décors + costumes actifs. Pièces sur mesure scène. Budget régional solide." }),
  mkSchool({ name:"Opéra de Bordeaux", geo:"Bordeaux 🇫🇷", sub:"Centre", email:"contact@opera-bordeaux.com", phone:"+33 5 56 00 85 95", tags:["Opéra","Décors","Costumes"], note:"Opéra national de Bordeaux. Accessoires scéniques, props, éléments décors." }),
  mkSchool({ name:"Opéra de Marseille", geo:"Marseille 🇫🇷", sub:"Vieux-Port", email:"contact@opera.marseille.fr", phone:"+33 4 91 55 11 10", tags:["Opéra","Méditerranée","Costumes"], note:"2e plus ancienne maison d'opéra FR. Ateliers costumes internes actifs." }),
  mkSchool({ name:"Opéra de Lille", geo:"Lille 🇫🇷", sub:"Centre", email:"contact@opera-lille.fr", phone:"+33 3 62 21 21 21", tags:["Opéra","Nord","Scénographie"], note:"Opéra régional actif. Carnaval de Dunkerque proche = sensibilité festive. Accessoires + décors." }),
  mkSchool({ name:"Comédie-Française — Ateliers", geo:"Paris 🇫🇷", sub:"Palais Royal", email:"billetterie@comedie-francaise.fr", phone:"+33 1 44 58 15 15", tags:["Théâtre","Prestige","Accessoires"], note:"La maison de Molière. Ateliers props + accessoires scène. Pièces historiques reconstituées en 3D. Contact responsable technique." }),
  mkSchool({ name:"Théâtre du Châtelet — Ateliers Techniques", geo:"Paris 🇫🇷", sub:"1er", email:"communication@chatelet.com", phone:"+33 1 40 28 28 40", tags:["Théâtre musical","Décors","Props"], note:"Grande salle parisienne. Comédies musicales + opérettes. Props et décors complexes. Budget important." }),
  mkSchool({ name:"Philharmonie de Paris — Ateliers", geo:"Paris 🇫🇷", sub:"19ème", email:"contact@philharmoniedeparis.fr", phone:"+33 1 44 84 44 84", tags:["Musique","Lutherie","Musée instruments"], note:"Musée des instruments + salle concert. Prototypes lutherie pour expositions + événements pédagogiques." }),

  // ── Cirque & arts de la rue — univers carnavalesque direct
  mkSchool({ name:"École Nationale du Cirque Annie Fratellini", geo:"Saint-Denis 🇫🇷", sub:"Seine-Saint-Denis", email:"contact@cirqueanniefratellini.com", phone:"+33 1 49 22 22 22", tags:["Cirque","Costumes spéciaux","Carnaval"], note:"Grande école cirque FR. Maquillage corps, costumes volumétriques, accessoires scène. Lien fort univers carnavalesque." }),
  mkSchool({ name:"Pôle National Cirque Bordeaux En Piste", geo:"Bordeaux 🇫🇷", sub:"Bègles", email:"contact@bordeauxenpiste.com", phone:"+33 5 56 86 07 14", tags:["Cirque","Arts de la rue","Accessoires"], note:"Pôle national cirque Nouvelle-Aquitaine. Création costumes + accessoires. Budget résidence artistes." }),
  mkSchool({ name:"Académie Chapitô", geo:"Lisbonne 🇵🇹", sub:"Castelo", email:"geral@chapito.org", phone:"+351 21 887 82 25", tags:["Cirque","Portugal","International"], note:"École cirque Lisbonne. Proximité culturelle BR. Costumes + maquillage. Extension naturelle réseau ibérique." }),

  // ── FabLabs écoles d'art et d'architecture
  mkSchool({ name:"EnsAD — FabLab Arts Décoratifs", geo:"Paris 🇫🇷", sub:"5ème", email:"fablab@ensad.fr", phone:"+33 1 42 34 97 00", tags:["FabLab","Arts Déco","Prototypes"], note:"FabLab interne EnsAD. Étudiants design objet, scénographie, bijoux. Filament + résine. Contact responsable FabLab." }),
  mkSchool({ name:"École Nationale Supérieure d'Architecture Paris-Val de Seine — FabLab", geo:"Paris 🇫🇷", sub:"13ème", email:"fablab@paris-valdeseine.archi.fr", phone:"+33 1 72 69 63 00", tags:["Architecture","FabLab","Maquettes"], note:"FabLab école architecture. Maquettes archi + prototypes. Accès libre étudiants. Contacter responsable atelier numérique." }),
  mkSchool({ name:"HEAR Strasbourg — FabLab", geo:"Strasbourg 🇫🇷", sub:"Centre", email:"fablab@hear.fr", phone:"+33 3 69 06 37 77", tags:["Beaux-Arts","FabLab","Design"], note:"FabLab Haute École des Arts du Rhin. Projets scénographie + design textile. Impression 3D déjà utilisée." }),
  mkSchool({ name:"Villette Makerz — FabLab Paris", geo:"Paris 🇫🇷", sub:"19ème", email:"contact@villettemakerz.com", phone:"+33 1 40 03 75 75", tags:["FabLab","Makers","Artistes"], note:"FabLab Paris 19. Accès artistes + étudiants. Impression 3D, laser. Partenariats écoles d'art voisines. Prescripteur clé." }),

  // ── Carnaval France — univers festif direct
  mkSchool({ name:"Carnaval de Dunkerque — Association des Carnavaliers", geo:"Dunkerque 🇫🇷", sub:"Nord", email:"contact@carnavaledunkerque.fr", phone:"+33 3 28 26 27 28", tags:["Carnaval","Costumes","Nord"], note:"Plus grand carnaval FR hors Nice. Chars, costumes, accessoires volumétriques. Lien direct impression 3D pièces déco." }),
  mkSchool({ name:"Carnaval de Nice — Comité des Fêtes", geo:"Nice 🇫🇷", sub:"Côte d'Azur", email:"carnaval@nicetourisme.com", phone:"+33 4 92 17 60 60", tags:["Carnaval","Chars","Prestige"], note:"2e plus grand carnaval monde. Chars allégoriques géants. Pièces 3D décoratives + prototypes masques. Budget municipal important." }),
  mkSchool({ name:"Carnaval de Marseille — Association", geo:"Marseille 🇫🇷", sub:"Méditerranée", email:"contact@carnavalmarseille.fr", tags:["Carnaval","Sud","Costumes"], note:"Carnaval historique Marseille. Costumes + accessoires. Univers méditerranéen festif." }),
  mkSchool({ name:"Fête des Lumières Lyon — Régie Technique", geo:"Lyon 🇫🇷", sub:"Presqu'île", email:"fetedeslumieresf@mairie-lyon.fr", phone:"+33 4 72 10 30 30", tags:["Événementiel","Scénographie","Lumière"], note:"Événement mondial 4 jours. Installations artistiques sur mesure. Pièces 3D pour scénographies lumineuses. Budget ville énorme." }),

];

// ─────────────────────────────────────────────────────────────────────────────
// NOUVEAUX PROSPECTS BRÉSIL — Impression 3D Rio de Janeiro
// ─────────────────────────────────────────────────────────────────────────────
const CLIENTS_3D_V2 = [

  // ── Hôtellerie luxe Rio
  mk3D({ name:"Belmond Copacabana Palace", geo:"Rio de Janeiro 🇧🇷", sub:"Copacabana", email:"reservations.bcp@belmond.com", phone:"+55 21 2548-7070", tags:["Hôtel Luxe","Prestige","Déco"], note:"Hôtel iconique Rio. Objets déco sur mesure, signalétique premium, pièces d'ambiance 3D. Budget illimité. Contacter F&B Manager ou Directeur Décoration." }),
  mk3D({ name:"Hotel Fasano Rio de Janeiro", geo:"Rio de Janeiro 🇧🇷", sub:"Ipanema", email:"rio@fasano.com.br", phone:"+55 21 3202-4000", tags:["Hôtel Luxe","Design","Ipanema"], note:"Hôtel design référence Rio. Philippe Starck. Pièces décoratives exclusives 3D. Clientèle VVIP internationale." }),
  mk3D({ name:"Marina All Suites", geo:"Rio de Janeiro 🇧🇷", sub:"Leblon", email:"reservas@marinaallsuites.com.br", phone:"+55 21 2172-1001", tags:["Hôtel","Art","Design"], note:"Hôtel art + design Leblon. Expositions artistes brésiliens. Objets déco 3D artistiques. Clientèle haut de gamme." }),
  mk3D({ name:"La Suite by Dussol", geo:"Rio de Janeiro 🇧🇷", sub:"Joatinga", email:"contact@lasuite.com.br", phone:"+55 21 2484-1962", tags:["Boutique Hotel","Luxe","Exclusif"], note:"Boutique hôtel exclusif bord de mer. Pièces décoratives ultra-personnalisées. Très petit volume, très haute valeur." }),
  mk3D({ name:"Santa Teresa Hotel MGallery", geo:"Rio de Janeiro 🇧🇷", sub:"Santa Teresa", email:"H6091@accor.com", phone:"+55 21 3380-0200", tags:["Hôtel","Santa Teresa","Art"], note:"Hôtel historique Santa Teresa. Quartier artiste. Déco coloniale revisitée. Pièces 3D décoratives thématiques." }),
  mk3D({ name:"Mama Ruisa — Boutique Hôtel", geo:"Rio de Janeiro 🇧🇷", sub:"Santa Teresa", email:"mamaruisa@mamaruisa.com", phone:"+55 21 2242-1281", tags:["Boutique Hotel","Art","Français"], note:"Hôtel franco-brésilien Santa Teresa. Propriétaire français sensible au design. Pièces artisanales 3D = pitch facile." }),

  // ── Gastronomie haut de gamme
  mk3D({ name:"Lasai Restaurant", geo:"Rio de Janeiro 🇧🇷", sub:"Botafogo", email:"contato@lasai.com.br", phone:"+55 21 3449-1834", tags:["Gastronomie","Étoilé","Design table"], note:"Restaurant étoilé Michelin Rio. Présentation plats + accessoires table sur mesure 3D. Chef Rafa Costa e Silva." }),
  mk3D({ name:"Olympe Restaurant", geo:"Rio de Janeiro 🇧🇷", sub:"Lagoa", email:"olympe@olympe.com.br", phone:"+55 21 2239-4542", tags:["Gastronomie","Franco-brésilien","Prestige"], note:"Restaurant gastronomique franco-brésilien historique. Présentoirs, supports menu, accessoires table custom 3D." }),
  mk3D({ name:"Roberta Sudbrack Restaurant", geo:"Rio de Janeiro 🇧🇷", sub:"Jardim Botânico", email:"contato@robertasudbrack.com.br", phone:"+55 21 3874-0139", tags:["Gastronomie","Chef Star","Design"], note:"Chef étoilée brésilienne star. Cuisine expérimentale. Accessoires de présentation innovants 3D = pitch créatif fort." }),
  mk3D({ name:"Oro Restaurant", geo:"Rio de Janeiro 🇧🇷", sub:"Leblon", email:"reservas@restauranteoro.com.br", phone:"+55 21 2540-8768", tags:["Gastronomie","Étoilé","Leblon"], note:"1 étoile Michelin. Chef Felipe Bronze. Déco table + accessoires présentation. Budget gastronomique premium." }),
  mk3D({ name:"CT Boucherie Ipanema", geo:"Rio de Janeiro 🇧🇷", sub:"Ipanema", email:"ipanema@ctboucherie.com.br", phone:"+55 21 2522-0626", tags:["Gastronomie","Claude Troisgros","Prestige"], note:"Restaurant Claude Troisgros. Chaîne gastronomique premium RJ. Accessoires table, supports présentation sur mesure." }),

  // ── Mode & Fashion Rio
  mk3D({ name:"Farm Rio — Siège Social", geo:"Rio de Janeiro 🇧🇷", sub:"Gávea", email:"press@farmrio.com.br", phone:"+55 21 2274-8994", tags:["Mode","International","Volume"], note:"Marque mode brésilienne mondiale. Prototypes accessoires, bijoux fantaisie, boutons custom. Volume régulier possible." }),
  mk3D({ name:"Osklen — Bureau Créatif Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Ipanema", email:"contato@osklen.com", phone:"+55 21 2227-2911", tags:["Mode","Luxe","Surf"], note:"Marque mode luxe brésilienne. Prototypes accessoires, boucles, fermetures éclair custom. Clientèle internationale." }),
  mk3D({ name:"Animale — Atelier Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Barra da Tijuca", email:"animale@soma.com.br", tags:["Mode","Design","Féminin"], note:"Grande marque mode brésilienne féminine. Prototypes bijoux, accessoires, boutons custom. Appartient au groupe SOMA." }),
  mk3D({ name:"Reserva — Siège Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Leblon", email:"contato@usereserva.com", phone:"+55 21 2512-7440", tags:["Mode","Urbain","Streetwear"], note:"Marque mode masculine très populaire. Accessoires + prototypes collections. Sens du design fort." }),
  mk3D({ name:"Cris Barros — Atelier Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Jardim Botânico", email:"atelier@crisbarros.com.br", phone:"+55 21 2529-0048", tags:["Mode","Haute Couture","Bijoux"], note:"Créatrice haute couture brésilienne. Prototypes bijoux + accessoires sur mesure. Budget couture = haute valeur unitaire." }),

  // ── Lutherie & Musique Rio
  mk3D({ name:"Escola de Música da UFRJ", geo:"Rio de Janeiro 🇧🇷", sub:"Urca", email:"musica@musica.ufrj.br", phone:"+55 21 3938-0095", tags:["Musique","Lutherie","Université"], note:"École musique fédérale Rio. Lutherie + fabrication instrumentale. Gabarits + prototypes instruments 3D. Lien université." }),
  mk3D({ name:"Conservatório Brasileiro de Música", geo:"Rio de Janeiro 🇧🇷", sub:"Centro", email:"cbm@cbm-musica.org.br", phone:"+55 21 2240-0339", tags:["Musique","Conservatoire","Formation"], note:"Conservatoire historique brésilien. Recherche instrumentale. Pièces 3D pour ateliers lutherie." }),
  mk3D({ name:"Casa da Música Rio — Centro Cultural", geo:"Rio de Janeiro 🇧🇷", sub:"Botafogo", email:"contato@casamusica.rj.gov.br", phone:"+55 21 2332-9223", tags:["Musique","Culturel","Événementiel"], note:"Centre culturel musique RJ. Expositions instruments + événements. Prototypes pédagogiques + accessoires scène." }),

  // ── Théâtre & Scénographie Rio
  mk3D({ name:"Teatro Municipal do Rio de Janeiro — Ateliers", geo:"Rio de Janeiro 🇧🇷", sub:"Centro", email:"comunicacao@theatromunicipal.rj.gov.br", phone:"+55 21 2332-9191", tags:["Théâtre","Opéra","Scénographie","Prestige"], note:"Opéra maison de Rio. Ateliers costumes + décors internes. Accessoires scène, masques, bijoux, props. Budget municipal." }),
  mk3D({ name:"Teatro Carlos Gomes Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Centro", email:"contato@teatrocarlosgomes.rj.gov.br", phone:"+55 21 2332-9232", tags:["Théâtre","Opérette","Accessoires"], note:"Grand théâtre historique RJ. Productions opérette + comédie musicale. Props + décors sur mesure." }),
  mk3D({ name:"SESC Rio — Produção Cultural", geo:"Rio de Janeiro 🇧🇷", sub:"Flamengo", email:"sesc@sescrio.org.br", phone:"+55 21 2557-0500", tags:["Culturel","Multi-sites","Volume"], note:"SESC = réseau culturel énorme RJ. 10+ espaces. Scénographies expositions + spectacles vivants. Volume récurrent garanti." }),

  // ── Gastronomie créative & Food design
  mk3D({ name:"Confeitaria Colombo — Flagship Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Centro", email:"colombo@confeitariacolombo.com.br", phone:"+55 21 2505-1500", tags:["Gastronomie","Patrimoine","Déco"], note:"Pâtisserie historique iconique 1894. Présentoirs + accessoires décoratifs sur mesure. Patrimoine culturel RJ." }),
  mk3D({ name:"Caju Gastronomia", geo:"Rio de Janeiro 🇧🇷", sub:"Gamboa", email:"contato@cajugastronomia.com.br", phone:"+55 21 2516-6248", tags:["Gastronomie","Créatif","Design"], note:"Restaurant gastronomique créatif. Chef innovant. Accessoires présentation + décor table sur mesure 3D." }),

  // ── Événementiel & Fêtes Rio
  mk3D({ name:"Rio Scenarium — Bar & Événementiel", geo:"Rio de Janeiro 🇧🇷", sub:"Lapa", email:"contato@rioscenarium.com.br", phone:"+55 21 3147-9000", tags:["Événementiel","Déco","Bar"], note:"Bar + salle événements iconique Lapa. Déco bric-à-brac vintage. Pièces décoratives 3D thématiques. Très visible culturellement." }),
  mk3D({ name:"Espaço Cultural da Marinha", geo:"Rio de Janeiro 🇧🇷", sub:"Centro", email:"ecm@mar.mil.br", phone:"+55 21 2233-9165", tags:["Culturel","Musée","Scénographie"], note:"Espace culturel Marine brésilienne. Expositions permanentes + temporaires. Pièces scénographiques, maquettes navales 3D." }),
];

async function seed() {
  console.log("🌱 Lecture Supabase...");
  const r = await supabase.from("amigo_data").select("value").eq("key", KEY).single();
  if (!r.data) { console.error("❌ Impossible de lire Supabase"); process.exit(1); }
  const data = JSON.parse(r.data.value);

  const existingMakeup = new Set((data.makeup||[]).map(p=>p.name.toLowerCase().trim()));
  const existing3d     = new Set((data.print3d||[]).map(p=>p.name.toLowerCase().trim()));
  const newMakeup = ECOLES_V2.filter(e=>!existingMakeup.has(e.name.toLowerCase().trim()));
  const new3d     = CLIENTS_3D_V2.filter(e=>!existing3d.has(e.name.toLowerCase().trim()));

  console.log(`🎭 ${newMakeup.length} nouveaux prospects France (${ECOLES_V2.length-newMakeup.length} doublons ignorés)`);
  console.log(`🧊 ${new3d.length} nouveaux clients 3D Brésil (${CLIENTS_3D_V2.length-new3d.length} doublons ignorés)`);

  const updated = {
    ...data,
    makeup: [...(data.makeup||[]), ...newMakeup],
    print3d: [...(data.print3d||[]), ...new3d]
  };

  const { error } = await supabase.from("amigo_data").upsert({
    key: KEY,
    value: JSON.stringify(updated),
    updated_at: new Date().toISOString()
  });

  if (error) { console.error("❌ Erreur:", error.message); process.exit(1); }

  console.log(`\n✅ Terminé !`);
  console.log(`   🎭 Total prospects France : ${updated.makeup.length}`);
  console.log(`   🧊 Total clients 3D Brésil : ${updated.print3d.length}`);
}

seed();
