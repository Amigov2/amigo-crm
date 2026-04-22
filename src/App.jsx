import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://sujdarqrksqwcmtapcjw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1amRhcnFya3Nxd2NtdGFwY2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzI1NDgsImV4cCI6MjA4ODc0ODU0OH0.X1UaTAq6zdxwYCoAllUDE_GoTS-TlvgZrK1OWKkc_nM"
);

const storage = {
  async get(key) {
    const { data, error } = await supabase.from("amigo_data").select("value").eq("key", key).single();
    if (error || !data) return null;
    return { value: data.value };
  },
  async getTimestamp(key) {
    const { data, error } = await supabase.from("amigo_data").select("updated_at").eq("key", key).single();
    if (error || !data) return null;
    return data.updated_at;
  },
  async set(key, value) {
    const { error } = await supabase.from("amigo_data").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { key, value };
  },
};

const USERS = {
  anthony: { label: "Anthony", color: "#3b82f6", avatar: "A" },
  harold:  { label: "Harold",  color: "#22c55e", avatar: "H" },
  jade:    { label: "Jade",    color: "#f59e0b", avatar: "J" },
};

const PROJECTS = {
  makeup: {
    id: "makeup", label: "Carnaval Gall", icon: "💄", color: "#ec4899",
    statuses: ["À contacter","Contacté","En discussion","Qualifié","Relance urgente","Prospect froid"],
    statusColors: { "À contacter":"#3b82f6","Contacté":"#f59e0b","En discussion":"#22c55e","Qualifié":"#8b5cf6","Relance urgente":"#ef4444","Prospect froid":"#4b5563" },
  },
  vin: {
    id: "vin", label: "Vin", icon: "🍷", color: "#8b5cf6",
    statuses: ["À contacter","Contacté","En négociation","Commande passée","Livraison en cours","Partenaire actif"],
    statusColors: { "À contacter":"#3b82f6","Contacté":"#f59e0b","En négociation":"#22c55e","Commande passée":"#8b5cf6","Livraison en cours":"#f97316","Partenaire actif":"#14b8a6" },
  },
  vinClients: {
    id: "vinClients", label: "Clients Vin", icon: "🥂", color: "#f59e0b",
    statuses: ["Prospect","Dégustation proposée","Dégustation faite","1ère commande","Client régulier","En pause"],
    statusColors: { "Prospect":"#3b82f6","Dégustation proposée":"#f59e0b","Dégustation faite":"#8b5cf6","1ère commande":"#22c55e","Client régulier":"#14b8a6","En pause":"#4b5563" },
  },
  print3d: {
    id: "print3d", label: "Impression 3D", icon: "🧊", color: "#14b8a6",
    statuses: ["Prospect","Devis envoyé","Devis accepté","En production","Livré","Facturé"],
    statusColors: { "Prospect":"#3b82f6","Devis envoyé":"#f59e0b","Devis accepté":"#22c55e","En production":"#f97316","Livré":"#8b5cf6","Facturé":"#14b8a6" },
  },
};

const ORDER_STATUSES = ["En attente","Confirmée","En production","Livré","Facturé","Annulée"];
const QUOTE_STATUSES = ["Brouillon","Envoyé","Accepté","Refusé","Expiré","Annulé"];

// ── Données entreprise pour facturation / PIX ───────────────────────────────
// Email expéditeur par projet (alias "Envoyer en tant que" dans Gmail)
const PROJECT_EMAIL = {
  vin: "3abresil@gmail.com",
  vinClients: "3abresil@gmail.com",
  print3d: "labo3drio@gmail.com",
  makeup: "contact@formationcarnaval.fr",
};

const EMPRESA = {
  nome: "3A IMPORT",
  cnpj: "21496846000134",
  pixKey: "21496846000134", // Clé PIX = CNPJ
  pixType: "CNPJ",
  email: "3abresil@gmail.com",
  tel: "+5521998755498",
  cidade: "RIO DE JANEIRO",
};

// Génération payload PIX EMV (statique avec montant)
function pixPayload(amount, txid) {
  const f = (id, val) => id + String(val.length).padStart(2,"0") + val;
  const merchantAccount = f("00","BR.GOV.BCB.PIX") + f("01", EMPRESA.pixKey);
  let payload =
    f("00","01") +                              // Format indicator
    f("01","12") +                              // Static QR
    f("26", merchantAccount) +                  // Merchant account
    f("52","0000") +                            // MCC
    f("53","986") +                             // BRL
    f("54", amount.toFixed(2)) +                // Amount
    f("58","BR") +                              // Country
    f("59", EMPRESA.nome.slice(0,25)) +         // Merchant name
    f("60", EMPRESA.cidade.slice(0,15)) +       // City
    f("62", f("05", (txid||"AMIGO").slice(0,25))); // TxID
  // CRC16-CCITT
  payload += "6304";
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xFFFF;
  }
  return payload.slice(0,-4) + "6304" + crc.toString(16).toUpperCase().padStart(4,"0");
}

const INIT_DATA = {
  makeup: [
    { id:"m1", name:"Académie du Maquillage Paris", geo:"Paris 🇫🇷", sub:"8ème", contact:"Sophie Renard", email:"s.renard@academie-maquillage.fr", phone:"+33 1 42 65 32 01", valeur:28000, tags:["Artistique","Scénique"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"Profil idéal Carnaval. École de référence." },
    { id:"m2", name:"EFMM – École Française Maquillage", geo:"Paris 🇫🇷", sub:"11ème", contact:"Luc Bertrand", email:"contact@efmm.fr", phone:"+33 1 43 67 08 09", valeur:24000, tags:["SFX","Certifiée"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"Spécialité SFX — parfaite pour Carnaval." },
    { id:"m3", name:"Make Up For Ever Academy", geo:"Paris 🇫🇷", sub:"Le Marais", contact:"Julie Marchand", email:"academy@makeupforever.com", phone:"+33 1 49 26 06 06", valeur:35000, tags:["Prestige","International"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"La plus prestigieuse. Dossier premium requis." },
    { id:"m4", name:"École Mod's Hair Lyon", geo:"Lyon 🇫🇷", sub:"Presqu'île", contact:"Amélie Fontaine", email:"a.fontaine@modshair.fr", phone:"+33 4 72 41 56 20", valeur:22000, tags:["Réseau 12 villes"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"Un accord = effet réseau x12." },
    { id:"m5", name:"Institut ISMA Bordeaux", geo:"Bordeaux 🇫🇷", sub:"Centre", contact:"Carole Dupuis", email:"carole.dupuis@isma-bordeaux.fr", phone:"+33 5 56 44 71 90", valeur:18000, tags:["OPCO","Mode"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"Financement OPCO possible." },
    { id:"m6", name:"CFA Beauté Nantes", geo:"Nantes 🇫🇷", sub:"Centre", contact:"Thierry Morel", email:"t.morel@cfa-beaute-nantes.fr", phone:"+33 2 40 48 62 10", valeur:12000, tags:["Public"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"Budget limité. Priorité basse." },
  ],
  vin: [
    { id:"v1", name:"Domaine Leflaive", geo:"France 🇫🇷", sub:"Bourgogne", contact:"Marie Leflaive", email:"m.leflaive@domaine-leflaive.fr", phone:"+33 3 80 21 30 74", valeur:85000, tags:["Bio","Chardonnay"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"Leader Puligny-Montrachet.", type:"Blanc", producteur:"Domaine Leflaive", cepage:"Chardonnay", appellation:"Puligny-Montrachet AOC", millesime:"2022", bio:true, certificat:"AOC", alcool:"13", incoterm:"FOB", prixProducteur:"320", prixMagasinFr:"85", prixVenteBresil:"", prixMercadoLivre:"", minCommande:"6" },
    { id:"v2", name:"Bodegas Torres", geo:"Espagne 🇪🇸", sub:"Penedès", contact:"Carlos Torres", email:"c.torres@torres.es", phone:"+34 93 817 74 00", valeur:120000, tags:["Volume","Tempranillo"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"Très réactif. Déjà actif au Brésil.", type:"Rouge", producteur:"Bodegas Torres", cepage:"Tempranillo", appellation:"Penedès DO", millesime:"2021", bio:false, certificat:"DO", alcool:"14", incoterm:"CIF", prixProducteur:"180", prixMagasinFr:"45", prixVenteBresil:"", prixMercadoLivre:"", minCommande:"12" },
    { id:"v3", name:"Antinori Marchesi", geo:"Italie 🇮🇹", sub:"Toscane", contact:"Piero Antinori", email:"p.antinori@antinori.it", phone:"+39 055 23595", valeur:200000, tags:["Barolo","Prestige"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"Fort potentiel prestige RJ.", type:"Rouge", producteur:"Marchesi Antinori", cepage:"Sangiovese", appellation:"Chianti Classico DOCG", millesime:"2020", bio:false, certificat:"DOCG", alcool:"14.5", incoterm:"FOB", prixProducteur:"420", prixMagasinFr:"110", prixVenteBresil:"", prixMercadoLivre:"", minCommande:"6" },
    { id:"v4", name:"Concha y Toro", geo:"Chili 🇨🇱", sub:"Valle Central", contact:"Sofia Morales", email:"s.morales@conchaytoro.cl", phone:"+56 2 2476 5000", valeur:60000, tags:["Rapport Q/P"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"Excellent Q/P. Déjà au Brésil.", type:"Rouge", producteur:"Concha y Toro", cepage:"Cabernet Sauvignon", appellation:"Valle Central DO", millesime:"2022", bio:false, certificat:"DO", alcool:"13.5", incoterm:"CIF", prixProducteur:"95", prixMagasinFr:"22", prixVenteBresil:"", prixMercadoLivre:"", minCommande:"24" },
    { id:"v5", name:"Penfolds Estate", geo:"Australie 🇦🇺", sub:"Barossa Valley", contact:"James Halliday", email:"j.halliday@penfolds.com", phone:"+61 8 8568 9408", valeur:95000, tags:["Shiraz","Grange"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"Aucun distributeur RJ — fenêtre ouverte.", type:"Rouge", producteur:"Penfolds", cepage:"Shiraz", appellation:"Barossa Valley GI", millesime:"2021", bio:false, certificat:"GI", alcool:"14.5", incoterm:"FOB", prixProducteur:"280", prixMagasinFr:"72", prixVenteBresil:"", prixMercadoLivre:"", minCommande:"6" },
    { id:"v6", name:"Château Margaux", geo:"France 🇫🇷", sub:"Bordeaux", contact:"Albéric Bichot", email:"contact@chateau-margaux.com", phone:"+33 5 57 88 83 83", valeur:350000, tags:["Grand Cru"], status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, note:"Via allocations. Introduction requise.", type:"Rouge", producteur:"Château Margaux", cepage:"Cabernet Sauvignon", appellation:"Margaux AOC", millesime:"2019", bio:false, certificat:"AOC / 1er Grand Cru", alcool:"13", incoterm:"DDP", prixProducteur:"1800", prixMagasinFr:"650", prixVenteBresil:"", prixMercadoLivre:"", minCommande:"1" },
  ],
  print3d: [],
  orders: [],
  activity: [],
  vinClients: [],
  prospectEmails: {},
  filamentStock: [
    { id:"fil1", color:"Vert",     hex:"#22c55e", material:"PLA", weightTotal:1000, weightUsed:0 },
    { id:"fil2", color:"Jaune",    hex:"#fbbf24", material:"PLA", weightTotal:1000, weightUsed:0 },
    { id:"fil3", color:"Marron",   hex:"#92400e", material:"PLA", weightTotal:1000, weightUsed:0 },
    { id:"fil4", color:"Vermelho", hex:"#ef4444", material:"PLA", weightTotal:1000, weightUsed:0 },
    { id:"fil5", color:"Beige",    hex:"#d4a574", material:"PLA", weightTotal:1000, weightUsed:0 },
    { id:"fil6", color:"Noir",     hex:"#1e1e1e", material:"PLA", weightTotal:1000, weightUsed:0 },
  ],
};

const uid = () => Math.random().toString(36).slice(2, 8);

// ── Données initiales à importer (écoles + clients 3D Rio) ───────────────────
const SEED_MAKEUP = [
  { name:"ITM Paris — Institut des Métiers", geo:"Paris 🇫🇷", sub:"10ème", contact:"Direction admissions", email:"contact@itmparis.com", phone:"+33 1 42 08 23 20", tags:["Prestige","Bachelor"], note:"40 ans d'existence. Bachelor maquillage & coiffure. Cinéma, mode, SFX." },
  { name:"Conservatoire du Maquillage", geo:"Paris 🇫🇷", sub:"Marais", contact:"Responsable formation", email:"contact@leconservatoiredumaquillage.fr", phone:"+33 1 48 04 70 70", tags:["Artistique","Primé"], note:"1er prix IMATS New York. Formation 9 mois. Très bonne réputation terrain." },
  { name:"Acte Académie — Paris", geo:"Paris 🇫🇷", sub:"Opéra", contact:"Service inscription", email:"paris@acte-academie.com", phone:"+33 1 40 26 01 15", tags:["Réseau","SFX"], note:"4 campus : Paris, Bordeaux, Lille, Lyon. Partenariat Esmod." },
  { name:"Acte Académie — Lyon", geo:"Lyon 🇫🇷", sub:"Presqu'île", contact:"Direction pédagogique", email:"lyon@acte-academie.com", phone:"+33 4 72 41 89 00", tags:["Réseau","Mode"], note:"Campus Lyon. Accord global possible sur 4 villes." },
  { name:"Acte Académie — Bordeaux", geo:"Bordeaux 🇫🇷", sub:"Saint-Michel", contact:"Responsable admissions", email:"bordeaux@acte-academie.com", phone:"+33 5 56 79 00 00", tags:["Réseau","SFX"], note:"4ème campus Acte Académie. Contact commun possible." },
  { name:"Acte Académie — Lille", geo:"Lille 🇫🇷", sub:"Vieux-Lille", contact:"Florence — prof maquillage", email:"lille@acte-academie.com", phone:"+33 3 20 55 00 00", tags:["Réseau","Nord"], note:"Partenariat Esmod Roubaix. Réseau mode fort dans le Nord." },
  { name:"École F.A.M — Fashion And Makeup", geo:"Paris 🇫🇷", sub:"République", contact:"Directrice pédagogique", email:"contact@ecole-fam.com", phone:"+33 1 43 38 00 00", tags:["Cinéma","Contenu"], note:"Formation 2-3 ans. Cinéma, théâtre, réseaux sociaux. 100% réussite 2023." },
  { name:"SLA Make Up Academy", geo:"Valence 🇫🇷", sub:"Drôme", contact:"Serge Louis Alvarez", email:"contact@slamakeupacademy.com", phone:"+33 4 75 43 00 00", tags:["CPF","International"], note:"25 ans. Campus Valence + Sydney, Chypre, Suisse. CPF éligible." },
  { name:"École Sophie Lecomte", geo:"Aix-en-Provence 🇫🇷", sub:"Bouches-du-Rhône", contact:"Sophie Lecomte", email:"contact@sophie-lecomte.com", phone:"+33 4 42 38 00 00", tags:["Pionnière","Artistique"], note:"35 ans. Pionnière en France. Suivi ultra-personnalisé." },
  { name:"École Terrade — Paris", geo:"Paris 🇫🇷", sub:"Nation", contact:"Conseiller orientation", email:"paris@ecoleterrade.com", phone:"+33 1 43 73 35 35", tags:["65 campus","Alternance"], note:"65 campus en France. Accord national possible. Alternance et CPF." },
  { name:"École Terrade — Bordeaux", geo:"Bordeaux 🇫🇷", sub:"Centre", contact:"Directrice campus", email:"bordeaux@ecoleterrade.com", phone:"+33 5 56 44 00 00", tags:["65 campus","Alternance"], note:"Campus Bordeaux. Même réseau Terrade." },
  { name:"Institut Supérieur des Arts Appliqués LISAA", geo:"Paris 🇫🇷", sub:"Montparnasse", contact:"Responsable partenariats", email:"contact@lisaa.com", phone:"+33 1 45 44 97 00", tags:["Design","Mode"], note:"École design & mode avec département maquillage. Profil haut de gamme." },
  { name:"CFA Beauté — Marseille", geo:"Marseille 🇫🇷", sub:"Centre", contact:"Directeur CFA", email:"contact@cfa-beaute-marseille.fr", phone:"+33 4 91 55 00 00", tags:["CFA","Apprentissage"], note:"Budget OPCO. Public apprentis. Volume potentiel important." },
  { name:"Institut de Formation Esthétique Toulouse", geo:"Toulouse 🇫🇷", sub:"Capitole", contact:"Directrice", email:"contact@ife-toulouse.fr", phone:"+33 5 61 23 00 00", tags:["Sud-Ouest","Esthétique"], note:"Grand bassin recrutement. Toulouse = 4ème ville France." },
  { name:"École de Maquillage Artistique Strasbourg", geo:"Strasbourg 🇫🇷", sub:"Centre", contact:"Direction pédagogique", email:"contact@ema-strasbourg.fr", phone:"+33 3 88 22 00 00", tags:["Alsace","Artistique"], note:"Zone bilingue. Ouverture marché allemand potentielle." },
].map(e=>({...e, id:"seed_"+uid(), valeur:18000, status:"À contacter", assignedTo:null, lastEditBy:null, lastEditAt:null, _proj:"makeup"}));

const SEED_3D = [
  { name:"DeltaThinkers Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Botafogo", contact:"Diretor técnico", email:"contato@deltathinkers.com", phone:"+55 21 3000-0000", tags:["Hub 3D","Laser"], note:"Hub de serviços 3D + corte laser. Le plus équipé de Rio. Sous-traitance possible." },
  { name:"Create 3D — Urca", geo:"Rio de Janeiro 🇧🇷", sub:"Urca", contact:"Lia Scoelho", email:"create3d@gmail.com", phone:"+55 21 99000-0000", tags:["Prototypes","Trophées"], note:"Rua Dr. Xavier Siagaut, Urca. Prototypes, trophées, maquettes." },
  { name:"Universe 3D", geo:"Rio de Janeiro 🇧🇷", sub:"Barra da Tijuca", contact:"Diretor comercial", email:"contato@universe3d.com.br", phone:"+55 21 3500-0000", tags:["Architecture","Médical"], note:"Architecture, médecine, orthodontie, design. Labo filament + résine." },
  { name:"Algom 3D — Manufatura Digital", geo:"Rio de Janeiro 🇧🇷", sub:"Centro", contact:"Responsável projetos", email:"contato@algom3d.com.br", phone:"+55 21 2500-0000", tags:["Architecture","Décoration"], note:"Maquettes archi + décoration sur mesure. Cible architectes." },
  { name:"Elabora 3D Estúdio", geo:"Rio de Janeiro 🇧🇷", sub:"Centro", contact:"Studio manager", email:"elabora3destudio@gmail.com", phone:"+55 21 99100-0000", tags:["Studio","Modelagem"], note:"Rua do Ouvidor 63 — Centro RJ. Spécialistes impression 3D et modélisation." },
  { name:"Escritório Zanettini Arquitetura RJ", geo:"Rio de Janeiro 🇧🇷", sub:"Ipanema", contact:"Arquiteto responsável", email:"rio@zanettini.com.br", phone:"+55 21 2522-0000", tags:["Architecture","Prestige"], note:"Cabinet archi prestige. Maquettes 3D pour présentations clients." },
  { name:"FGV Rio — Lab Inovação", geo:"Rio de Janeiro 🇧🇷", sub:"Botafogo", contact:"Coordenador inovação", email:"inovacao@fgv.br", phone:"+55 21 3799-0000", tags:["Éducation","Innovation"], note:"Grande école de gestion. Prototypes pédagogiques. Client institutionnel stable." },
  { name:"PUC-Rio — FabLab", geo:"Rio de Janeiro 🇧🇷", sub:"Gávea", contact:"Prof. responsável fab lab", email:"fablab@puc-rio.br", phone:"+55 21 3527-0000", tags:["Université","FabLab"], note:"Fab Lab PUC-Rio. Filaments + sous-traitance surcharge. Volume récurrent." },
  { name:"Museu do Amanhã — Loja Design", geo:"Rio de Janeiro 🇧🇷", sub:"Porto Maravilha", contact:"Responsável loja", email:"loja@museudeamanha.org.br", phone:"+55 21 3812-1800", tags:["Culture","Design"], note:"Musée futuriste. Boutique design. Pièces décoratives exclusives très visibles." },
  { name:"SENAI Rio — Tecnologia Industrial", geo:"Rio de Janeiro 🇧🇷", sub:"Maracanã", contact:"Coordenador técnico", email:"rio@senai.br", phone:"+55 21 2111-0000", tags:["Industrie","Formation"], note:"Centre formation industrielle. Impression 3D pour formations techniques. Grand volume." },
  { name:"Instituto Europeu de Design IED Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Flamengo", contact:"Coordenador cursos", email:"rio@ied.edu.br", phone:"+55 21 2556-0000", tags:["Design","Mode"], note:"École design internationale. Prototypes mode et produit. Profil créatif premium." },
  { name:"Studio MK27 Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Botafogo", contact:"Coordenador projetos", email:"rio@studiomk27.com.br", phone:"+55 21 3300-0000", tags:["Design","Intérieur"], note:"Studio design d'intérieur reconnu. Pièces décoratives sur mesure." },
  { name:"Ateliê Marko Brajovic Rio", geo:"Rio de Janeiro 🇧🇷", sub:"Jardim Botânico", contact:"Responsável ateliê", email:"rio@brajovic.com.br", phone:"+55 21 2294-0000", tags:["Design","Prestige"], note:"Designer d'intérieur star brésilien. Pièces uniques. Clients très haut de gamme." },
  { name:"NBBJ Brasil — Architecture", geo:"Rio de Janeiro 🇧🇷", sub:"Leblon", contact:"Responsável Rio", email:"rio@nbbj.com", phone:"+55 21 3200-0000", tags:["Architecture","International"], note:"Cabinet archi international. Maquettes et prototypes premium." },
  { name:"Fácil 3D Rio de Janeiro", geo:"Rio de Janeiro 🇧🇷", sub:"Centro", contact:"Responsável comercial", email:"contato@facil3d.com.br", phone:"+55 21 3100-0000", tags:["Service","B2B"], note:"Service impression 3D local. Coût-bénéfice. Partenariat sous-traitance possible." },
].map(e=>({...e, id:"seed_"+uid(), valeur:0, status:"Prospect", assignedTo:null, lastEditBy:null, lastEditAt:null, _proj:"print3d"}));
const decodeSnippet = s => {
  if (!s) return "";
  return s
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g," ")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n))
    .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCharCode(parseInt(h,16)));
};
const fmtEur = n => !n ? "€0" : n >= 1000000 ? `€${(n/1000000).toFixed(1)}M` : n >= 1000 ? `€${Math.round(n/1000)}k` : `€${Math.round(n)}`;
const fmtBrl = n => !n ? "R$0" : n >= 1000000 ? `R$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `R$${(n/1000).toFixed(1)}k` : `R$${Math.round(n)}`;
const fmt = fmtEur; // défaut euro, utilisé par vin/makeup
const ago = ts => { if(!ts) return "–"; const m=Math.floor((Date.now()-ts)/60000); if(m<1) return "maintenant"; if(m<60) return `${m}min`; const h=Math.floor(m/60); if(h<24) return `${h}h`; return `${Math.floor(h/24)}j`; };

// ── WhatsApp helper ────────────────────────────────────────────────────────
const waLink = (phone, text) => {
  // Extraire le meilleur numéro (préférer +55 / brésilien)
  const parts = (phone||"").split(/\s{2,}|,|;/).map(s=>s.trim()).filter(Boolean);
  const br = parts.find(p=>p.includes("+55")||(/^\d{10,11}$/.test(p.replace(/\D/g,""))&&!p.includes("+1")));
  const raw = (br || parts[0] || "").replace(/[^\d]/g,"");
  const num = raw.length >= 12 ? raw : raw.length >= 10 ? `55${raw}` : raw;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
};

// ── Célébration confettis + son ─────────────────────────────────────────────
function celebrate() {
  // Son de victoire (accord majeur synthétisé)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playNote = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    playNote(523, 0, 0.15);    // C5
    playNote(659, 0.1, 0.15);  // E5
    playNote(784, 0.2, 0.15);  // G5
    playNote(1047, 0.3, 0.4);  // C6
    playNote(784, 0.3, 0.4);   // G5
    playNote(1047, 0.5, 0.6);  // C6 long
  } catch(_) {}

  // Confettis DOM
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;overflow:hidden";
  document.body.appendChild(container);
  const colors = ["#22c55e","#f59e0b","#3b82f6","#ec4899","#8b5cf6","#14b8a6","#ef4444","#fbbf24"];
  const emojis = ["GOOOL","GOOOL","GOOOL","GOOOL"];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement("div");
    const isEmoji = i < 4;
    const x = Math.random() * 100;
    const delay = Math.random() * 0.8;
    const dur = 1.5 + Math.random() * 1.5;
    const size = isEmoji ? 28 : (6 + Math.random() * 8);
    const rot = Math.random() * 720 - 360;
    el.textContent = isEmoji ? emojis[i] : "";
    el.style.cssText = `position:absolute;top:-20px;left:${x}%;width:${size}px;height:${isEmoji?"auto":size+"px"};
      background:${isEmoji?"none":colors[i%colors.length]};border-radius:${Math.random()>0.5?"50%":"2px"};
      font-size:${isEmoji?size:0}px;font-weight:900;color:#4ade80;text-shadow:0 2px 8px #00000080;
      animation:confetti-fall ${dur}s ease-in ${delay}s forwards`;
    container.appendChild(el);
  }
  // Animation keyframes
  if (!document.getElementById("confetti-style")) {
    const style = document.createElement("style");
    style.id = "confetti-style";
    style.textContent = `@keyframes confetti-fall {
      0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
      80% { opacity: 1; }
      100% { transform: translateY(105vh) rotate(${360}deg) scale(0.5); opacity: 0; }
    }`;
    document.head.appendChild(style);
  }
  setTimeout(() => container.remove(), 4000);
}
const today = () => new Date().toISOString().slice(0,10);

const calcTax = (fob, eurBrl=5.40) => {
  const fobBrl=fob*eurBrl, frete=fobBrl*0.10, cif=fobBrl+frete;
  const ii=cif*0.27, ipi=(cif+ii)*0.20, pisCof=(cif+ii+ipi)*0.0925;
  const icms=(cif+ii+ipi+pisCof)/(1-0.30)*0.30;
  const total=ii+ipi+pisCof+icms;
  return { totalEur: total/eurBrl, txEffective: (total/fobBrl*100).toFixed(1) };
};

// ─── COMPONENTS (defined outside App to fix the typing bug) ──────────────────

function StatCard({ label, value, sub, color, icon, onClick }) {
  return (
    <div onClick={onClick} style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:10,padding:"11px 14px",cursor:onClick?"pointer":"default"}}>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <div>
          <p style={{fontSize:10,color:"#3d4f6b",marginBottom:4,letterSpacing:".4px",textTransform:"uppercase",fontWeight:600}}>{label}</p>
          <p style={{fontSize:18,fontWeight:700,color:color||"#f1f5f9"}}>{value}</p>
          {sub && <p style={{fontSize:10,color:"#4b5563",marginTop:2}}>{sub}</p>}
        </div>
        <span style={{fontSize:16,opacity:.4}}>{icon}</span>
      </div>
    </div>
  );
}

function KanbanCard({ prospect, accent, onOpen, prospectEmails }) {
  const P = PROJECTS[prospect._proj] || PROJECTS["vin"] || Object.values(PROJECTS)[0];
  const col = (P.statusColors && P.statusColors[prospect.status]) || "#6b7280";
  const au = prospect.assignedTo ? USERS[prospect.assignedTo] : null;

  const isVinClient = (p) => {
    const tel = (p.phone||"").replace(/\s/g,"");
    const em = (p.email||"").toLowerCase();
    if (tel.startsWith("+55") || tel.startsWith("55")) return true;
    if (em.endsWith(".br")) return true;
    if ((p.geo||"").includes("🇧🇷")) return true;
    return false;
  };
  const isVin = prospect._proj === "vin" || prospect._proj === "vinClients";
  const vinType = isVin ? (isVinClient(prospect) ? "client" : "fournisseur") : null;

  // Badge email
  const emails = (prospectEmails||{})[prospect.id]||[];
  const lastEmail = emails.length > 0 ? emails[0] : null;
  const hasSent = emails.some(e=>e.folder==="Envoyés");
  const hasReply = emails.some(e=>e.folder==="Reçus");
  const daysSince = lastEmail?.timestamp ? Math.floor((Date.now()-lastEmail.timestamp)/86400000) : null;

  // Alerte relance si contacté mais silence > 14 jours
  const needsFollowUp = hasSent && !hasReply && daysSince !== null && daysSince >= 14;

  return (
    <div onClick={() => onOpen(prospect)} draggable
      onDragStart={e=>{e.dataTransfer.setData("prospectId",prospect.id);e.dataTransfer.setData("prospectProj",prospect._proj||"");e.dataTransfer.effectAllowed="move";e.currentTarget.style.opacity="0.4";}}
      onDragEnd={e=>{e.currentTarget.style.opacity="1";}}
      style={{background:"#0d1120",border:`1px solid ${needsFollowUp?"#ef444440":col+"25"}`,borderLeft:`3px solid ${needsFollowUp?"#ef4444":col}`,borderRadius:9,padding:"10px 12px",marginBottom:7,cursor:"grab",transition:"background .12s"}}
      onMouseEnter={e=>e.currentTarget.style.background="#111828"}
      onMouseLeave={e=>e.currentTarget.style.background="#0d1120"}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
        <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",lineHeight:1.3,flex:1,marginRight:6}}>{prospect.name}</p>
        <div style={{display:"flex",gap:3,alignItems:"center",flexShrink:0}}>
          {needsFollowUp && <span title={`Silence depuis ${daysSince}j`} style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"#ef444420",color:"#f87171",fontWeight:700}}>🔔 {daysSince}j</span>}
          {hasReply && <span title="Réponse reçue" style={{fontSize:9}}>💬</span>}
          {hasSent && !hasReply && !needsFollowUp && <span title="Email envoyé" style={{fontSize:9}}>✉️</span>}
          {vinType==="client" && <span style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"#f59e0b20",color:"#fbbf24",fontWeight:600}}>🥂 Client</span>}
          {vinType==="fournisseur" && <span style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"#8b5cf620",color:"#a78bfa",fontWeight:600}}>🍷 Four.</span>}
        </div>
      </div>
      {prospect.geo && <p style={{fontSize:10,color:"#4b5563",marginBottom:4}}>{prospect.geo}{prospect.sub?` · ${prospect.sub}`:""}</p>}
      <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
        {(prospect.tags||[]).slice(0,2).map(t=>(
          <span key={t} style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:`${accent}15`,color:accent,fontWeight:600}}>{t}</span>
        ))}
      </div>
      {au && (
        <div style={{display:"flex",alignItems:"center",gap:4,marginTop:5}}>
          <div style={{width:14,height:14,borderRadius:"50%",background:au.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700,color:"white"}}>{au.avatar}</div>
          <span style={{fontSize:10,color:au.color}}>{au.label}</span>
        </div>
      )}
    </div>
  );
}

function ModalWrap({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(()=>{ if(ref.current) ref.current.scrollTop=0; },[]);
  return (
    <div style={{position:"fixed",inset:0,background:"#000000c0",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:200,overflowY:"auto",padding:"20px 0"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div ref={ref} style={{background:"#0d1020",border:"1px solid #1a2035",borderRadius:14,padding:22,width:wide?660:500,maxWidth:"94vw",maxHeight:"90vh",overflow:"auto",animation:"fi .2s ease"}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <p style={{fontSize:14,fontWeight:600,color:"#f1f5f9"}}>{title}</p>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer",fontSize:22,lineHeight:1,padding:"0 4px"}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type, options }) {
  const base = {width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"};
  return (
    <div style={{marginBottom:11}}>
      <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".4px"}}>{label}</p>
      {options
        ? <select value={value} onChange={e=>onChange(e.target.value)} style={base}>
            {options.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        : <input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base}/>
      }
    </div>
  );
}

function AddProspectModal({ projId, onAdd, onClose, allProspects=[] }) {
  const P = PROJECTS[projId] || Object.values(PROJECTS)[0];
  const isVin = projId === "vin";
  const [name,             setName]             = useState("");
  const [cnpj,             setCnpj]             = useState("");
  const [cnpjLoading,      setCnpjLoading]      = useState(false);
  const [cnpjError,        setCnpjError]        = useState("");
  const [geo,              setGeo]              = useState(projId==="print3d"?"Rio de Janeiro 🇧🇷":"France 🇫🇷");
  const [sub,              setSub]              = useState("");
  const [contact,          setContact]          = useState("");
  const [email,            setEmail]            = useState("");
  const [phone,            setPhone]            = useState("");
  const [valeur,           setValeur]           = useState("");
  const [note,             setNote]             = useState("");
  const [tag1,             setTag1]             = useState("");
  const [tag2,             setTag2]             = useState("");
  // Champs vin
  const [type,             setType]             = useState("Rouge");
  const [producteur,       setProducteur]       = useState("");
  const [cepage,           setCepage]           = useState("");
  const [appellation,      setAppellation]      = useState("");
  const [millesime,        setMillesime]        = useState("");
  const [certificat,       setCertificat]       = useState("");
  const [alcool,           setAlcool]           = useState("");
  const [bio,              setBio]              = useState(false);
  const [incoterm,         setIncoterm]         = useState("FOB");
  const [prixProducteur,   setPrixProducteur]   = useState("");
  const [prixMagasinFr,    setPrixMagasinFr]    = useState("");
  const [prixVenteBresil,  setPrixVenteBresil]  = useState("");
  const [prixMercadoLivre, setPrixMercadoLivre] = useState("");
  const [minCommande,      setMinCommande]      = useState("6");

  const lookupCnpj = async (raw) => {
    const digits = raw.replace(/\D/g,"");
    if (digits.length !== 14) { setCnpjError("CNPJ doit contenir 14 chiffres"); return; }
    setCnpjLoading(true); setCnpjError("");
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!r.ok) { setCnpjError("CNPJ introuvable"); setCnpjLoading(false); return; }
      const d = await r.json();
      if (d.razao_social) setName(d.nome_fantasia || d.razao_social);
      if (d.email) setEmail(d.email.toLowerCase());
      if (d.ddd_telefone_1) setPhone(`+55${d.ddd_telefone_1}`);
      const cidade = d.municipio || "";
      const uf = d.uf || "";
      if (cidade || uf) { setGeo(`${cidade}${uf?`, ${uf}`:""} 🇧🇷`); setSub(d.bairro||""); }
      if (d.qsa?.length) setContact(d.qsa[0].nome_socio || "");
      setNote(prev => {
        const info = `CNPJ: ${digits} · ${d.razao_social||""}${d.cnae_fiscal_descricao?` · ${d.cnae_fiscal_descricao}`:""}`;
        return prev ? `${prev}\n${info}` : info;
      });
    } catch(e) { setCnpjError("Erreur de connexion"); }
    setCnpjLoading(false);
  };

  // Suggestions de prospects existants basées sur le nom tapé
  const nameLower = name.trim().toLowerCase();
  const suggestions = nameLower.length >= 2
    ? allProspects.filter(p => p.name?.toLowerCase().includes(nameLower))
    : [];
  const exactMatch = allProspects.find(p => p.name?.toLowerCase() === nameLower);

  const submit = () => {
    if (!name.trim()) return;
    if (exactMatch && !confirm(`"${exactMatch.name}" existe déjà dans ${PROJECTS[exactMatch._projKey]?.label||exactMatch._projKey}. Créer quand même ?`)) return;
    // Détection auto client Brésil vs fournisseur France
    const isBresil = phone.replace(/\s/g,"").startsWith("+55")
      || phone.replace(/\s/g,"").startsWith("55")
      || email.toLowerCase().endsWith(".br")
      || geo.includes("🇧🇷");
    const _proj = (isVin && isBresil) ? "vinClients" : projId;
    const P2 = PROJECTS[_proj] || P;
    onAdd({ id: projId.slice(0,2)+uid(), name, cnpj: cnpj.replace(/\D/g,"")||undefined, geo, sub, contact, email, phone,
      valeur: parseInt(valeur)||0, note, tags:[tag1,tag2].filter(Boolean),
      status: P2.statuses[0], assignedTo:null, lastEditBy:null, lastEditAt:null,
      _proj,
      ...(isVin && { type, producteur, cepage, appellation, millesime, certificat, alcool, bio,
        incoterm, prixProducteur, prixMagasinFr, prixVenteBresil, prixMercadoLivre, minCommande }) });
  };

  return (
    <ModalWrap title={`➕ ${isVin?"Nouveau contact Vin":P.label}`} onClose={onClose} wide={isVin}>
      {isVin && (
        <div style={{marginBottom:12,padding:"7px 12px",borderRadius:7,background:(phone.includes("+55")||email.endsWith(".br")||geo.includes("🇧🇷"))?"#f59e0b18":"#8b5cf618",border:`1px solid ${(phone.includes("+55")||email.endsWith(".br")||geo.includes("🇧🇷"))?"#f59e0b30":"#8b5cf630"}`,fontSize:11,color:(phone.includes("+55")||email.endsWith(".br")||geo.includes("🇧🇷"))?"#fbbf24":"#a78bfa",fontWeight:600}}>
          {(phone.includes("+55")||email.endsWith(".br")||geo.includes("🇧🇷")) ? "🥂 Sera classé Prospect client Brésil" : "🍷 Sera classé Fournisseur France"}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
        <div style={{gridColumn:"span 2",position:"relative"}}>
          <Field label="Nom *" value={name} onChange={setName} placeholder={isVin?"Château Pichon Baron / Restaurant Fasano...":projId==="print3d"?"Studio Durand Architecture...":"Académie du Maquillage..."}/>
          {suggestions.length > 0 && (
            <div style={{position:"absolute",left:0,right:0,top:"100%",zIndex:10,background:"#0b0d16",border:"1px solid #1a2035",borderRadius:7,maxHeight:150,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}>
              <p style={{fontSize:9,color:"#4b5563",padding:"6px 10px 2px",textTransform:"uppercase",fontWeight:600}}>Clients existants</p>
              {suggestions.slice(0,5).map(p=>(
                <div key={p.id} style={{padding:"6px 10px",cursor:"default",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #0f1520"}}>
                  <span style={{fontSize:12,color:p.name.toLowerCase()===nameLower?"#f87171":"#e2e8f0",fontWeight:p.name.toLowerCase()===nameLower?700:400}}>{p.name}</span>
                  <span style={{fontSize:10,color:"#4b5563"}}>{PROJECTS[p._projKey]?.icon} {PROJECTS[p._projKey]?.label}</span>
                </div>
              ))}
              {exactMatch && <p style={{fontSize:10,color:"#f87171",padding:"4px 10px",fontWeight:600}}>⚠ Doublon exact</p>}
            </div>
          )}
        </div>

        {/* CNPJ lookup — projets brésiliens */}
        {(projId==="print3d"||projId==="vinClients"||(isVin&&geo.includes("🇧🇷"))) && (
          <div style={{gridColumn:"span 2",marginBottom:8}}>
            <p style={{fontSize:10,color:"#4b5563",fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>CNPJ <span style={{fontWeight:400,textTransform:"none"}}>(auto-remplir)</span></p>
            <div style={{display:"flex",gap:6}}>
              <input value={cnpj} onChange={e=>setCnpj(e.target.value)} placeholder="00.000.000/0000-00"
                style={{flex:1,padding:"7px 9px",borderRadius:7,fontSize:12,outline:"none",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"}}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();lookupCnpj(cnpj);}}}/>
              <button onClick={()=>lookupCnpj(cnpj)} disabled={cnpjLoading}
                style={{padding:"7px 14px",borderRadius:7,fontSize:11,fontWeight:600,cursor:cnpjLoading?"default":"pointer",background:"#14b8a618",border:"1px solid #14b8a628",color:"#2dd4bf",opacity:cnpjLoading?0.6:1}}>
                {cnpjLoading?"…":"🔍 Buscar"}
              </button>
            </div>
            {cnpjError&&<p style={{fontSize:10,color:"#f87171",marginTop:4}}>{cnpjError}</p>}
          </div>
        )}

        {/* Dropdown pays pour vin */}
        {isVin ? (
          <div style={{marginBottom:8}}>
            <p style={{fontSize:10,color:"#4b5563",fontWeight:600,marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Pays</p>
            <div style={{display:"flex",gap:6}}>
              {[["France 🇫🇷","🇫🇷 France"],["Rio de Janeiro 🇧🇷","🇧🇷 Brésil"],["Autre","🌍 Autre"]].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setGeo(v)}
                  style={{flex:1,padding:"7px 4px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",
                    background:geo===v?"#8b5cf620":"#0b0d16",
                    border:`1px solid ${geo===v?"#8b5cf6":"#1a2035"}`,
                    color:geo===v?"#a78bfa":"#4b5563",transition:"all .15s"}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Field label="Pays / Région" value={geo} onChange={setGeo} placeholder="France 🇫🇷"/>
        )}

        <Field label={isVin?"Région / Ville":"Secteur / Détail"} value={sub} onChange={setSub} placeholder={isVin?"Bordeaux, São Paulo...":"8ème arr."}/>

        {/* Champs contact rapides — toujours visibles */}
        <Field label="Email" value={email} onChange={setEmail} placeholder="contact@..."/>
        <Field label="Téléphone" value={phone} onChange={setPhone} placeholder={geo.includes("🇧🇷")?"+55 21...":"+33 1..."}/>

        {isVin && <>
          <Field label="Type" value={type} onChange={setType} options={["Rouge","Blanc","Rosé","Pétillant","Mousseux","Orange"]}/>
          <Field label="Producteur" value={producteur} onChange={setProducteur} placeholder="Famille Martin..."/>
          <Field label="Cépage(s)" value={cepage} onChange={setCepage} placeholder="Cabernet Sauvignon..."/>
          <Field label="Appellation" value={appellation} onChange={setAppellation} placeholder="Saint-Émilion Grand Cru AOC"/>
          <Field label="Millésime" value={millesime} onChange={setMillesime} placeholder="2021"/>
          <Field label="Alcool (%)" value={alcool} onChange={setAlcool} placeholder="13.5"/>

          <div style={{gridColumn:"span 2",margin:"4px 0 10px"}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
              <div onClick={()=>setBio(!bio)} style={{width:36,height:20,borderRadius:10,background:bio?"#22c55e":"#1a2035",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:bio?18:2,width:16,height:16,borderRadius:"50%",background:"white",transition:"left .2s"}}/>
              </div>
              <span style={{fontSize:11,color:bio?"#4ade80":"#6b7280",fontWeight:600}}>🌿 Bio / Biodynamique</span>
            </label>
          </div>

          <Field label="Tag 1" value={tag1} onChange={setTag1} placeholder="Bio"/>
          <Field label="Tag 2" value={tag2} onChange={setTag2} placeholder="Volume"/>
        </>}

        {!isVin && <>
          <Field label="Contact" value={contact} onChange={setContact} placeholder="Prénom Nom"/>
          <Field label="Valeur estimée (€)" value={valeur} onChange={setValeur} placeholder="15000"/>
          <Field label="Tag 1" value={tag1} onChange={setTag1} placeholder={projId==="print3d"?"Architecture":"Artistique"}/>
          <Field label="Tag 2" value={tag2} onChange={setTag2} placeholder={projId==="print3d"?"Sur mesure":"Scénique"}/>
        </>}

        {isVin && <>
          <Field label="Contact" value={contact} onChange={setContact} placeholder="Prénom Nom"/>
          <Field label="Email" value={email} onChange={setEmail} placeholder="contact@..."/>
          <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="+33 ..."/>
          <Field label="Valeur estimée (€)" value={valeur} onChange={setValeur} placeholder="85000"/>
        </>}

        <div style={{gridColumn:"span 2",marginBottom:12}}>
          <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".4px"}}>Note</p>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Contexte, opportunité, points clés..."
            style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,resize:"none",height:55,outline:"none",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit",lineHeight:1.6}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={submit} style={{flex:1,padding:"9px",background:`linear-gradient(135deg,${P.color},${P.color}aa)`,border:"none",borderRadius:7,color:"white",fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ Ajouter</button>
        <button onClick={onClose} style={{padding:"9px 14px",background:"#0b0d16",border:"1px solid #0f1520",borderRadius:7,color:"#6b7280",fontSize:12,cursor:"pointer"}}>Annuler</button>
      </div>
    </ModalWrap>
  );
}

function AddOrderModal({ projId, prospects, preselect, onAdd, onClose }) {
  const isVin = projId==="vin", is3D = projId==="print3d";
  const [prospectId,   setProspectId]   = useState(preselect?.id||"");
  const [type,         setType]         = useState(is3D?"devis":"commande");
  const [product,      setProduct]      = useState("");
  const [amount,       setAmount]       = useState("");
  const [qty,          setQty]          = useState("1");
  const [date,         setDate]         = useState(today());
  const [deliveryDate, setDeliveryDate] = useState("");
  const [status,       setStatus]       = useState(is3D?"Brouillon":"En attente");
  const [notes,        setNotes]        = useState("");

  const taxes = isVin && parseFloat(amount) ? calcTax(parseFloat(amount)) : null;

  const submit = () => {
    if (!amount) return;
    const prospect = prospects.find(x=>x.id===prospectId) || preselect;
    onAdd({ id:"ord"+uid(), proj:projId, prospectId, prospectName:prospect?.name||"–",
      type, product, qty:parseInt(qty)||1, amount:parseFloat(amount)||0,
      date, deliveryDate, status, notes, taxData:taxes });
  };

  return (
    <ModalWrap title={`📦 ${is3D?"Devis / Commande":isVin?"Commande fournisseur":"Inscription école"}`} onClose={onClose} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
        <div style={{gridColumn:"span 2",marginBottom:11}}>
          <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".4px"}}>{isVin?"Fournisseur":is3D?"Client":"École"}</p>
          <select value={prospectId} onChange={e=>setProspectId(e.target.value)}
            style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none",cursor:"pointer",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"}}>
            <option value="">— Sélectionner</option>
            {prospects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {is3D && <Field label="Type" value={type} onChange={setType} options={["devis","commande","facture"]}/>}
        <Field label="Produit / Description" value={product} onChange={setProduct} placeholder={is3D?"Pièce architecturale sur mesure...":isVin?"Barolo 2021...":"Package Carnaval Gall"}/>
        <Field label={isVin?"Montant FOB (€)":"Montant (€)"} value={amount} onChange={setAmount} placeholder="5000"/>
        <Field label="Quantité" value={qty} onChange={setQty} placeholder="1"/>
        <Field label="Date" value={date} onChange={setDate} type="date"/>
        <Field label="Date livraison" value={deliveryDate} onChange={setDeliveryDate} type="date"/>
        <Field label="Statut" value={status} onChange={setStatus} options={is3D?QUOTE_STATUSES:ORDER_STATUSES}/>
        <div style={{gridColumn:"span 2",marginBottom:11}}>
          <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".4px"}}>Notes</p>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Spécifications, conditions..."
            style={{width:"100%",padding:"7px 9px",borderRadius:7,fontSize:12,resize:"none",height:50,outline:"none",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit",lineHeight:1.6}}/>
        </div>
      </div>
      {taxes && (
        <div style={{marginBottom:12,padding:"10px 12px",background:"#1f0a0a",borderRadius:8,border:"1px solid #ef444420"}}>
          <p style={{fontSize:11,fontWeight:600,color:"#f87171",marginBottom:6}}>🇧🇷 Taxes import Brésil estimées</p>
          <div style={{display:"flex",gap:20}}>
            <div><p style={{fontSize:10,color:"#4b5563"}}>FOB</p><p style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{fmt(parseFloat(amount))}</p></div>
            <div><p style={{fontSize:10,color:"#4b5563"}}>Taxes</p><p style={{fontSize:13,fontWeight:700,color:"#f87171"}}>{fmt(taxes.totalEur)}</p></div>
            <div><p style={{fontSize:10,color:"#4b5563"}}>Taux effectif</p><p style={{fontSize:13,fontWeight:700,color:"#f87171"}}>{taxes.txEffective}%</p></div>
            <div><p style={{fontSize:10,color:"#4b5563"}}>Prix revient</p><p style={{fontSize:13,fontWeight:700,color:"#fbbf24"}}>{fmt(parseFloat(amount)+taxes.totalEur)}</p></div>
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:8}}>
        <button onClick={submit} style={{flex:1,padding:"9px",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:7,color:"white",fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ Enregistrer</button>
        <button onClick={onClose} style={{padding:"9px 14px",background:"#0b0d16",border:"1px solid #0f1520",borderRadius:7,color:"#6b7280",fontSize:12,cursor:"pointer"}}>Annuler</button>
      </div>
    </ModalWrap>
  );
}

// ── Slider réutilisable ─────────────────────────────────────────────────────

function SliderField({ label, value, onChange, min, max, step, color }) {
  const ls = {fontSize:9,color:"#4b5563",marginBottom:3,fontWeight:600,textTransform:"uppercase",letterSpacing:".3px"};
  return (
    <div style={{marginBottom:2}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
        <p style={ls}>{label}</p>
        <input type="number" value={value} onChange={e=>onChange(e.target.value)} step={step} min={0}
          style={{width:80,padding:"2px 6px",borderRadius:5,fontSize:11,fontWeight:700,color:color||"#e2e8f0",background:"#080a0f",border:"1px solid #1a2035",textAlign:"right",fontFamily:"inherit",outline:"none"}}/>
      </div>
      <input type="range" min={min} max={max} step={step} value={Math.min(value, max)}
        onChange={e=>onChange(e.target.value)}
        style={{width:"100%",accentColor:color||"#14b8a6",height:4,cursor:"pointer"}}/>
    </div>
  );
}

// ── Calculateur de Devis Impression 3D ──────────────────────────────────────

function Print3DCalculator({ prospects, orders, onSaveQuote, onSaveWithNewClient, filamentStock, onUpdateStock }) {
  const [poids, setPoids]             = useState("");
  const [poidsSupports, setPoidsSupports] = useState("");
  const [heures, setHeures]           = useState("");
  const [qty, setQty]                   = useState("1");
  const [coutFilament, setCoutFilament] = useState("100");
  const [coutKwh, setCoutKwh]         = useState("0.98");
  const [puissanceW, setPuissanceW]   = useState("350");
  const [tauxMO, setTauxMO]           = useState("0");
  const [coutsFixes, setCoutsFixes]   = useState("0");
  const [hMoisMachine, setHMoisMachine] = useState("160");
  const [margeMode, setMargeMode]       = useState("pct"); // "pct" | "mult"
  const [margePct, setMargePct]         = useState("30");
  const [margeMult, setMargeMult]       = useState("2");
  const [clientId, setClientId]         = useState("");
  const [projetNom, setProjetNom]       = useState("");
  const [fileName, setFileName]         = useState("");
  const [copied, setCopied]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [thumbnail, setThumbnail]       = useState("");
  const [newClientMode, setNewClientMode] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [selectedSpool, setSelectedSpool] = useState("");

  // Extraction poids et temps depuis G-code (commentaires en tête de fichier)
  const [parseStatus, setParseStatus] = useState("");

  // Parse gcode text content (head + tail)
  const parseGcodeText = (head, tail) => {
    const text = head + "\n" + tail;

      // ── Extraction thumbnail (prendre la plus grande) ──
      // OrcaSlicer : ; thumbnail begin 300x300 29724
      // Creality Print : ; png begin 300*300 30380 7 253 1000
      const thumbs = [...head.matchAll(/; (?:thumbnail|png) begin (\d+)[x*](\d+)[^\r\n]*\r?\n([\s\S]*?); (?:thumbnail|png) end/g)];
      if (thumbs.length > 0) {
        const best = thumbs.reduce((a, b) => parseInt(a[1]) > parseInt(b[1]) ? a : b);
        const b64 = best[3].replace(/^; /gm, "").replace(/[\r\n]/g, "");
        setThumbnail("data:image/png;base64," + b64);
      }
      const infos = [];
      let tm;

      // ── Temps d'impression ──
      // OrcaSlicer/PrusaSlicer : ; estimated printing time (normal mode) = 2h 14m 51s
      tm = text.match(/;\s*estimated printing time[^=]*=\s*([^\n]+)/i);
      if (tm) {
        const ts = tm[1];
        const d = ts.match(/(\d+)\s*d/), h = ts.match(/(\d+)\s*h/), m = ts.match(/(\d+)\s*m/), s = ts.match(/(\d+)\s*s/);
        const sec = (d?parseInt(d[1])*86400:0) + (h?parseInt(h[1])*3600:0) + (m?parseInt(m[1])*60:0) + (s?parseInt(s[1]):0);
        if (sec > 0) {
          const hrs = Math.round(sec / 360) / 10;
          setHeures(String(hrs));
          infos.push(`${hrs}h`);
        }
      }
      // Cura : ;TIME:1234 (secondes)
      if (!infos.some(i => i.includes("h"))) {
        tm = text.match(/;\s*TIME\s*:\s*(\d+)/);
        if (tm) {
          const hrs = Math.round(parseInt(tm[1]) / 360) / 10;
          setHeures(String(hrs));
          infos.push(`${hrs}h`);
        }
      }

      // ── Poids filament ──
      // OrcaSlicer/PrusaSlicer : ; total filament used [g] = 26.63
      let totalG = 0;
      tm = text.match(/;\s*total filament used \[g\]\s*=\s*([\d.]+)/i);
      if (!tm) tm = text.match(/;\s*filament used \[g\]\s*=\s*([\d.]+)/i);
      if (tm) totalG = parseFloat(tm[1]);
      // Cura : ;Filament used: 5.4321m → ~3g/m PLA 1.75mm
      if (!totalG) {
        tm = text.match(/;\s*Filament used:\s*([\d.]+)\s*m/i);
        if (tm) totalG = Math.round(parseFloat(tm[1]) * 3);
      }

      // ── Supports activés ? ──
      const hasSupports = /;\s*enable_support\s*=\s*1/.test(text);

      if (totalG > 0) {
        if (hasSupports) {
          // Supports activés — estimer 15% de chutes/supports
          const supG = Math.round(totalG * 0.15);
          const pieceG = Math.round(totalG - supG);
          setPoids(String(pieceG));
          setPoidsSupports(String(supG));
          infos.push(`${pieceG}g pièce + ${supG}g supports (est.)`);
        } else {
          setPoids(String(Math.round(totalG)));
          infos.push(`${Math.round(totalG)}g filament`);
        }
      }

      // ── Layers ──
      tm = text.match(/;\s*total layer(?:s| number)\s*[:=]\s*(\d+)/i);
      if (tm) infos.push(`${tm[1]} layers`);

      if (infos.length > 0) {
        setParseStatus("✓ " + infos.join(" · "));
      } else {
        setParseStatus("Aucune donnée trouvée — saisis manuellement");
      }
  };

  const handleGcode = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseStatus("Lecture...");

    const is3MF = file.name.toLowerCase().endsWith(".3mf");

    if (is3MF) {
      // 3MF = ZIP — extraire le gcode dans un Worker
      const workerCode = `
        async function inflate(raw) {
          const ds = new DecompressionStream("deflate-raw");
          const w = ds.writable.getWriter(); w.write(raw); w.close();
          const r = ds.readable.getReader(); const parts = [];
          while (true) { const {done,value} = await r.read(); if (done) break; parts.push(value); }
          const t = parts.reduce((s,c)=>s+c.length,0); const m = new Uint8Array(t);
          let p = 0; for (const c of parts) { m.set(c,p); p+=c.length; } return m;
        }
        self.onmessage = async (e) => {
          try {
            const bytes = new Uint8Array(e.data); const len = bytes.length;
            let eocd = -1;
            for (let i = len-22; i >= Math.max(0,len-65557); i--) { if (bytes[i]===0x50&&bytes[i+1]===0x4B&&bytes[i+2]===0x05&&bytes[i+3]===0x06) { eocd=i; break; } }
            if (eocd===-1) { self.postMessage({error:"ZIP non reconnu"}); return; }
            const cdCount = bytes[eocd+8]|(bytes[eocd+9]<<8);
            const cdOff = bytes[eocd+16]|(bytes[eocd+17]<<8)|(bytes[eocd+18]<<16)|(bytes[eocd+19]<<24);
            let pos = cdOff; let gcodeHead = "", gcodeTail = "";
            for (let i = 0; i < cdCount && pos+46 <= len; i++) {
              if (bytes[pos]!==0x50||bytes[pos+1]!==0x4B||bytes[pos+2]!==0x01||bytes[pos+3]!==0x02) break;
              const method = bytes[pos+10]|(bytes[pos+11]<<8);
              const compSz = bytes[pos+20]|(bytes[pos+21]<<8)|(bytes[pos+22]<<16)|(bytes[pos+23]<<24);
              const nmLen = bytes[pos+28]|(bytes[pos+29]<<8);
              const exLen = bytes[pos+30]|(bytes[pos+31]<<8);
              const cmLen = bytes[pos+32]|(bytes[pos+33]<<8);
              const locOff = bytes[pos+42]|(bytes[pos+43]<<8)|(bytes[pos+44]<<16)|(bytes[pos+45]<<24);
              const name = new TextDecoder().decode(bytes.slice(pos+46,pos+46+nmLen)).toLowerCase();
              pos += 46+nmLen+exLen+cmLen;
              if (!name.endsWith(".gcode")) continue;
              const lnL = bytes[locOff+26]|(bytes[locOff+27]<<8);
              const leL = bytes[locOff+28]|(bytes[locOff+29]<<8);
              const dStart = locOff+30+lnL+leL;
              const raw = bytes.slice(dStart, dStart+compSz);
              let dec;
              if (method===0) dec = raw;
              else if (method===8) { try { dec = await inflate(raw); } catch(_) { continue; } }
              else continue;
              const full = new TextDecoder().decode(dec);
              gcodeHead = full.slice(0, 60000);
              gcodeTail = full.slice(-30000);
              break;
            }
            self.postMessage({gcodeHead, gcodeTail});
          } catch(err) { self.postMessage({error: err.message}); }
        };
      `;
      const blob = new Blob([workerCode], { type: "application/javascript" });
      const worker = new Worker(URL.createObjectURL(blob));
      worker.onmessage = (ev) => {
        worker.terminate();
        if (ev.data.error) { setParseStatus(ev.data.error); return; }
        if (!ev.data.gcodeHead && !ev.data.gcodeTail) { setParseStatus("Aucun gcode trouvé dans le 3MF"); return; }
        parseGcodeText(ev.data.gcodeHead, ev.data.gcodeTail);
      };
      worker.onerror = () => { worker.terminate(); setParseStatus("Erreur lecture 3MF"); };
      file.arrayBuffer().then(buf => worker.postMessage(buf, [buf]));
    } else {
      // Gcode direct — lire début + fin
      const size = file.size;
      const tailSize = Math.min(size, 30000);
      const readSlice = (start, end) => new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => resolve("");
        r.readAsText(file.slice(start, end));
      });
      Promise.all([readSlice(0, 60000), readSlice(size - tailSize, size)]).then(([head, tail]) => {
        parseGcodeText(head, tail);
      });
    }
  };

  const p  = parseFloat(poids) || 0;
  const ps = parseFloat(poidsSupports) || 0;
  const pTotal = p + ps;
  const h  = parseFloat(heures) || 0;
  const q  = Math.max(1, parseInt(qty) || 1);
  const cf = parseFloat(coutFilament) || 0;
  const ck = parseFloat(coutKwh) || 0;
  const pw = parseFloat(puissanceW) || 0;
  const mo = parseFloat(tauxMO) || 0;
  const fx = parseFloat(coutsFixes) || 0;
  const hm = parseFloat(hMoisMachine) || 1;
  // Coûts unitaires
  const custoMatPiece1    = p / 1000 * cf;
  const custoMatSupports1 = ps / 1000 * cf;
  const custoMaterial1    = custoMatPiece1 + custoMatSupports1;
  const custoEnergia1  = (pw / 1000) * h * ck;
  const custoMO1       = h * mo;
  const custoFixo1     = (fx / hm) * h;
  const custoUnit      = custoMaterial1 + custoEnergia1 + custoMO1 + custoFixo1;
  // Totaux × quantité
  const custoMatPiece    = custoMatPiece1 * q;
  const custoMatSupports = custoMatSupports1 * q;
  const custoMaterial    = custoMaterial1 * q;
  const custoEnergia  = custoEnergia1 * q;
  const custoMO       = custoMO1 * q;
  const custoFixo     = custoFixo1 * q;
  const custoTotal    = custoUnit * q;
  const prixVente     = margeMode === "mult"
    ? custoTotal * (parseFloat(margeMult) || 1)
    : custoTotal * (1 + (parseFloat(margePct) || 0) / 100);
  const lucro         = prixVente - custoTotal;
  const lucroPct      = prixVente > 0 ? (lucro / prixVente * 100) : 0;
  const prixUnitVente = q > 0 ? prixVente / q : 0;

  const R = v => `R$${v.toFixed(2)}`;

  const whatsappText = () => {
    const client = prospects.find(x=>x.id===clientId);
    return `*Orçamento Impressão 3D*\n` +
      (client ? `Cliente: ${client.name}\n` : "") +
      (projetNom ? `Projeto: ${projetNom}\n` : "") +
      (fileName ? `Arquivo: ${fileName}\n` : "") +
      `Qtd: ${q} peça(s)\n` +
      `Peso peça: ${p}g` + (ps ? ` + suportes: ${ps}g` : "") + ` · Tempo: ${h}h/peça\n` +
      `───────────────\n` +
      `Material peça: ${R(custoMatPiece)}\n` +
      (ps ? `Material suportes: ${R(custoMatSupports)}\n` : "") +
      `Energia: ${R(custoEnergia)}\n` +
      `Mão de obra: ${R(custoMO)}\n` +
      `Custos fixos: ${R(custoFixo)}\n` +
      `*Custo total: ${R(custoTotal)}*\n` +
      `───────────────\n` +
      `Preço total: *${R(prixVente)}*` + (q>1?` (${R(prixUnitVente)}/un.)` :"") + `\n` +
      `Lucro: ${R(lucro)} (${lucroPct.toFixed(1)}%)\n` +
      `\n_Orçamento válido por 7 dias_`;
  };

  const copyWhatsApp = () => {
    navigator.clipboard.writeText(whatsappText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasClient = newClientMode ? newClientName.trim() : clientId;

  const saveQuote = async () => {
    if (!hasClient) return;
    let finalClientId = clientId;
    let finalClientName = "";
    let newProspect = null;

    if (newClientMode && newClientName.trim()) {
      const newId = "p3d" + Math.random().toString(36).slice(2, 8);
      newProspect = {
        id: newId, name: newClientName.trim(), geo: "Rio de Janeiro", sub: "",
        contact: "", email: "", phone: "", valeur: 0, tags: [], status: "Prospect",
        assignedTo: null, lastEditBy: null, lastEditAt: Date.now(), note: "", _proj: "print3d"
      };
      finalClientId = newId;
      finalClientName = newClientName.trim();
      setNewClientMode(false);
      setNewClientName("");
      setClientId(newId);
    } else {
      const client = prospects.find(x => x.id === clientId);
      finalClientName = client?.name || "–";
    }

    const order = {
      id: "ord" + Math.random().toString(36).slice(2, 8),
      proj: "print3d",
      prospectId: finalClientId,
      prospectName: finalClientName,
      type: "devis",
      product: projetNom || fileName || "Pièce 3D",
      qty: q,
      amount: q > 0 ? prixVente / q : prixVente,
      date: new Date().toISOString().slice(0, 10),
      deliveryDate: "",
      status: "Brouillon",
      thumbnail: thumbnail || "",
      spoolId: selectedSpool || "",
      spoolColor: (filamentStock||[]).find(s=>s.id===selectedSpool)?.color || "",
      notes: `Pièce: ${p}g` + (ps ? ` · Supports: ${ps}g` : "") + ` · ${h}h · Mat pièce: ${R(custoMatPiece)}` + (ps ? ` · Mat supports: ${R(custoMatSupports)}` : "") + ` · Énergie: ${R(custoEnergia)} · MO: ${R(custoMO)} · Fixe: ${R(custoFixo)} · Custo: ${R(custoTotal)} · Prix: ${R(prixVente)} (${margeMode==="mult"?"x"+margeMult:margePct+"%"}) · Lucro: ${R(lucro)}`,
    };

    // Déduire le stock de filament si une bobine est sélectionnée
    if (selectedSpool && pTotal * q > 0 && onUpdateStock) {
      onUpdateStock(selectedSpool, pTotal * q);
    }

    if (newProspect) {
      await onSaveWithNewClient(newProspect, order);
    } else {
      await onSaveQuote(order);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputStyle = {width:"100%",padding:"7px 9px",borderRadius:7,fontSize:12,outline:"none",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"};
  const labelStyle = {fontSize:9,color:"#4b5563",marginBottom:3,fontWeight:600,textTransform:"uppercase",letterSpacing:".3px"};
  const cellStyle  = {background:"#080a0f",borderRadius:7,padding:"8px 10px",border:"1px solid #0f1520"};

  return (
    <div className="fade" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16,alignItems:"start"}}>
      {/* ── Panneau gauche : inputs ── */}
      <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,padding:16}}>
        <p style={{fontSize:12,fontWeight:700,color:"#14b8a6",marginBottom:14,textTransform:"uppercase",letterSpacing:".5px"}}>🧊 Calculateur de Devis</p>

        {/* Upload G-code */}
        <div style={{marginBottom:12}}>
          <p style={labelStyle}>Fichier G-code ou 3MF (optionnel)</p>
          <label style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:7,border:"1px dashed #1a2035",background:"#080a0f",cursor:"pointer"}}>
            <span style={{fontSize:11,color:fileName?"#14b8a6":"#4b5563"}}>{fileName||"Cliquer pour charger un .gcode ou .3mf"}</span>
            <input type="file" accept=".gcode,.gco,.g,.3mf" onChange={handleGcode} style={{display:"none"}}/>
          </label>
          {parseStatus&&<p style={{fontSize:10,color:parseStatus.startsWith("✓")?"#4ade80":"#f59e0b",marginTop:5}}>{parseStatus}</p>}
          {thumbnail&&<img src={thumbnail} alt="Aperçu" style={{width:"100%",borderRadius:7,marginTop:8,border:"1px solid #1a2035"}}/>}
        </div>

        {/* Client + Projet */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
              <p style={labelStyle}>{newClientMode?"Nouveau client":"Client"}</p>
              <button onClick={()=>{setNewClientMode(m=>!m);setNewClientName("");}} style={{fontSize:9,color:"#14b8a6",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>
                {newClientMode?"← Existant":"+ Nouveau"}
              </button>
            </div>
            {newClientMode ? (
              <input value={newClientName} onChange={e=>setNewClientName(e.target.value)} placeholder="Nom du client" style={{...inputStyle,borderColor:newClientName?"#14b8a640":"#1a2035"}}/>
            ) : (
              <select value={clientId} onChange={e=>setClientId(e.target.value)} style={inputStyle}>
                <option value="">— Sélectionner</option>
                {prospects.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <p style={{...labelStyle,marginBottom:3}}>Nom du projet</p>
            <input value={projetNom} onChange={e=>setProjetNom(e.target.value)} placeholder="Ex: Support caméra" style={inputStyle}/>
          </div>
        </div>

        {/* Poids + Supports + Heures + Quantité */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:4}}>
          <div>
            <p style={labelStyle}>Poids pièce (g)</p>
            <input type="number" value={poids} onChange={e=>setPoids(e.target.value)} placeholder="0" style={inputStyle}/>
          </div>
          <div>
            <p style={labelStyle}>Supports (g)</p>
            <input type="number" value={poidsSupports} onChange={e=>setPoidsSupports(e.target.value)} placeholder="0" style={inputStyle}/>
          </div>
          <div>
            <p style={labelStyle}>Temps (h)</p>
            <input type="number" value={heures} onChange={e=>setHeures(e.target.value)} placeholder="0" style={inputStyle}/>
          </div>
          <div>
            <p style={labelStyle}>Quantité</p>
            <input type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="1" min="1" style={inputStyle}/>
          </div>
        </div>
        {(p>0||ps>0)&&<p style={{fontSize:10,color:"#4b5563",marginBottom:8}}>Total filament: {pTotal*q}g ({p*q}g pièce{ps>0?` + ${ps*q}g supports`:""}){q>1?` · ${q} pièces · ${h*q}h total`:""}</p>}
        {h===0&&p>0&&<p style={{fontSize:10,color:"#f59e0b",marginBottom:8}}>⚠ Remplis le temps d'impression pour calculer énergie, MO et coûts fixes</p>}

        {/* Sélection bobine */}
        {filamentStock&&filamentStock.length>0&&(
          <div style={{marginBottom:12}}>
            <p style={labelStyle}>Bobine filament</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {filamentStock.map(s=>{
                const remaining = s.weightTotal - s.weightUsed;
                const needed = pTotal * q;
                const low = needed > 0 && remaining < needed;
                const sel = selectedSpool === s.id;
                return (
                  <div key={s.id} onClick={()=>setSelectedSpool(sel?"":s.id)}
                    style={{padding:"5px 10px",borderRadius:7,cursor:"pointer",display:"flex",alignItems:"center",gap:6,
                      background:sel?`${s.hex}20`:"#080a0f",border:`1px solid ${sel?s.hex+"60":low?"#ef444440":"#1a2035"}`,transition:"all .15s"}}>
                    <span style={{width:14,height:14,borderRadius:"50%",background:s.hex,border:"2px solid #ffffff30",flexShrink:0}}/>
                    <div>
                      <p style={{fontSize:10,fontWeight:600,color:sel?s.hex:"#94a3b8"}}>{s.color}</p>
                      <p style={{fontSize:9,color:low?"#f87171":"#4b5563"}}>{remaining}g{low?" ⚠ insuffisant":""}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sliders */}
        <div style={{borderTop:"1px solid #0f1520",paddingTop:12,display:"flex",flexDirection:"column",gap:10}}>
          <SliderField label="Filament R$/kg"        value={coutFilament}  onChange={setCoutFilament} min={50}  max={400}   step={5}    color="#f59e0b"/>
          <SliderField label="Électricité R$/kWh"    value={coutKwh}       onChange={setCoutKwh}      min={0.3} max={2}     step={0.05} color="#f87171"/>
          <SliderField label="Puissance machine (W)" value={puissanceW}    onChange={setPuissanceW}   min={50}  max={600}   step={10}   color="#60a5fa"/>
          <SliderField label="Main d'oeuvre R$/h"     value={tauxMO}       onChange={setTauxMO}       min={10}  max={100}   step={5}    color="#a78bfa"/>
          <SliderField label="Coûts fixes R$/mois"    value={coutsFixes}   onChange={setCoutsFixes}   min={500} max={10000} step={100}  color="#f87171"/>
          <SliderField label="Heures/mois machine"    value={hMoisMachine} onChange={setHMoisMachine} min={40}  max={720}   step={10}   color="#6b7280"/>
        </div>

        {/* Marges */}
        <div style={{borderTop:"1px solid #0f1520",paddingTop:12,marginTop:12}}>
          <div style={{display:"flex",gap:4,marginBottom:8}}>
            {[["pct","% Marge"],["mult","x Multiplicateur"]].map(([m,l])=>(
              <button key={m} onClick={()=>setMargeMode(m)}
                style={{flex:1,padding:"4px 8px",borderRadius:5,fontSize:10,fontWeight:600,cursor:"pointer",
                  background:margeMode===m?"#22c55e18":"transparent",color:margeMode===m?"#4ade80":"#4b5563",
                  border:margeMode===m?"1px solid #22c55e28":"1px solid #0f1520"}}>{l}</button>
            ))}
          </div>
          {margeMode==="pct"
            ? <SliderField label="Marge %" value={margePct} onChange={setMargePct} min={0} max={500} step={1} color="#22c55e"/>
            : <SliderField label="Multiplicateur" value={margeMult} onChange={setMargeMult} min={1} max={10} step={0.5} color="#22c55e"/>
          }
        </div>
      </div>

      {/* ── Panneau droit : résultats ── */}
      <div>
        {/* Décomposition coûts */}
        <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,padding:16,marginBottom:12}}>
          <p style={{fontSize:11,fontWeight:700,color:"#f1f5f9",marginBottom:12,textTransform:"uppercase",letterSpacing:".4px"}}>Decomposição de custos</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:9}}>
            {[
              {l:"Mat. pièce",    v:R(custoMatPiece),    c:"#f59e0b", sub:`${p}g × R$${cf}/kg`},
              {l:"Mat. supports", v:R(custoMatSupports), c:"#fb923c", sub:ps?`${ps}g × R$${cf}/kg`:"—"},
              {l:"Custo energia", v:R(custoEnergia),     c:"#f87171", sub:`${pw}W × ${h}h`},
              {l:"Custo MO",      v:R(custoMO),          c:"#a78bfa", sub:`${h}h × R$${mo}/h`},
              {l:"Custo fixo",    v:R(custoFixo),        c:"#6b7280", sub:`R$${fx}/${hm}h × ${h}h`},
            ].map(x=>(
              <div key={x.l} style={cellStyle}>
                <p style={{fontSize:9,color:"#4b5563",marginBottom:3,textTransform:"uppercase",letterSpacing:".3px"}}>{x.l}</p>
                <p style={{fontSize:14,fontWeight:700,color:x.c}}>{x.v}</p>
                <p style={{fontSize:9,color:"#374151",marginTop:1}}>{x.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Total + Prix */}
        <div style={{background:"#0b0d16",border:"1px solid #14b8a622",borderRadius:11,padding:16,marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:q>1?"1fr 1fr 1fr":"1fr 1fr",gap:9}}>
            <div style={{...cellStyle,border:"1px solid #fbbf2422"}}>
              <p style={{fontSize:9,color:"#4b5563",marginBottom:3,textTransform:"uppercase"}}>Custo total {q>1?`(${q} pièces)`:""}</p>
              <p style={{fontSize:20,fontWeight:700,color:"#fbbf24"}}>{R(custoTotal)}</p>
              {q>1&&<p style={{fontSize:10,color:"#a8893a",marginTop:2}}>Unit: {R(custoUnit)}</p>}
            </div>
            <div style={{...cellStyle,border:"1px solid #22c55e22"}}>
              <p style={{fontSize:9,color:"#4b5563",marginBottom:3,textTransform:"uppercase"}}>Preço de venda {margeMode==="mult"?`(x${margeMult})`:`(+${margePct}%)`}</p>
              <p style={{fontSize:20,fontWeight:700,color:"#22c55e"}}>{R(prixVente)}</p>
              <p style={{fontSize:10,color:"#4ade80",marginTop:2}}>Lucro: {R(lucro)} ({lucroPct.toFixed(1)}%)</p>
            </div>
            {q>1&&(
              <div style={{...cellStyle,border:"1px solid #60a5fa22"}}>
                <p style={{fontSize:9,color:"#4b5563",marginBottom:3,textTransform:"uppercase"}}>Prix unitaire</p>
                <p style={{fontSize:20,fontWeight:700,color:"#60a5fa"}}>{R(prixUnitVente)}</p>
                <p style={{fontSize:10,color:"#93c5fd",marginTop:2}}>Custo: {R(custoUnit)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Barre graphique proportionnelle */}
        {custoTotal > 0 && (
          <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,padding:16,marginBottom:12}}>
            <p style={{fontSize:10,fontWeight:600,color:"#4b5563",marginBottom:8,textTransform:"uppercase"}}>Répartition des coûts</p>
            <div style={{display:"flex",height:22,borderRadius:6,overflow:"hidden"}}>
              {[
                {v:custoMatPiece,   c:"#f59e0b",l:"Pièce"},
                {v:custoMatSupports,c:"#fb923c",l:"Supports"},
                {v:custoEnergia,    c:"#f87171",l:"Énergie"},
                {v:custoMO,         c:"#a78bfa",l:"MO"},
                {v:custoFixo,       c:"#6b7280",l:"Fixe"},
              ].filter(x=>x.v>0).map(x=>(
                <div key={x.l} title={`${x.l}: ${R(x.v)} (${(x.v/custoTotal*100).toFixed(0)}%)`}
                  style={{width:`${x.v/custoTotal*100}%`,background:x.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#000",minWidth:x.v/custoTotal>0.08?"auto":0,overflow:"hidden",whiteSpace:"nowrap"}}>
                  {x.v/custoTotal>0.12?`${x.l} ${(x.v/custoTotal*100).toFixed(0)}%`:""}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{display:"flex",gap:8}}>
          <button onClick={copyWhatsApp} disabled={custoTotal===0}
            style={{flex:1,padding:"10px",background:copied?"#22c55e":"linear-gradient(135deg,#25d366,#128c7e)",border:"none",borderRadius:7,color:"white",fontSize:12,fontWeight:600,cursor:custoTotal===0?"not-allowed":"pointer",opacity:custoTotal===0?0.4:1}}>
            {copied?"✓ Copié !":"📋 Copier pour WhatsApp"}
          </button>
          <button onClick={saveQuote} disabled={custoTotal===0||!hasClient}
            style={{flex:1,padding:"10px",background:saved?"#22c55e":"linear-gradient(135deg,#14b8a6,#0d9488)",border:"none",borderRadius:7,color:"white",fontSize:12,fontWeight:600,cursor:(custoTotal===0||!hasClient)?"not-allowed":"pointer",opacity:(custoTotal===0||!hasClient)?0.4:1}}>
            {saved?"✓ Devis sauvegardé !":!hasClient?"Sélectionne ou crée un client":"💾 Sauvegarder devis"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Blender 3D Studio ──────────────────────────────────────────────────────

function BlenderStudio() {
  const [bridgeHost, setBridgeHost] = useState(() => localStorage.getItem("amigo-blender-host") || "");
  const wsUrl = `ws://${bridgeHost || "localhost"}:8769`;
  const [connected, setConnected] = useState(false);
  const [ws, setWs]      = useState(null);
  const [log, setLog]    = useState([]);
  const [screenshot, setScreenshot] = useState("");
  const [prompt, setPrompt] = useState("");
  const [sceneInfo, setSceneInfo] = useState(null);
  const [creating, setCreating] = useState(false);

  const logRef = useRef(null);

  const addLog = useCallback((msg, type="info") => {
    setLog(prev => [...prev.slice(-50), { msg, type, at: Date.now() }]);
  }, []);

  const connect = useCallback(() => {
    try {
      const socket = new WebSocket(wsUrl);
      socket.onopen = () => { setConnected(true); setWs(socket); addLog("Connecté au bridge Blender", "ok"); socket.send(JSON.stringify({ action: "ping" })); };
      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.error) { addLog(`Erreur: ${data.error}${data.hint ? " — " + data.hint : ""}`, "err"); return; }
          if (data.action === "ping" || data.action === "scene_info") {
            setSceneInfo(data.result);
            addLog("Scène Blender connectée", "ok");
          }
          if (data.action === "screenshot" && data.result) {
            if (typeof data.result === "string") setScreenshot("data:image/png;base64," + data.result);
            else if (data.result.image) setScreenshot("data:image/png;base64," + data.result.image);
            addLog("Screenshot reçu", "ok");
          }
          if (data.action === "generate_model") {
            setCreating(false);
            addLog("Modèle généré !", "ok");
            socket.send(JSON.stringify({ action: "screenshot" }));
          }
          if (data.action === "create_object") { addLog("Objet créé", "ok"); socket.send(JSON.stringify({ action: "screenshot" })); }
          if (data.action === "clear_scene") { addLog("Scène vidée", "ok"); setScreenshot(""); }
          if (data.action === "export_stl") {
            if (data.result?.raw || typeof data.result === "string") {
              const b64 = typeof data.result === "string" ? data.result : data.result.raw;
              const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: "application/octet-stream" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "modele.stl"; a.click();
              addLog("STL téléchargé", "ok");
            }
          }
        } catch (err) { addLog("Réponse invalide: " + err.message, "err"); }
      };
      socket.onclose = () => { setConnected(false); setWs(null); addLog("Déconnecté", "err"); };
      socket.onerror = () => { addLog("Impossible de se connecter au bridge. Lancez: node printer-bridge/blender-bridge.js", "err"); };
    } catch (err) { addLog("Erreur connexion: " + err.message, "err"); }
  }, [wsUrl, addLog]);

  const send = useCallback((action, params) => {
    if (!ws || ws.readyState !== 1) { addLog("Non connecté", "err"); return; }
    ws.send(JSON.stringify({ action, params, id: Date.now() }));
  }, [ws, addLog]);

  const generateModel = () => {
    if (!prompt.trim()) return;
    setCreating(true);
    addLog(`Génération: "${prompt}"...`, "info");
    send("generate_model", { description: prompt, color: [0.2, 0.6, 0.9, 1] });
  };

  const presets = [
    { label: "Vase décoratif", prompt: "vase décoratif élégant" },
    { label: "Trophée", prompt: "trophée personnalisé" },
    { label: "Maquette maison", prompt: "maquette architecturale maison" },
    { label: "Support téléphone", prompt: "support téléphone bureau" },
    { label: "Engrenage", prompt: "engrenage mécanique" },
  ];

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  const ls = { fontSize: 9, color: "#4b5563", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".3px" };

  return (
    <div className="fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
      {/* ── Panneau gauche : contrôles ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Connexion */}
        <div style={{ background: "#0b0d16", border: "1px solid #0f1520", borderRadius: 11, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#14b8a6", textTransform: "uppercase", letterSpacing: ".5px" }}>🎨 Blender Studio</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#22c55e" : "#ef4444", display: "inline-block" }} />
              <span style={{ fontSize: 10, color: connected ? "#4ade80" : "#f87171" }}>{connected ? "Connecté" : "Déconnecté"}</span>
            </div>
          </div>
          {!connected ? (
            <div>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, lineHeight: 1.5 }}>
                Pour utiliser le studio 3D :<br />
                1. Harold ouvre Blender avec l'addon <span style={{ color: "#14b8a6", fontWeight: 600 }}>blender-mcp</span><br />
                2. Harold lance <code style={{ background: "#080a0f", padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>node blender-bridge.js</code>
              </p>
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 9, color: "#4b5563", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".3px" }}>IP du Mac de Harold (vide = localhost)</p>
                <input value={bridgeHost} onChange={e => { setBridgeHost(e.target.value); localStorage.setItem("amigo-blender-host", e.target.value); }}
                  placeholder="Ex: 192.168.0.12"
                  style={{ width: "100%", padding: "7px 9px", borderRadius: 7, fontSize: 12, outline: "none", background: "#080a0f", border: "1px solid #1a2035", color: "#e2e8f0", fontFamily: "inherit" }} />
              </div>
              <button onClick={connect} style={{ width: "100%", padding: "9px", background: "linear-gradient(135deg,#14b8a6,#0d9488)", border: "none", borderRadius: 7, color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Se connecter à Blender ({bridgeHost || "localhost"})
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => send("scene_info")} style={{ flex: 1, padding: "6px", background: "#14b8a615", border: "1px solid #14b8a625", borderRadius: 6, color: "#2dd4bf", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Info scène</button>
              <button onClick={() => send("screenshot")} style={{ flex: 1, padding: "6px", background: "#3b82f615", border: "1px solid #3b82f625", borderRadius: 6, color: "#60a5fa", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Screenshot</button>
              <button onClick={() => send("clear_scene")} style={{ flex: 1, padding: "6px", background: "#ef444415", border: "1px solid #ef444425", borderRadius: 6, color: "#f87171", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Vider scène</button>
            </div>
          )}
        </div>

        {/* Générateur de modèle */}
        {connected && (
          <div style={{ background: "#0b0d16", border: "1px solid #14b8a620", borderRadius: 11, padding: 16 }}>
            <p style={ls}>Générer un modèle 3D</p>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="Décrivez le modèle à générer... Ex: un vase décoratif, un support téléphone, une maquette de maison..."
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generateModel(); } }}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 12, resize: "none", height: 70, lineHeight: 1.6, outline: "none", background: "#080a0f", border: "1px solid #1a2035", color: "#e2e8f0", fontFamily: "inherit", marginBottom: 8 }} />
            <button onClick={generateModel} disabled={!prompt.trim() || creating}
              style={{ width: "100%", padding: "10px", background: creating ? "#0d948860" : "linear-gradient(135deg,#14b8a6,#0d9488)", border: "none", borderRadius: 7, color: "white", fontSize: 12, fontWeight: 600, cursor: creating ? "wait" : "pointer", marginBottom: 10 }}>
              {creating ? "⏳ Génération en cours..." : "🎨 Générer le modèle"}
            </button>

            {/* Presets rapides */}
            <p style={{ ...ls, marginTop: 4 }}>Modèles prédéfinis</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {presets.map(p => (
                <button key={p.label} onClick={() => { setPrompt(p.prompt); }}
                  style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: "#080a0f", border: "1px solid #1a2035", color: "#94a3b8", cursor: "pointer" }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ajouter des objets */}
        {connected && (
          <div style={{ background: "#0b0d16", border: "1px solid #0f1520", borderRadius: 11, padding: 16 }}>
            <p style={ls}>Ajouter un objet</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
              {[
                { type: "cube", icon: "⬜", label: "Cube" },
                { type: "uv_sphere", icon: "🔵", label: "Sphère" },
                { type: "cylinder", icon: "🔷", label: "Cylindre" },
                { type: "cone", icon: "🔺", label: "Cône" },
                { type: "torus", icon: "⭕", label: "Tore" },
                { type: "plane", icon: "▬", label: "Plan" },
              ].map(obj => (
                <button key={obj.type} onClick={() => send("create_object", { type: obj.type, name: obj.label })}
                  style={{ padding: "8px", borderRadius: 7, background: "#080a0f", border: "1px solid #1a2035", color: "#e2e8f0", cursor: "pointer", fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 16 }}>{obj.icon}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{obj.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Export */}
        {connected && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => send("export_stl", { name: "amigo-model" })}
              style={{ flex: 1, padding: "9px", background: "#22c55e15", border: "1px solid #22c55e25", borderRadius: 7, color: "#4ade80", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              📥 Exporter STL
            </button>
            <button onClick={() => send("screenshot")}
              style={{ flex: 1, padding: "9px", background: "#3b82f615", border: "1px solid #3b82f625", borderRadius: 7, color: "#60a5fa", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              📸 Capturer aperçu
            </button>
          </div>
        )}
      </div>

      {/* ── Panneau droit : aperçu + log ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Aperçu viewport */}
        <div style={{ background: "#0b0d16", border: "1px solid #0f1520", borderRadius: 11, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #0d1020", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#f1f5f9" }}>Aperçu Blender</p>
            {sceneInfo && <span style={{ fontSize: 10, color: "#4b5563" }}>{typeof sceneInfo === "object" ? `${Object.keys(sceneInfo.objects || {}).length || "?"} objets` : ""}</span>}
          </div>
          {screenshot ? (
            <img src={screenshot} alt="Blender viewport" style={{ width: "100%", display: "block" }} />
          ) : (
            <div style={{ padding: "80px 20px", textAlign: "center", color: "#2d3748" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🎨</p>
              <p style={{ fontSize: 12 }}>{connected ? "Cliquez sur Screenshot pour voir l'aperçu" : "Connectez-vous à Blender pour commencer"}</p>
            </div>
          )}
        </div>

        {/* Log */}
        <div ref={logRef} style={{ background: "#0b0d16", border: "1px solid #0f1520", borderRadius: 11, padding: 12, maxHeight: 200, overflow: "auto" }}>
          <p style={{ ...ls, marginBottom: 8 }}>Journal</p>
          {log.length === 0 ? (
            <p style={{ fontSize: 11, color: "#374151" }}>En attente...</p>
          ) : log.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3, alignItems: "baseline" }}>
              <span style={{ fontSize: 10, color: l.type === "ok" ? "#4ade80" : l.type === "err" ? "#f87171" : "#94a3b8" }}>
                {l.type === "ok" ? "✓" : l.type === "err" ? "✗" : "·"}
              </span>
              <span style={{ fontSize: 11, color: l.type === "err" ? "#f87171" : "#94a3b8" }}>{l.msg}</span>
              <span style={{ fontSize: 9, color: "#2d3748", marginLeft: "auto" }}>{ago(l.at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WineFinancePanel({ prospect }) {
  const EUR_BRL = 5.40;
  const prixAchat = parseFloat(prospect.prixProducteur)||0;
  const taxes = prixAchat ? calcTax(prixAchat) : null;
  const prixRevient = prixAchat + (taxes?.totalEur||0);
  const prixVenteBrl = parseFloat(prospect.prixVenteBresil)||0;
  const prixVenteEur = prixVenteBrl / EUR_BRL / 12; // par bouteille → par caisse → en €
  const prixMlBrl = parseFloat(prospect.prixMercadoLivre)||0;
  const fraisML = prixMlBrl * 12 / EUR_BRL * 0.16;
  const margeVente = prixVenteBrl ? (prixVenteBrl * 12 / EUR_BRL) - prixRevient : null;
  const margeML = prixMlBrl ? (prixMlBrl * 12 / EUR_BRL) - prixRevient - fraisML : null;
  const margeColor = m => m === null ? "#6b7280" : m > 0 ? "#22c55e" : "#ef4444";

  return (
    <div style={{padding:"12px 14px",background:"#080a0f",border:"1px solid #8b5cf622",borderRadius:9,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
        <span style={{fontSize:11,fontWeight:700,color:"#8b5cf6",textTransform:"uppercase",letterSpacing:".5px"}}>💰 Analyse financière / caisse</span>
        <span style={{fontSize:10,color:"#4b5563"}}>(12 btl · 1€ = R${EUR_BRL})</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9}}>
        {[
          {l:"Prix achat",       v:prixAchat?`€${prixAchat}`:"-",    c:"#f1f5f9"},
          {l:"Taxes import BR",  v:taxes?`€${Math.round(taxes.totalEur)}`:"-", c:"#f87171", sub:taxes?`${taxes.txEffective}% du FOB`:""},
          {l:"Prix de revient",  v:prixRevient?`€${Math.round(prixRevient)}`:"-", c:"#fbbf24"},
          {l:"Incoterm",         v:prospect.incoterm||"-",            c:"#a78bfa"},
          {l:"Vente Brésil",     v:prixVenteBrl?`R$${prixVenteBrl}/btl`:"-", c:"#f1f5f9", sub:prixVenteBrl?`€${Math.round(prixVenteBrl*12/EUR_BRL)}/cs`:""},
          {l:"Marge vente directe", v:margeVente!==null?`€${Math.round(margeVente)}`:"-", c:margeColor(margeVente), sub:margeVente!==null?`${Math.round(margeVente/prixRevient*100)}%`:""},
          {l:"Mercado Livre",    v:prixMlBrl?`R$${prixMlBrl}/btl`:"-", c:"#f1f5f9", sub:"Frais 16%"},
          {l:"Marge ML nette",   v:margeML!==null?`€${Math.round(margeML)}`:"-", c:margeColor(margeML), sub:margeML!==null?`${Math.round(margeML/prixRevient*100)}%`:""},
        ].map(x=>(
          <div key={x.l} style={{background:"#0b0d16",borderRadius:7,padding:"8px 10px",border:`1px solid ${x.c}15`}}>
            <p style={{fontSize:9,color:"#4b5563",marginBottom:3,textTransform:"uppercase",letterSpacing:".3px"}}>{x.l}</p>
            <p style={{fontSize:13,fontWeight:700,color:x.c}}>{x.v}</p>
            {x.sub&&<p style={{fontSize:9,color:"#4b5563",marginTop:1}}>{x.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupedQuotesTab({ prospect, myOrders, fmt, P, onAddOrder, onViewOrder, onSendGroupQuote, onSendEmail, projId }) {
  const [groupLink, setGroupLink] = useState(prospect.groupQuoteToken ? `${window.location.origin}/#/quotes/${prospect.groupQuoteToken}` : "");
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const isArch = o => ["Refusé","Expiré","Annulé","Annulée"].includes(o.status);
  const activeOrders = myOrders.filter(o => !isArch(o));
  const archivedOrders = myOrders.filter(o => isArch(o));
  const devis = activeOrders.filter(o => o.type === "devis");
  const commandes = activeOrders.filter(o => o.type !== "devis");
  const totalDevis = devis.reduce((s, o) => s + o.amount * (o.qty || 1), 0);

  const publishGroup = async () => {
    if (devis.length === 0) return;
    setPublishing(true);
    try {
      const token = prospect.groupQuoteToken || `g${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30);
      const groupData = {
        prospectId: prospect.id, prospectName: prospect.name,
        prospectCnpj: prospect.cnpj || "",
        items: devis.map(o => ({
          orderId: o.id, product: o.product, qty: o.qty || 1, amount: o.amount,
          notes: o.notes || "", payTerms: o.payTerms || "",
        })),
        date: new Date().toISOString().slice(0, 10),
        validUntil: validDate.toISOString().slice(0, 10),
        payTerms: devis[0]?.payTerms || "50% na aprovação, 50% na entrega",
        status: "sent", views: [], sentAt: Date.now(),
        acceptedItems: [],
      };
      await supabase.from("amigo_data").upsert({ key: `gquote_${token}`, value: JSON.stringify(groupData), updated_at: new Date().toISOString() });
      if (!prospect.groupQuoteToken && onSendGroupQuote) onSendGroupQuote(prospect.id, token);
      setGroupLink(`${window.location.origin}/#/quotes/${token}`);
    } catch (e) { console.error(e); }
    setPublishing(false);
  };

  const senderEmail = PROJECT_EMAIL[projId] || null;

  const renderRow = o => (
    <div key={o.id} onClick={()=>onViewOrder&&onViewOrder(o)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:"#080a0f",borderRadius:6,marginBottom:4,border:"1px solid #0f1520",cursor:"pointer",transition:"border-color .15s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="#1a2035"} onMouseLeave={e=>e.currentTarget.style.borderColor="#0f1520"}>
      <div>
        <p style={{fontSize:11,fontWeight:600,color:"#e2e8f0"}}>{o.product||"–"}</p>
        <p style={{fontSize:10,color:"#4b5563"}}>{o.date}</p>
      </div>
      <div style={{textAlign:"right"}}>
        <p style={{fontSize:12,fontWeight:700,color:"#22c55e"}}>{fmt(o.amount*(o.qty||1))}{(o.qty||1)>1&&<span style={{fontSize:9,color:"#4b5563",marginLeft:3}}>({o.qty}x)</span>}</p>
        <span style={{fontSize:10,color:"#f59e0b"}}>{o.status}</span>
      </div>
    </div>
  );

  return <>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <p style={{fontSize:10,color:"#4b5563",textTransform:"uppercase",fontWeight:600}}>📋 Devis ({devis.length}) · 📦 Commandes ({commandes.length})</p>
      <button onClick={()=>onAddOrder(prospect)} style={{fontSize:10,color:"#22c55e",background:"#22c55e10",border:"1px solid #22c55e22",padding:"3px 9px",borderRadius:5,cursor:"pointer",fontWeight:600}}>+ Ajouter</button>
    </div>
    {activeOrders.length===0
      ? <p style={{fontSize:11,color:"#2d3748",fontStyle:"italic"}}>Aucun devis ni commande en cours.</p>
      : <>
        {devis.length>0 && <>
          <p style={{fontSize:9,color:"#a78bfa",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>📋 Devis</p>
          {devis.map(renderRow)}
        </>}
        {commandes.length>0 && <>
          <p style={{fontSize:9,color:"#22c55e",fontWeight:600,textTransform:"uppercase",marginTop:8,marginBottom:4}}>📦 Commandes</p>
          {commandes.map(renderRow)}
        </>}
      </>
    }
    {archivedOrders.length>0 && (
      <details style={{marginTop:8}}>
        <summary style={{fontSize:10,color:"#374151",cursor:"pointer",fontWeight:600}}>🗄 Archives ({archivedOrders.length})</summary>
        <div style={{marginTop:4}}>{archivedOrders.map(renderRow)}</div>
      </details>
    )}
    {/* Envoi groupé des devis */}
    {devis.length > 0 && (
      <div style={{marginTop:12,background:"#080a0f",border:"1px solid #8b5cf620",borderRadius:8,padding:"12px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <p style={{fontSize:10,color:"#a78bfa",fontWeight:600,textTransform:"uppercase"}}>📋 {devis.length} devis · Total {fmt(totalDevis)}</p>
        </div>
        {!groupLink ? (
          <button onClick={publishGroup} disabled={publishing}
            style={{width:"100%",padding:"9px",background:"#8b5cf618",border:"1px solid #8b5cf628",borderRadius:7,color:"#a78bfa",fontSize:12,fontWeight:600,cursor:publishing?"default":"pointer",opacity:publishing?0.6:1}}>
            {publishing ? "Publication…" : `📤 Publier les ${devis.length} devis en un seul lien`}
          </button>
        ) : (
          <>
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              <input value={groupLink} readOnly style={{flex:1,padding:"6px 8px",borderRadius:5,fontSize:10,background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"monospace"}}/>
              <button onClick={()=>{navigator.clipboard.writeText(groupLink);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
                style={{padding:"6px 12px",borderRadius:5,fontSize:10,fontWeight:600,background:copied?"#22c55e18":"#8b5cf618",border:`1px solid ${copied?"#22c55e28":"#8b5cf628"}`,color:copied?"#4ade80":"#a78bfa",cursor:"pointer",whiteSpace:"nowrap"}}>
                {copied?"✓ Copié":"📋 Copier"}
              </button>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
              <a href={groupLink+"?preview=1"} target="_blank" rel="noopener" style={{fontSize:10,color:"#60a5fa",textDecoration:"none"}}>👁 Aperçu</a>
              <button onClick={publishGroup} disabled={publishing} style={{fontSize:10,color:"#f59e0b",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>{publishing?"…":"🔄 Re-publier"}</button>
            </div>
            {prospect.phone && (
              <a href={waLink(prospect.phone, `Olá${prospect.contact?` ${prospect.contact.split(" ")[0]}`:""}!\n\nSegue${devis.length>1?"m":""} ${devis.length>1?`os ${devis.length} orçamentos`:"o orçamento"}:\n\n${groupLink}\n\n${devis.map(d=>`• ${d.product} — ${d.qty||1}x — *R$${(d.amount*(d.qty||1)).toFixed(2)}*`).join("\n")}\n\nTotal: *R$${totalDevis.toFixed(2)}*\n\nAbraço,\nAnthony · ${EMPRESA.nome}`)} target="_blank" rel="noopener"
                style={{display:"block",width:"100%",padding:"8px",background:"#22c55e18",border:"1px solid #22c55e28",borderRadius:6,color:"#4ade80",fontSize:11,fontWeight:600,textDecoration:"none",textAlign:"center",marginBottom:6,boxSizing:"border-box"}}>
                WhatsApp — Envoyer les {devis.length} devis
              </a>
            )}
            {prospect.email && (
              <QuoteEmailForm
                key={`grp-${devis.map(d=>d.id+d.amount+d.qty).join("-")}`}
                to={prospect.email}
                defaultSubject={`Orçamentos — ${prospect.name} · ${EMPRESA.nome}`}
                defaultBody={`Prezado(a)${prospect.contact?` ${prospect.contact.split(" ")[0]}`:""},\n\nSegue${devis.length>1?"m":""}  ${devis.length>1?`os ${devis.length} orçamentos`:"o orçamento"} para o seu projeto:\n\n${groupLink}\n\n${devis.map(d=>`• ${d.product} — ${d.qty||1}x — R$${(d.amount*(d.qty||1)).toFixed(2)}`).join("\n")}\n\nTotal: R$${totalDevis.toFixed(2)}\n\nVocê pode aceitar cada item diretamente pelo link.\n\nAtenciosamente,\nAnthony Donzel\n${EMPRESA.nome} · ${EMPRESA.tel}`}
                projId={projId} onSend={onSendEmail} onSent={()=>{}}
              />
            )}
          </>
        )}
      </div>
    )}
  </>;
}

function ProspectModal({ prospect, projId, onClose, onUpdate, onDelete, orders, onAddOrder, onEmail, onViewOrder, onSendGroupQuote, gmailThreads, prospectEmails, onSendEmail, onScanForProspect, onClearEmails, gmailLoading }) {
  const P = PROJECTS[projId] || PROJECTS[prospect._proj] || PROJECTS["vin"] || Object.values(PROJECTS)[0];
  const isVin = projId === "vin";
  const [status,    setStatus]    = useState(prospect.status);
  const [assigned,  setAssigned]  = useState(prospect.assignedTo||"");
  const [expandedEmail, setExpandedEmail] = useState(null);
  const [emailBodies, setEmailBodies] = useState({});
  const [loadingBody, setLoadingBody] = useState(null);
  const [note,      setNote]      = useState(prospect.note||"");
  const [editNote,  setEditNote]  = useState(false);
  const [editInfos, setEditInfos] = useState(false);
  const [editName,    setEditName]    = useState(prospect.name||"");
  const [editContact, setEditContact] = useState(prospect.contact||"");
  const [editEmail,   setEditEmail]   = useState(prospect.email||"");
  const [editPhone,   setEditPhone]   = useState(prospect.phone||"");
  const [editGeo,     setEditGeo]     = useState(prospect.geo||"");
  const [editCnpj,   setEditCnpj]   = useState(prospect.cnpj||"");
  const [tab,       setTab]       = useState("infos");
  const [replyTo,   setReplyTo]   = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [prospectDocs, setProspectDocs] = useState(prospect.docs||[]);

  const save = (field, val) => {
    if (field==="status") setStatus(val);
    if (field==="assignedTo") setAssigned(val);
    onUpdate(prospect.id, { [field]: val||null });
  };

  const myOrders = orders.filter(o=>o.prospectId===prospect.id);
  const col = P.statusColors[status]||"#6b7280";

  // Emails partagés — lus directement depuis Supabase (Anthony + Harold)
  const domain = prospect.email?.split("@")[1]?.toLowerCase()||"__";
  const savedByProspectId = (prospectEmails||{})[prospect.id]||[];
  const savedByDomain = (gmailThreads||[]).filter(t =>
    t.from?.toLowerCase().includes(domain) || t.to?.toLowerCase().includes(domain)
  );
  const allEmailIds = new Set(savedByProspectId.map(e=>e.id));
  const myEmails = [
    ...savedByProspectId,
    ...savedByDomain.filter(t => !allEmailIds.has(t.id))
  ].sort((a,b) => b.timestamp - a.timestamp);

  const loadEmailBody = async (email) => {
    if (emailBodies[email.id]) return; // déjà chargé
    setLoadingBody(email.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.provider_token;
      if (!token) return;
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const msg = await r.json();
      // Extraire le texte du body
      const getBody = (parts=[]) => {
        for (const part of parts) {
          if (part.mimeType==="text/plain" && part.body?.data) {
            const binary = atob(part.body.data.replace(/-/g,"+").replace(/_/g,"/"));
            const bytes = new Uint8Array(binary.length);
            for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
            return new TextDecoder("utf-8").decode(bytes);
          }
          if (part.parts) { const r = getBody(part.parts); if (r) return r; }
        }
        return null;
      };
      let body = null;
      if (msg.payload?.parts) body = getBody(msg.payload.parts);
      else if (msg.payload?.body?.data) {
        const binary = atob(msg.payload.body.data.replace(/-/g,"+").replace(/_/g,"/"));
        const bytes = new Uint8Array(binary.length);
        for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
        body = new TextDecoder("utf-8").decode(bytes);
      }
      setEmailBodies(prev=>({...prev, [email.id]: body || email.snippet || "(contenu vide)"}));
    } catch(e) { console.error(e); }
    setLoadingBody(null);
  };

  const handleReply = async () => {
    if (!replyBody.trim() || !replyTo) return;
    setSending(true);
    const ok = await onSendEmail({
      to: prospect.email,
      subject: `Re: ${replyTo.subject||""}`,
      body: replyBody + `\n\n---\nDe : ${replyTo.from}\n${replyTo.snippet}`,
    });
    setSending(false);
    if (ok) {
      setSent(true);
      setReplyTo(null);
      setReplyBody("");
      // Statut → Contacté si encore À contacter
      if (prospect.status === "À contacter") onUpdate(prospect.id, { status: "Contacté" });
      setTimeout(()=>onScanForProspect&&onScanForProspect(prospect, true), 3000);
    }
  };

  // Auto-scan léger à l'ouverture — vérifie les nouveaux emails sans tout re-télécharger
  const autoScanned = useRef(false);
  useEffect(() => {
    if (autoScanned.current || !prospect.email || !onScanForProspect) return;
    autoScanned.current = true;
    const t = setTimeout(() => {
      try { onScanForProspect(prospect, true); } catch(_) {}
    }, 1500);
    return () => clearTimeout(t);
  }, [prospect.id]);

  const TABS = [["infos","📋 Infos"],["emails",`✉️ Emails${myEmails.length>0?` (${myEmails.length})`:""}`],["docs","📎 Docs"],["commandes",`📦 Commandes${myOrders.length>0?` (${myOrders.length})`:""}`]];

  return (
    <ModalWrap title={editInfos ? editName : prospect.name} onClose={onClose} wide>
      {/* Onglets */}
      <div style={{display:"flex",gap:4,marginBottom:14,background:"#080a0f",borderRadius:7,padding:3,border:"1px solid #0f1520"}}>
        {TABS.map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} className="btn"
            style={{flex:1,padding:"5px 8px",borderRadius:5,fontSize:11,fontWeight:600,background:tab===v?`${P.color}18`:"transparent",color:tab===v?P.color:"#4b5563",border:tab===v?`1px solid ${P.color}28`:"1px solid transparent",cursor:"pointer",transition:"all .12s"}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── INFOS ── */}
      {tab==="infos"&&<>
        {isVin && prospect.cepage && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,padding:"8px 10px",background:"#0b0d16",borderRadius:8,border:"1px solid #8b5cf620"}}>
            {[
              {ic:"🍇",v:prospect.type},{ic:"🌿",v:prospect.cepage},{ic:"📍",v:prospect.appellation},
              {ic:"📅",v:prospect.millesime},{ic:"🏷",v:prospect.certificat},{ic:"🧪",v:prospect.alcool?`${prospect.alcool}°`:""},
              {ic:"🚚",v:prospect.incoterm},{ic:"📦",v:prospect.minCommande?`Min. ${prospect.minCommande} cs`:""},
              ...(prospect.bio?[{ic:"🌱",v:"Bio"}]:[]),
            ].filter(x=>x.v).map(x=>(
              <span key={x.v} style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"#8b5cf615",color:"#a78bfa",fontWeight:600,display:"flex",alignItems:"center",gap:3}}>{x.ic} {x.v}</span>
            ))}
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <p style={{fontSize:10,color:"#4b5563",textTransform:"uppercase",fontWeight:600}}>Contact</p>
              {!editInfos
                ? <button onClick={()=>setEditInfos(true)} style={{fontSize:10,color:P.color,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Modifier</button>
                : <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{onUpdate(prospect.id,{name:editName,contact:editContact,email:editEmail,phone:editPhone,geo:editGeo,cnpj:editCnpj||undefined});setEditInfos(false);}} style={{fontSize:10,color:"#4ade80",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>✓ OK</button>
                    <button onClick={()=>{setEditName(prospect.name||"");setEditContact(prospect.contact||"");setEditEmail(prospect.email||"");setEditPhone(prospect.phone||"");setEditGeo(prospect.geo||"");setEditInfos(false);}} style={{fontSize:10,color:"#4b5563",background:"none",border:"none",cursor:"pointer"}}>Annuler</button>
                  </div>
              }
            </div>
            {editInfos ? <>
              <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Nom" style={{width:"100%",padding:"5px 7px",borderRadius:5,fontSize:12,marginBottom:4,outline:"none",background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"}}/>
              <input value={editContact} onChange={e=>setEditContact(e.target.value)} placeholder="Contact" style={{width:"100%",padding:"5px 7px",borderRadius:5,fontSize:11,marginBottom:4,outline:"none",background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"}}/>
              <input value={editEmail} onChange={e=>setEditEmail(e.target.value)} placeholder="Email" style={{width:"100%",padding:"5px 7px",borderRadius:5,fontSize:11,marginBottom:4,outline:"none",background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"}}/>
              <input value={editPhone} onChange={e=>setEditPhone(e.target.value)} placeholder="Téléphone" style={{width:"100%",padding:"5px 7px",borderRadius:5,fontSize:11,marginBottom:4,outline:"none",background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"}}/>
              <input value={editGeo} onChange={e=>setEditGeo(e.target.value)} placeholder="Localisation" style={{width:"100%",padding:"5px 7px",borderRadius:5,fontSize:11,marginBottom:4,outline:"none",background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"}}/>
              <input value={editCnpj} onChange={e=>setEditCnpj(e.target.value)} placeholder="CNPJ" style={{width:"100%",padding:"5px 7px",borderRadius:5,fontSize:11,outline:"none",background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"}}/>
            </> : <>
              {prospect.contact && <p style={{fontSize:12,fontWeight:600,color:"#e2e8f0",marginBottom:2}}>{prospect.contact}</p>}
              {prospect.email && <p style={{fontSize:11,color:"#3b82f6",marginBottom:1,cursor:"pointer"}} onClick={()=>onEmail&&onEmail(prospect)}>{prospect.email} ✉️</p>}
              {prospect.phone && <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <p style={{fontSize:11,color:"#6b7280"}}>{prospect.phone}</p>
                <a href={waLink(prospect.phone,`Olá${prospect.contact?` ${prospect.contact.split(" ")[0]}`:""}! Aqui é Anthony da ${EMPRESA.nome}.`)} target="_blank" rel="noopener"
                  style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:"#22c55e18",color:"#4ade80",fontWeight:600,textDecoration:"none",border:"1px solid #22c55e25"}}>WhatsApp</a>
              </div>}
              {prospect.geo     && <p style={{fontSize:11,color:"#4b5563"}}>{prospect.geo} {prospect.sub}</p>}
              {prospect.cnpj    && <p style={{fontSize:10,color:"#4b5563",marginTop:3}}>CNPJ: <span style={{color:"#6b7280",fontFamily:"monospace"}}>{prospect.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5")}</span></p>}
            </>}
            {isVin && prospect.prixMagasinFr && <p style={{fontSize:10,color:"#4b5563",marginTop:5}}>Prix magasin France : <strong style={{color:"#f1f5f9"}}>€{prospect.prixMagasinFr}/btl</strong></p>}
            <div style={{marginTop:7}}>{(prospect.tags||[]).map(t=>(
              <span key={t} style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:`${P.color}15`,color:P.color,border:`1px solid ${P.color}22`,marginRight:4,fontWeight:600}}>{t}</span>
            ))}</div>
          </div>
          <div>
            <Field label="Statut" value={status} onChange={v=>save("status",v)} options={P.statuses}/>
            <Field label="Assigné à" value={assigned} onChange={v=>save("assignedTo",v)} options={["", ...Object.keys(USERS)]}/>
            <div style={{marginTop:6,padding:"7px 10px",background:`${col}10`,borderRadius:6,border:`1px solid ${col}20`,display:"inline-flex",alignItems:"center",gap:5}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"inline-block"}}/>
              <span style={{fontSize:11,fontWeight:600,color:col}}>{status}</span>
            </div>
          </div>
        </div>
        {isVin && <WineFinancePanel prospect={prospect}/>}
        {isVin && (
          <div style={{marginBottom:12,padding:"8px 12px",background:"#080a0f",borderRadius:8,border:"1px solid #0f1520"}}>
            <p style={{fontSize:10,color:"#4b5563",fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>📍 Région viticole (carte)</p>
            <select value={prospect.regionManuelle||""} onChange={e=>onUpdate(prospect.id,{regionManuelle:e.target.value||null})}
              style={{width:"100%",padding:"6px 8px",borderRadius:6,fontSize:12,background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit",cursor:"pointer"}}>
              <option value="">Détection automatique</option>
              {[["bordeaux","Bordeaux"],["bourgogne","Bourgogne"],["champagne","Champagne"],["alsace","Alsace"],["loire","Loire"],["rhone","Vallée du Rhône"],["languedoc","Languedoc"],["provence","Provence"],["beaujolais","Beaujolais"],["jura","Jura/Savoie"],["sw","Sud-Ouest"]].map(([v,l])=>(
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{padding:"10px 12px",background:"#080a0f",borderRadius:8,border:"1px solid #0d1020"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <p style={{fontSize:10,color:"#4b5563",fontWeight:600}}>📝 NOTE PARTAGÉE</p>
            {!editNote
              ? <button onClick={()=>setEditNote(true)} style={{fontSize:10,color:P.color,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Modifier</button>
              : <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{onUpdate(prospect.id,{note});setEditNote(false);}} style={{fontSize:10,color:"#4ade80",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>✓ OK</button>
                  <button onClick={()=>setEditNote(false)} style={{fontSize:10,color:"#4b5563",background:"none",border:"none",cursor:"pointer"}}>Annuler</button>
                </div>
            }
          </div>
          {editNote
            ? <textarea value={note} onChange={e=>setNote(e.target.value)} style={{width:"100%",padding:"7px",borderRadius:6,fontSize:11,resize:"none",height:70,lineHeight:1.6,outline:"none",background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"}}/>
            : <p style={{fontSize:11,color:"#6b7280",lineHeight:1.6}}>{note||"Aucune note."}</p>
          }
        </div>
        {/* Historique des modifications */}
        {(prospect.history||[]).length>0 && (
          <details style={{marginTop:14}}>
            <summary style={{fontSize:10,color:"#4b5563",cursor:"pointer",fontWeight:600}}>🕐 Historique ({prospect.history.length} modifications)</summary>
            <div style={{marginTop:8,maxHeight:200,overflowY:"auto"}}>
              {[...(prospect.history||[])].reverse().map((h,i)=>(
                <div key={i} style={{padding:"6px 10px",borderBottom:"1px solid #080a0f",display:"flex",gap:8,alignItems:"flex-start"}}>
                  <div style={{width:18,height:18,borderRadius:"50%",background:USERS[h.by]?.color||"#6b7280",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"white",flexShrink:0,marginTop:2}}>{USERS[h.by]?.avatar||"?"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:10,color:USERS[h.by]?.color||"#6b7280",fontWeight:600}}>{h.byLabel||h.by}</span>
                      <span style={{fontSize:9,color:"#2d3748"}}>{new Date(h.at).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                    </div>
                    {(h.changes||[]).map((c,j)=><p key={j} style={{fontSize:10,color:"#6b7280",marginTop:1}}>{c}</p>)}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
        {onDelete && (
          <div style={{marginTop:14,textAlign:"right"}}>
            <button onClick={()=>{if(confirm(`Supprimer définitivement "${prospect.name}" et ses emails associés ?`)){onDelete(prospect.id);onClose();}}}
              style={{padding:"6px 14px",background:"#ef444410",border:"1px solid #ef444425",borderRadius:6,color:"#f87171",fontSize:11,fontWeight:600,cursor:"pointer"}}>
              🗑 Supprimer ce prospect
            </button>
          </div>
        )}
      </>}

      {/* ── EMAILS ── */}
      {tab==="emails"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>onScanForProspect&&onScanForProspect(prospect)}
              disabled={gmailLoading}
              style={{padding:"6px 12px",background:"#3b82f618",border:"1px solid #3b82f628",borderRadius:6,color:"#60a5fa",fontSize:11,fontWeight:600,cursor:gmailLoading?"default":"pointer",opacity:gmailLoading?0.6:1,display:"flex",alignItems:"center",gap:6}}>
              {gmailLoading
                ? <><span style={{display:"inline-block",width:10,height:10,border:"2px solid #60a5fa",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Scan…</>
                : "🔍 Scanner"
              }
            </button>
            <button onClick={()=>onClearEmails&&onClearEmails(prospect)}
              style={{padding:"6px 10px",background:"#ef444415",border:"1px solid #ef444425",borderRadius:6,color:"#f87171",fontSize:11,cursor:"pointer"}}>
              🗑
            </button>
            {myEmails.length>0&&<span style={{fontSize:10,color:"#4b5563"}}>{myEmails.length} message{myEmails.length>1?"s":""}</span>}
          </div>
          <div style={{display:"flex",gap:6}}>
            {prospect.phone && <a href={waLink(prospect.phone,`Olá${prospect.contact?` ${prospect.contact.split(" ")[0]}`:""}! Aqui é Anthony da ${EMPRESA.nome}.`)} target="_blank" rel="noopener"
              style={{padding:"6px 12px",background:"#22c55e18",border:"1px solid #22c55e28",borderRadius:6,color:"#4ade80",fontSize:11,fontWeight:600,textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>
              WhatsApp
            </a>}
            <button onClick={()=>onEmail&&onEmail(prospect)}
              style={{padding:"6px 14px",background:`linear-gradient(135deg,${P.color},${P.color}cc)`,border:"none",borderRadius:6,color:"white",fontSize:11,fontWeight:600,cursor:"pointer"}}>
              ✉️ Email
            </button>
          </div>
        </div>

        {myEmails.length===0&&(
          <div style={{textAlign:"center",padding:"30px 20px"}}>
            <p style={{fontSize:28,marginBottom:8}}>📭</p>
            <p style={{fontSize:12,color:"#4b5563"}}>Aucun échange trouvé.</p>
            <p style={{fontSize:11,color:"#2d3748",marginTop:4}}>Clique sur Scanner pour chercher dans Gmail.</p>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {myEmails.map(email=>{
          const isOut = email.folder==="Envoyés";
          const isReply = replyTo?.id===email.id;
          const isExpanded = expandedEmail===email.id;
          const content = emailBodies[email.id] || email.body || email.snippet || "";
          return (
            <div key={email.id} style={{borderRadius:10,border:`1px solid ${isOut?"#22c55e30":"#1e293b"}`,background:isOut?"#052010":"#0b0f1a"}}>
              {/* Header cliquable */}
              <div onClick={()=>{setExpandedEmail(isExpanded?null:email.id);if(!isExpanded)loadEmailBody(email);}}
                style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",borderBottom:isExpanded?"1px solid #1e293b":"none"}}
                onMouseEnter={e=>e.currentTarget.style.background=isOut?"#0a3020":"#0f1520"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontSize:9,padding:"2px 7px",borderRadius:10,background:isOut?"#22c55e20":"#3b82f620",color:isOut?"#4ade80":"#60a5fa",fontWeight:700,flexShrink:0}}>
                      {isOut?"↗ Envoyé":"↙ Reçu"}
                    </span>
                    <span style={{fontSize:12,fontWeight:600,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{email.subject||"(sans objet)"}</span>
                  </div>
                  <p style={{fontSize:10,color:"#4b5563"}}>
                    {isOut ? `À : ${email.to}` : `De : ${email.from}`}
                    {email.cc && <span style={{marginLeft:8,color:"#374151"}}>CC : {email.cc}</span>}
                  </p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:10}}>
                  <span style={{fontSize:10,color:"#374151"}}>
                    {email.timestamp ? new Date(email.timestamp).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}) : ""}
                  </span>
                  <span style={{fontSize:11,color:"#374151",transform:isExpanded?"rotate(180deg)":"none",transition:"transform .15s",display:"inline-block"}}>▾</span>
                </div>
              </div>

              {/* Corps toujours visible si expanded */}
              {isExpanded&&(
                <div style={{padding:"14px 16px",borderBottom:"1px solid #1e293b",maxHeight:400,overflowY:"auto"}}>
                  {content
                    ? <p style={{fontSize:12,color:"#cbd5e1",lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"inherit"}}>{content}</p>
                    : <p style={{fontSize:11,color:"#374151",fontStyle:"italic"}}>Rescanne ce contact pour voir le contenu complet.</p>
                  }
                </div>
              )}

              {/* Répondre */}
              {isExpanded&&(
                <div style={{padding:"10px 14px"}}>
                  {!isReply
                    ? <button onClick={e=>{e.stopPropagation();setReplyTo(email);setReplyBody("");}}
                        style={{padding:"5px 14px",background:`${P.color}18`,border:`1px solid ${P.color}28`,borderRadius:6,color:P.color,fontSize:11,fontWeight:600,cursor:"pointer"}}>
                        ↩ Répondre
                      </button>
                    : <div>
                        <p style={{fontSize:10,color:"#4b5563",marginBottom:6,fontWeight:600}}>↩ Répondre à {email.from}</p>
                        <textarea value={replyBody} onChange={e=>setReplyBody(e.target.value)}
                          placeholder="Votre réponse..."
                          style={{width:"100%",padding:"10px",borderRadius:7,fontSize:12,resize:"vertical",minHeight:100,outline:"none",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit",lineHeight:1.7,marginBottom:8}}/>
                        {sent&&<p style={{fontSize:11,color:"#4ade80",marginBottom:6}}>✅ Réponse envoyée !</p>}
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={handleReply} disabled={sending||!replyBody.trim()}
                            style={{padding:"7px 16px",background:`linear-gradient(135deg,${P.color},${P.color}aa)`,border:"none",borderRadius:6,color:"white",fontSize:12,fontWeight:600,cursor:"pointer",opacity:sending?0.6:1}}>
                            {sending?"Envoi…":"📤 Envoyer"}
                          </button>
                          <button onClick={()=>setReplyTo(null)}
                            style={{padding:"7px 12px",background:"transparent",border:"1px solid #1e293b",borderRadius:6,color:"#6b7280",fontSize:11,cursor:"pointer"}}>
                            Annuler
                          </button>
                        </div>
                      </div>
                  }
                </div>
              )}
            </div>
          );
        })}
        </div>
      </>}

      {/* ── COMMANDES ── */}
      {tab==="docs"&&<DocsTab key={prospect.id} prospect={prospect} onUpdate={onUpdate} projId={projId}/>}

      {tab==="commandes"&&<GroupedQuotesTab
        prospect={prospect} myOrders={myOrders} fmt={fmt} P={P}
        onAddOrder={onAddOrder} onViewOrder={onViewOrder}
        onSendGroupQuote={onSendGroupQuote} onSendEmail={onSendEmail} projId={projId}
      />}
    </ModalWrap>
  );
}

// Emails autorisés — seuls ceux-là peuvent entrer
const ALLOWED_EMAILS = [
  "anthony.donzel@gmail.com",
  "harold.grenouilleau@gmail.com",
  "jade.investissement@gmail.com",
  "3abresil@gmail.com",
  "labo3drio@gmail.com",
  "contact@formationcarnaval.fr",
];

const emailToUser = email => {
  if (!email) return null;
  const lower = email.toLowerCase();
  if (lower === "anthony.donzel@gmail.com")       return "anthony";
  if (lower === "harold.grenouilleau@gmail.com")  return "harold";
  if (lower === "jade.investissement@gmail.com")  return "jade";
  if (lower === "3abresil@gmail.com")             return "anthony"; // compte partagé Vin
  if (lower === "labo3drio@gmail.com")            return "anthony"; // compte partagé Impression 3D
  if (lower === "contact@formationcarnaval.fr")   return "anthony"; // compte partagé Carnaval
  return null;
};

function AddEventModal({ onAdd, onClose, preDate, currentUser }) {
  const [title,   setTitle]   = useState("");
  const [date,    setDate]    = useState(preDate && preDate!=="new" ? preDate : today());
  const [time,    setTime]    = useState("");
  const [proj,    setProj]    = useState("makeup");
  const [note,    setNote]    = useState("");

  const submit = () => {
    if (!title.trim() || !date) return;
    onAdd({ title, date, time, proj, note, createdBy: currentUser });
  };

  const PROJ_OPTIONS = [
    {v:"makeup",  l:"💄 Carnaval Gall"},
    {v:"vin",     l:"🍷 Import Vin"},
    {v:"print3d", l:"🧊 Impression 3D"},
    {v:"perso",   l:"📅 Personnel"},
    {v:"autre",   l:"🗓 Autre"},
  ];
  const PROJ_COLORS = {"makeup":"#ec4899","vin":"#8b5cf6","print3d":"#14b8a6","perso":"#f59e0b","autre":"#6b7280"};
  const accent = PROJ_COLORS[proj]||"#3b82f6";

  return (
    <ModalWrap title="📅 Nouvel événement" onClose={onClose}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
        <div style={{gridColumn:"span 2"}}>
          <Field label="Titre *" value={title} onChange={setTitle} placeholder="Appel Château Margaux, Démo CRM..."/>
        </div>
        <Field label="Date *" value={date} onChange={setDate} type="date"/>
        <Field label="Heure (optionnel)" value={time} onChange={setTime} placeholder="14:30"/>
        <div style={{gridColumn:"span 2",marginBottom:11}}>
          <p style={{fontSize:10,color:"#4b5563",marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:".4px"}}>Projet</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {PROJ_OPTIONS.map(o=>(
              <button key={o.v} onClick={()=>setProj(o.v)}
                style={{padding:"5px 11px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",background:proj===o.v?`${PROJ_COLORS[o.v]}20`:"#080a0f",border:`1px solid ${proj===o.v?PROJ_COLORS[o.v]:"#0f1520"}`,color:proj===o.v?PROJ_COLORS[o.v]:"#4b5563",transition:"all .12s"}}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{gridColumn:"span 2",marginBottom:12}}>
          <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".4px"}}>Note</p>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Contexte, lien de visio..."
            style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,resize:"none",height:55,outline:"none",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit",lineHeight:1.6}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={submit} style={{flex:1,padding:"9px",background:`linear-gradient(135deg,${accent},${accent}aa)`,border:"none",borderRadius:7,color:"white",fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ Ajouter</button>
        <button onClick={onClose} style={{padding:"9px 14px",background:"#0b0d16",border:"1px solid #0f1520",borderRadius:7,color:"#6b7280",fontSize:12,cursor:"pointer"}}>Annuler</button>
      </div>
    </ModalWrap>
  );
}

const EMAIL_TEMPLATES = {
  vin: [
    {
      id:"vin_intro", label:"Premier contact",
      subject: p => `Partenariat import vins — Brésil · ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nJe me permets de vous contacter depuis Rio de Janeiro, où je développe un réseau de distribution de vins français premium au Brésil.\n\nVotre domaine ${p.name}${p.cepage?`, notamment votre ${p.cepage},`:""} correspond exactement à ce que recherche notre clientèle brésilienne haut de gamme.\n\nSeriez-vous disponible pour un échange de 20 minutes afin d'explorer les possibilités d'exportation ?\n\nCordialement,\nAnthony Donzel\nRio de Janeiro, Brésil`,
    },
    {
      id:"vin_relance", label:"Relance sans réponse",
      subject: p => `Re: Partenariat import vins — ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nJe me permets de revenir vers vous suite à mon précédent message resté sans réponse.\n\nLe marché brésilien pour les vins${p.cepage?` ${p.cepage}`:""} est particulièrement porteur en ce moment, et je serais ravi de vous présenter notre projet de distribution.\n\nÊtes-vous disponible cette semaine pour un appel rapide ?\n\nCordialement,\nAnthony Donzel`,
    },
    {
      id:"vin_tarifs", label:"Demande tarifs export",
      subject: p => `Demande tarifs & conditions export — ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nSuite à notre échange, je vous recontacte pour obtenir vos conditions d'exportation vers le Brésil :\n\n• Tarif départ cave (FOB/CIF)\n• Quantité minimum par commande\n• Délais de production / disponibilité\n• Conditions de paiement\n\nNous travaillons en priorité avec des domaines proposant des volumes réguliers, idéalement à partir de ${p.minCommande||6} caisses par référence.\n\nMerci par avance,\nAnthony Donzel`,
    },
    {
      id:"vin_confirmation", label:"Confirmation commande",
      subject: p => `Confirmation de commande — ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nJe vous confirme par ce message notre commande :\n\n• Produit : ${p.name}${p.millesime?` ${p.millesime}`:""}\n• Quantité : à définir\n• Incoterm : ${p.incoterm||"FOB"}\n\nMerci de me faire parvenir votre proforma afin de procéder au règlement.\n\nCordialement,\nAnthony Donzel`,
    },
    {
      id:"vin_degustation", label:"Remerciement dégustation",
      subject: p => `Merci pour la dégustation — ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nJe tenais à vous remercier chaleureusement pour la dégustation et l'accueil au domaine.\n\nVos vins${p.cepage?` ${p.cepage}`:""} ont confirmé tout le bien que j'en pensais — ils ont vraiment leur place dans notre sélection brésilienne.\n\nJe reviens vers vous rapidement avec une proposition commerciale concrète.\n\nTrès cordialement,\nAnthony Donzel`,
    },
  ],
  makeup: [
    {
      id:"makeup_tournee", label:"Tournée Europe (masse)",
      subject: p => `Workshops Maquillage Carnaval & Formation Rio — ${p.name}`,
      body: p => `Madame, Monsieur,\n\nJe suis Anthony Donzel, je réside à Rio de Janeiro et travaille avec trois maquilleurs du Carnaval de Rio : Christina Gall, Jorge Abreu et Guilherme Camilo.\n\nJ'organise une tournée européenne de workshops et serai en France en novembre. Je souhaiterais savoir si vous seriez disponible pour accueillir une session à cette occasion.\n\nJe développe également des séjours de formation à Rio pendant le Carnaval, et cherche des écoles partenaires pour y envoyer des étudiants.\n\nVoici le lien de notre site internet : https://www.formationcarnaval.fr?utm_source=amigo&utm_campaign=tournee2026&utm_content=${p.id}\n\nSeriez-vous intéressés par l'un de ces projets ? Réservez un créneau pour en discuter : https://cal.com/anthony-donzel-zpovza/30min?utm_source=amigo&utm_content=${p.id}\n\nCordialement,\nAnthony Donzel`,
    },
    {
      id:"makeup_tournee_cgall", label:"Tournée Europe (école connue Gall)",
      subject: p => `Workshops Maquillage Carnaval & Formation Rio — ${p.name}`,
      body: p => `Madame, Monsieur,\n\nJe suis Anthony Donzel, je réside à Rio de Janeiro et travaille avec trois maquilleurs du Carnaval de Rio : Christina Gall, Jorge Abreu et Guilherme Camilo. Christina Gall est déjà intervenue dans votre école.\n\nJ'organise une tournée européenne de workshops et serai en France en novembre. Je souhaiterais savoir si vous seriez disponible pour accueillir une session à cette occasion.\n\nJe développe également des séjours de formation à Rio pendant le Carnaval, et cherche des écoles partenaires pour y envoyer des étudiants.\n\nVoici le lien de notre site internet : https://www.formationcarnaval.fr?utm_source=amigo&utm_campaign=tournee2026&utm_content=${p.id}\n\nSeriez-vous intéressés par l'un de ces projets ? Réservez un créneau pour en discuter : https://cal.com/anthony-donzel-zpovza/30min?utm_source=amigo&utm_content=${p.id}\n\nCordialement,\nAnthony Donzel`,
    },
    {
      id:"makeup_intro", label:"Présentation package",
      subject: p => `Package Formation Carnaval Rio 2026 — ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nJe me permets de vous contacter au sujet d'un partenariat exclusif pour votre école de maquillage.\n\nNous proposons un package immersif "Carnaval Rio" développé avec Madame Gall — 5 jours de formation terrain à Rio de Janeiro en février, hébergement Ipanema inclus.\n\n✦ Tarif : 3 500€/élève\n✦ Groupes : 6 à 10 personnes\n✦ Programme : techniques Carnaval, couleur, effets spéciaux en conditions réelles\n\nCe séjour représente une expérience unique pour vos élèves et un argument différenciant fort pour votre école.\n\nSeriez-vous disponible pour en discuter ?\n\nCordialement,\nAnthony Donzel`,
    },
    {
      id:"makeup_relance", label:"Relance directeur",
      subject: p => `Re: Package Carnaval Rio — ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nJe reviens vers vous concernant notre programme de formation Carnaval Rio 2026.\n\nLes places pour février sont limitées et plusieurs écoles partenaires ont déjà confirmé leur participation.\n\nAvez-vous eu l'occasion d'en discuter avec votre équipe pédagogique ?\n\nCordialement,\nAnthony Donzel`,
    },
    {
      id:"makeup_devis", label:"Envoi devis",
      subject: p => `Devis — Programme Carnaval Rio · ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nComme convenu, veuillez trouver ci-joint le devis détaillé pour le programme de formation Carnaval Rio 2026.\n\nRécapitulatif :\n• Durée : 5 jours (février 2026)\n• Hébergement : Ipanema, Rio de Janeiro\n• Encadrement : Madame Gall + équipe locale\n• Tarif : 3 500€/élève (groupe de 6 à 10)\n\nN'hésitez pas si vous avez des questions.\n\nCordialement,\nAnthony Donzel`,
    },
    {
      id:"makeup_confirmation", label:"Confirmation participation",
      subject: p => `Confirmation participation — Carnaval Rio 2026 · ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nNous sommes ravis de confirmer la participation de ${p.name} au programme Carnaval Rio 2026.\n\nProchaines étapes :\n• Envoi du contrat et des modalités de paiement\n• Confirmation des noms des participants\n• Réservation des hébergements\n\nMerci pour votre confiance, ce sera une belle aventure !\n\nCordialement,\nAnthony Donzel`,
    },
  ],
  print3d: [
    {
      id:"3d_intro", label:"Premier contact",
      subject: p => `Impression 3D sur mesure — Projet ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nJe me permets de vous contacter concernant vos besoins en impression 3D sur mesure.\n\nNous réalisons des pièces techniques et architecturales de haute précision, maquettes, prototypes et éléments décoratifs.\n\nSeriez-vous intéressé par un devis pour votre prochain projet ?\n\nCordialement,\nAnthony Donzel`,
    },
    {
      id:"3d_devis", label:"Envoi devis",
      subject: p => `Devis impression 3D — ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nSuite à notre échange, veuillez trouver ci-joint le devis pour votre projet.\n\nN'hésitez pas à me contacter pour tout ajustement.\n\nCordialement,\nAnthony Donzel`,
    },
    {
      id:"3d_relance", label:"Relance devis",
      subject: p => `Re: Devis impression 3D — ${p.name}`,
      body: p => `Bonjour${p.contact?` ${p.contact.split(" ")[0]}`:""},\n\nJe reviens vers vous concernant le devis que je vous ai transmis.\n\nAvez-vous eu l'occasion de l'examiner ? Je reste disponible pour tout ajustement ou question.\n\nCordialement,\nAnthony Donzel`,
    },
  ],
};

function EmailModal({ prospect, projId, onClose, onSend, onUpdateStatus }) {
  const P = PROJECTS[projId];
  const senderEmail = PROJECT_EMAIL[projId] || null;
  const templates = EMAIL_TEMPLATES[projId]||[];
  const defaultTpl = templates[0];
  const [to,      setTo]      = useState(prospect.email||"");
  const [subject, setSubject] = useState(defaultTpl?defaultTpl.subject(prospect):"");
  const [body,    setBody]    = useState(defaultTpl?defaultTpl.body(prospect):"");
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const applyTemplate = (tpl) => {
    setSubject(tpl.subject(prospect));
    setBody(tpl.body(prospect));
  };

  const [sendError, setSendError] = useState("");

  const handleSend = async () => {
    if (!to) return;
    setSending(true);
    setSendError("");
    const ok = await onSend({ to, subject, body, from: senderEmail });
    setSending(false);
    if (ok) {
      setSent(true);
      if (prospect.status === "À contacter" && onUpdateStatus) {
        onUpdateStatus(prospect.id, { status: "Contacté" });
      }
    } else {
      setSendError(senderEmail
        ? `Échec envoi. L'alias "${senderEmail}" est-il configuré dans Gmail → Paramètres → Comptes → Envoyer en tant que ?`
        : "Échec envoi. Vérifie ta connexion et tes permissions Gmail.");
    }
  };

  if (sent) return (
    <ModalWrap title="✅ Email envoyé" onClose={onClose}>
      <p style={{fontSize:12,color:"#4ade80",textAlign:"center",padding:"20px 0"}}>Email envoyé à {to} avec succès !</p>
      <p style={{fontSize:11,color:"#4b5563",textAlign:"center",marginBottom:16}}>{senderEmail?`Envoyé depuis ${senderEmail}`:"Envoyé depuis ton compte Gmail"}</p>
      <button onClick={onClose} style={{width:"100%",padding:"9px",background:"#22c55e15",border:"1px solid #22c55e28",borderRadius:7,color:"#4ade80",fontSize:13,fontWeight:600,cursor:"pointer"}}>Fermer</button>
    </ModalWrap>
  );

  return (
    <ModalWrap title={`✉️ Email — ${prospect.name}`} onClose={onClose} wide>
      {/* Templates */}
      {templates.length>0&&(
        <div style={{marginBottom:14}}>
          <p style={{fontSize:10,color:"#4b5563",marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:".4px"}}>Templates</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {templates.map(tpl=>(
              <button key={tpl.id} onClick={()=>applyTemplate(tpl)}
                style={{padding:"4px 11px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",background:`${P.color}15`,border:`1px solid ${P.color}28`,color:P.color,transition:"all .12s"}}
                onMouseEnter={e=>e.currentTarget.style.background=`${P.color}28`}
                onMouseLeave={e=>e.currentTarget.style.background=`${P.color}15`}>
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {senderEmail&&(
        <div style={{marginBottom:11,padding:"6px 10px",background:"#14b8a610",borderRadius:7,border:"1px solid #14b8a620",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10,color:"#4b5563",fontWeight:600}}>De :</span>
          <span style={{fontSize:11,color:"#14b8a6",fontWeight:600}}>{senderEmail}</span>
        </div>
      )}
      <Field label="À" value={to} onChange={setTo} placeholder="email@domaine.com"/>
      <Field label="Objet" value={subject} onChange={setSubject} placeholder="Objet..."/>
      <div style={{marginBottom:12}}>
        <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".4px"}}>Message</p>
        <textarea value={body} onChange={e=>setBody(e.target.value)}
          style={{width:"100%",padding:"9px",borderRadius:7,fontSize:12,resize:"vertical",height:220,outline:"none",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit",lineHeight:1.7}}/>
      </div>
      {sendError&&<p style={{fontSize:11,color:"#f87171",marginBottom:8,padding:"8px 10px",background:"#ef444412",borderRadius:7,border:"1px solid #ef444420"}}>{sendError}</p>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={handleSend} disabled={sending||!to}
          style={{flex:1,padding:"9px",background:`linear-gradient(135deg,${P.color},${P.color}aa)`,border:"none",borderRadius:7,color:"white",fontSize:13,fontWeight:600,cursor:"pointer",opacity:sending?0.6:1}}>
          {sending?"Envoi…":"📤 Envoyer via Gmail"}
        </button>
        <button onClick={onClose} style={{padding:"9px 14px",background:"#0b0d16",border:"1px solid #0f1520",borderRadius:7,color:"#6b7280",fontSize:12,cursor:"pointer"}}>Annuler</button>
      </div>
    </ModalWrap>
  );
}

function DocsTab({ prospect, onUpdate, projId }) {
  const P = PROJECTS[projId];
  const [docs,      setDocs]      = useState(prospect.docs||[]);
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const path = `${prospect.id}/${Date.now()}_${file.name}`;
      console.log("Upload vers:", path, "bucket: amigo-docs");
      const { data: upData, error } = await supabase.storage.from("amigo-docs").upload(path, file);
      console.log("Résultat upload:", upData, error);
      if (error) throw new Error(`Upload échoué : ${error.message}`);
      const newDoc = { id:"doc"+uid(), name:file.name, path, size:file.size, date:new Date().toLocaleDateString("fr-FR"), uploadedBy:"Anthony" };
      const updated = [...docs, newDoc];
      setDocs(updated);
      onUpdate(prospect.id, { docs: updated });
    } catch(e) {
      console.error("Erreur upload:", e);
      alert("❌ Erreur : " + e.message);
    }
    setUploading(false);
  };

  const deleteDoc = async (doc) => {
    if (!confirm(`Supprimer "${doc.name}" ?`)) return;
    await supabase.storage.from("amigo-docs").remove([doc.path]);
    const updated = docs.filter(d=>d.id!==doc.id);
    setDocs(updated);
    onUpdate(prospect.id, { docs: updated });
  };

  const openDoc = async (doc) => {
    const {data,error} = await supabase.storage.from("amigo-docs").createSignedUrl(doc.path, 3600);
    if (error||!data) { alert("Erreur accès fichier"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const fmtSize = b => b>1024*1024?`${(b/1024/1024).toFixed(1)}Mo`:b>1024?`${(b/1024).toFixed(0)}Ko`:`${b}o`;
  const fileIcon = n => n?.endsWith(".pdf")?"📄":n?.match(/\.(xlsx?|csv)/)?"📊":n?.match(/\.(jpe?g|png|gif|webp)/)?"🖼️":n?.match(/\.(docx?)/)?"📝":"📎";

  return (
    <div>
      {/* Zone drag & drop */}
      <div
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)uploadFile(f);}}
        style={{position:"relative",border:`2px dashed ${dragging?P.color:"#1a2035"}`,borderRadius:10,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:dragging?`${P.color}08`:"transparent",transition:"all .15s",marginBottom:14}}>
        <input type="file" onChange={e=>{if(e.target.files[0])uploadFile(e.target.files[0]);e.target.value="";}}
          style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0,cursor:"pointer",zIndex:2}}/>
        {uploading
          ? <p style={{fontSize:12,color:P.color}}>⏳ Envoi en cours…</p>
          : <>
              <p style={{fontSize:22,marginBottom:6}}>📁</p>
              <p style={{fontSize:12,color:"#4b5563",marginBottom:2}}>Glisse un fichier ici ou clique pour parcourir</p>
              <p style={{fontSize:10,color:"#2d3748"}}>PDF, Excel, Word, images — max 50Mo</p>
            </>
        }
      </div>
      {docs.length===0
        ? <p style={{fontSize:11,color:"#2d3748",textAlign:"center",padding:"10px 0",fontStyle:"italic"}}>Aucun document attaché.</p>
        : docs.map(doc=>(
          <div key={doc.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#0b0d16",borderRadius:8,border:"1px solid #0f1520",marginBottom:6}}>
            <span style={{fontSize:20,flexShrink:0}}>{fileIcon(doc.name)}</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name}</p>
              <p style={{fontSize:10,color:"#4b5563"}}>{doc.date} · {fmtSize(doc.size)}</p>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button onClick={()=>openDoc(doc)} style={{padding:"4px 10px",background:`${P.color}18`,border:`1px solid ${P.color}28`,borderRadius:5,color:P.color,fontSize:10,fontWeight:600,cursor:"pointer"}}>⬇️ Ouvrir</button>
              <button onClick={()=>deleteDoc(doc)} style={{padding:"4px 8px",background:"#ef444415",border:"1px solid #ef444425",borderRadius:5,color:"#f87171",fontSize:10,cursor:"pointer"}}>✕</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

function CarteVin({ prospects, onOpenProspect, onAddProspect }) {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x:0,y:0});
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  // Régions positionnées par projection géographique réelle
  const REGIONS = [
    { id:"bordeaux",   label:"Bordeaux",        color:"#e74c3c", cx:144, cy:286 },
    { id:"bourgogne",  label:"Bourgogne",       color:"#9b59b6", cx:273, cy:198 },
    { id:"champagne",  label:"Champagne",       color:"#f1c40f", cx:271, cy:110 },
    { id:"alsace",     label:"Alsace",          color:"#e67e22", cx:366, cy:138 },
    { id:"loire",      label:"Loire",           color:"#27ae60", cx:180, cy:184 },
    { id:"rhone",      label:"Vallée du Rhône", color:"#d35400", cx:294, cy:272 },
    { id:"languedoc",  label:"Languedoc",       color:"#16a085", cx:258, cy:336 },
    { id:"provence",   label:"Provence",        color:"#c0392b", cx:325, cy:340 },
    { id:"beaujolais", label:"Beaujolais",      color:"#8e44ad", cx:289, cy:236 },
    { id:"jura",       label:"Jura/Savoie",     color:"#7f8c8d", cx:325, cy:212 },
    { id:"sw",         label:"Sud-Ouest",       color:"#795548", cx:199, cy:336 },
  ];

  const STATUS_COLORS = {
    "À contacter":"#3b82f6","Contacté":"#f59e0b","En négociation":"#8b5cf6",
    "Commande passée":"#22c55e","Livraison en cours":"#06b6d4","Partenaire actif":"#4ade80",
  };

  const getRegion = (p) => {
    if (p.regionManuelle) return p.regionManuelle;
    const h = `${p.appellation||""} ${p.sub||""} ${p.note||""} ${p.cepage||""} ${p.name||""} ${p.producteur||""}`.toLowerCase();
    if (h.match(/bordeaux|medoc|pessac|saint.?emilion|pomerol|sauternes|margaux|lalande|lalaudey|pontac|calice/)) return "bordeaux";
    if (h.match(/bourgogne|puligny|gevrey|chambolle|nuits|meursault|chablis|macon|leflaive|montrachet|folie.sauvage|coteaux.bourgignon|bourgignon|heitz/)) return "bourgogne";
    if (h.match(/champagne|reims|epernay|charpentier/)) return "champagne";
    if (h.match(/alsace|riesling|gewurz|sylvaner|agape/)) return "alsace";
    if (h.match(/loire|vouvray|muscadet|chinon|sancerre|touraine|pouilly|amboise|cheverny|chenin|alain.robert|daridan|bessons|delobel|delaunay|sainson|herivault|champalou|croix.melier|bulapapa/)) return "loire";
    if (h.match(/rhone|rhône|cotes.du.rhone|chateauneuf|hermitage|condrieu/)) return "rhone";
    if (h.match(/languedoc|roussillon|picpoul|faugeres|fitou/)) return "languedoc";
    if (h.match(/provence|bandol|cassis|cotes.de.provence/)) return "provence";
    if (h.match(/beaujolais|gamay|morgon|fleurie|nugues/)) return "beaujolais";
    if (h.match(/jura|savoie|bugey|mondeuse|trosset|arbin/)) return "jura";
    if (h.match(/cahors|gaillac|bergerac|madiran|armagnac|morin|bourgueil|deshenry/)) return "sw";
    if (h.match(/aoc|igp|vin de france/)) return "loire";
    return null;
  };

  const regionProspects = {};
  prospects.forEach(p => {
    const r = getRegion(p);
    if (r) { if (!regionProspects[r]) regionProspects[r]=[]; regionProspects[r].push(p); }
  });

  const covered   = REGIONS.filter(r=>regionProspects[r.id]?.length);
  const uncovered = REGIONS.filter(r=>!regionProspects[r.id]?.length);
  const unmapped  = prospects.filter(p=>!getRegion(p));
  const selectedReg = REGIONS.find(r=>r.id===selectedRegion);
  const selectedProspects = selectedRegion ? (regionProspects[selectedRegion]||[]) : [];

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(z => Math.max(0.8, Math.min(6, z + delta)));
  };

  const handleMouseDown = (e) => { setDragging(true); setDragStart({x:e.clientX-pan.x, y:e.clientY-pan.y}); };
  const handleMouseMove = (e) => { if (dragging&&dragStart) setPan({x:e.clientX-dragStart.x, y:e.clientY-dragStart.y}); };
  const handleMouseUp   = () => { setDragging(false); setDragStart(null); };

  // Tracé SVG France — projeté depuis GeoJSON réel (Natural Earth / world.geo.json)
  const FRANCE_PATH = "M260,65 L280,84 L294,81 L319,99 L325,102 L333,101 L346,112 L387,119 L373,147 L369,175 L361,182 L349,178 L350,188 L329,211 L329,229 L342,223 L352,240 L350,252 L359,267 L349,279 L356,310 L371,315 L368,332 L343,355 L288,344 L247,357 L244,381 L211,386 L180,368 L169,377 L118,359 L107,343 L121,319 L127,239 L98,197 L77,177 L34,162 L31,133 L68,124 L115,134 L106,89 L132,106 L197,75 L206,42 L230,34 L234,48 L247,49 L260,65 Z";
  const CORSE_PATH = "M428,394 L418,425 L406,417 L399,390 L405,375 L423,360 L428,394 Z";

  return (
    <div className="fade">
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        {/* CARTE */}
        <div style={{flex:"1 1 300px",maxWidth:450,background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid #0d1020",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9"}}>🗺 France viticole</p>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:10,color:"#4b5563"}}>Scroll = zoom</span>
              <button onClick={()=>{setZoom(1);setPan({x:0,y:0});}} style={{fontSize:10,padding:"2px 7px",background:"#0f1520",border:"1px solid #1a2035",borderRadius:4,color:"#4b5563",cursor:"pointer"}}>↺</button>
            </div>
          </div>
          <div style={{overflow:"hidden",width:450,height:500,cursor:dragging?"grabbing":"grab",background:"#080a0f"}}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}>
            <svg viewBox="0 0 460 480" width={450} height={500}
              style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,transformOrigin:"center center",transition:dragging?"none":"transform .1s"}}>
              {/* France */}
              <path d={FRANCE_PATH} fill="#111827" stroke="#475569" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d={CORSE_PATH} fill="#111827" stroke="#475569" strokeWidth="1.5" strokeLinejoin="round"/>
              {/* Paris */}
              <text x="215" y="120" fontSize="8" fill="#475569" fontFamily="sans-serif">Paris</text>
              <circle cx="226" cy="126" r="2.5" fill="#64748b"/>

              {/* Régions viticoles */}
              {REGIONS.map(r => {
                const pList = regionProspects[r.id]||[];
                const has = pList.length>0;
                const isSel = selectedRegion===r.id;
                return (
                  <g key={r.id} onClick={()=>setSelectedRegion(isSel?null:r.id)} style={{cursor:"pointer"}}>
                    {has&&<circle cx={r.cx} cy={r.cy} r={isSel?22:17}
                      fill={r.color+"28"} stroke={r.color} strokeWidth={isSel?2.5:1.5}
                      style={{transition:"all .2s"}}/>}
                    {!has&&<circle cx={r.cx} cy={r.cy} r={8}
                      fill="#1e293b" stroke="#475569" strokeWidth="1"
                      strokeDasharray="3,2"/>}
                    {/* Points prospects */}
                    {pList.map((p,i) => {
                      const angle=(i*137.5)*Math.PI/180;
                      const rad=6+(i%3)*5;
                      const c=STATUS_COLORS[p.status]||"#6b7280";
                      return <circle key={p.id}
                        cx={r.cx+Math.cos(angle)*rad} cy={r.cy+Math.sin(angle)*rad}
                        r={4} fill={c} stroke="#080a0f" strokeWidth={1}
                        style={{cursor:"pointer"}}
                        onClick={e=>{e.stopPropagation();onOpenProspect(p);}}/>;
                    })}
                    <text x={r.cx} y={r.cy+(has?30:20)} textAnchor="middle"
                      fontSize={isSel?"9":"7.5"} fill={has?r.color:"#475569"}
                      fontFamily="DM Sans" fontWeight="600" pointerEvents="none">
                      {r.label}
                    </text>
                    {has&&<text x={r.cx+16} y={r.cy-12} textAnchor="middle"
                      fontSize="9" fill="#f1f5f9" fontFamily="DM Sans" fontWeight="700" pointerEvents="none">
                      {pList.length}
                    </text>}
                  </g>
                );
              })}
            </svg>
          </div>
          <div style={{padding:"8px 12px",borderTop:"1px solid #0d1020",display:"flex",flexWrap:"wrap",gap:6}}>
            {Object.entries(STATUS_COLORS).map(([s,c])=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:3}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:c}}/>
                <span style={{fontSize:8,color:"#4b5563"}}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL DROIT */}
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:10,overflowY:"auto",maxHeight:580}}>
          {selectedRegion&&selectedReg&&(
            <div style={{background:"#0b0d16",border:`2px solid ${selectedReg.color}50`,borderRadius:11,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <p style={{fontSize:13,fontWeight:700,color:selectedReg.color}}>{selectedReg.label} — {selectedProspects.length} domaine{selectedProspects.length>1?"s":""}</p>
                <button onClick={()=>setSelectedRegion(null)} style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer",fontSize:18}}>×</button>
              </div>
              {selectedProspects.map(p=>{
                const c=STATUS_COLORS[p.status]||"#6b7280";
                return (
                  <div key={p.id} onClick={()=>onOpenProspect(p)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,marginBottom:5,background:"#080a0f",border:`1px solid ${c}22`,cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#0f1520"}
                    onMouseLeave={e=>e.currentTarget.style.background="#080a0f"}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</p>
                      <p style={{fontSize:10,color:"#4b5563"}}>{p.cepage||p.producteur||"–"} · {p.status}</p>
                    </div>
                    {p.bio&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"#22c55e15",color:"#4ade80",fontWeight:600}}>Bio</span>}
                    <span style={{fontSize:11,color:"#4b5563"}}>→</span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <p style={{fontSize:11,fontWeight:600,color:"#f1f5f9"}}>📊 Couverture — {covered.length}/{REGIONS.length}</p>
              <span style={{fontSize:11,fontWeight:700,color:"#8b5cf6"}}>{prospects.length} domaines</span>
            </div>
            <div style={{height:5,background:"#0d1020",borderRadius:3,marginBottom:10,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${covered.length/REGIONS.length*100}%`,background:"linear-gradient(90deg,#8b5cf6,#6d28d9)",borderRadius:3}}/>
            </div>
            {covered.map(r=>(
              <div key={r.id} onClick={()=>setSelectedRegion(r.id)}
                style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",borderRadius:6,marginBottom:3,cursor:"pointer",background:selectedRegion===r.id?`${r.color}15`:"transparent"}}
                onMouseEnter={e=>e.currentTarget.style.background=`${r.color}10`}
                onMouseLeave={e=>e.currentTarget.style.background=selectedRegion===r.id?`${r.color}15`:"transparent"}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:r.color}}/>
                  <span style={{fontSize:11,color:"#9ca3af"}}>{r.label}</span>
                </div>
                <span style={{fontSize:11,fontWeight:600,color:r.color}}>{regionProspects[r.id].length} →</span>
              </div>
            ))}
          </div>

          {uncovered.length>0&&(
            <div style={{background:"#0b0d16",border:"1px solid #ef444425",borderRadius:11,padding:14}}>
              <p style={{fontSize:11,fontWeight:600,color:"#f87171",marginBottom:8}}>⚠️ Zones non couvertes</p>
              {uncovered.map(r=>(
                <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid #080a0f"}}>
                  <span style={{fontSize:11,color:"#6b7280"}}>{r.label}</span>
                  <button onClick={onAddProspect} style={{fontSize:10,padding:"2px 8px",background:"#3b82f618",border:"1px solid #3b82f628",borderRadius:4,color:"#60a5fa",cursor:"pointer"}}>+ Ajouter</button>
                </div>
              ))}
            </div>
          )}

          {unmapped.length>0&&(
            <div style={{background:"#0b0d16",border:"1px solid #f59e0b25",borderRadius:11,padding:14}}>
              <p style={{fontSize:11,fontWeight:600,color:"#fbbf24",marginBottom:8}}>📍 Non localisés ({unmapped.length})</p>
              {unmapped.map(p=>(
                <div key={p.id} onClick={()=>onOpenProspect(p)}
                  style={{fontSize:11,color:"#6b7280",padding:"3px 0",borderBottom:"1px solid #080a0f",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.color="#94a3b8"}
                  onMouseLeave={e=>e.currentTarget.style.color="#6b7280"}>
                  {p.name} →
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function OrderDetailModal({ o, data, projId, $, updateOrder, setDetailOrder, setDetailProspect, sendGmail, celebrate }) {
  const isCmd = o.type!=="devis";
  const allowedStatuses = isCmd ? ORDER_STATUSES : QUOTE_STATUSES;
  const statusIdx = isCmd ? ORDER_STATUSES.indexOf(o.status) : -1;
  const orderTotal = o.amount * (o.qty || 1);
  const pixStr = isCmd && orderTotal > 0 ? pixPayload(orderTotal, o.id.slice(0,25)) : "";
  const pixQrUrl = pixStr ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixStr)}` : "";
  const linkedProspect = o.prospectId
    ? ["makeup","vin","vinClients","print3d"].reduce((found,k) => found || (data?.[k]||[]).find(p=>p.id===o.prospectId), null)
    : null;

  const [editing, setEditing] = useState(false);
  const [eProduct, setEProduct] = useState(o.product||"");
  const [eAmount, setEAmount]   = useState(String(o.amount||0));
  const [eQty, setEQty]         = useState(String(o.qty||1));
  const [eDate, setEDate]       = useState(o.date||"");
  const [eNotes, setENotes]     = useState(o.notes||"");
  const [ePayTerms, setEPayTerms] = useState(o.payTerms||"50% na aprovação, 50% na entrega");
  const [quoteLink, setQuoteLink] = useState(o.quoteToken ? `${window.location.origin}/#/quote/${o.quoteToken}` : "");
  const [publishing, setPublishing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const publishQuote = async (republish = false) => {
    setPublishing(true);
    try {
      const token = o.quoteToken || `q${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
      // Relire l'existant pour conserver les vues/statut si re-publication
      let existing = null;
      if (republish && o.quoteToken) {
        const { data: ex } = await supabase.from("amigo_data").select("value").eq("key", `quote_${token}`).single();
        if (ex?.value) existing = typeof ex.value === "string" ? JSON.parse(ex.value) : ex.value;
      }
      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30);
      const quoteData = {
        orderId: o.id, proj: o.proj, prospectName: o.prospectName,
        prospectCnpj: linkedProspect?.cnpj || "",
        product: o.product, qty: o.qty || 1, amount: o.amount,
        date: o.date, validUntil: validDate.toISOString().slice(0,10),
        notes: o.notes || "", payTerms: o.payTerms || "50% na aprovação, 50% na entrega",
        status: existing?.status === "accepted" ? "accepted" : "sent",
        views: existing?.views || [], sentAt: existing?.sentAt || Date.now(),
        viewedAt: existing?.viewedAt || null, acceptedAt: existing?.acceptedAt || null,
        updatedAt: Date.now(),
      };
      await supabase.from("amigo_data").upsert({ key: `quote_${token}`, value: JSON.stringify(quoteData), updated_at: new Date().toISOString() });
      if (!o.quoteToken) {
        updateOrder(o.id, { quoteToken: token });
        setDetailOrder(d => ({ ...d, quoteToken: token }));
      }
      const link = `${window.location.origin}/#/quote/${token}`;
      setQuoteLink(link);
    } catch(e) { console.error(e); }
    setPublishing(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(quoteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };
  const inputSt = {width:"100%",padding:"5px 7px",borderRadius:5,fontSize:12,outline:"none",background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"};
  const saveEdit = () => {
    const upd = {product:eProduct, amount:parseFloat(eAmount)||0, qty:parseInt(eQty)||1, date:eDate, notes:eNotes, payTerms:ePayTerms};
    updateOrder(o.id, upd);
    setDetailOrder(d=>({...d,...upd}));
    setEditing(false);
  };
  const editTotal = (parseFloat(eAmount)||0) * (parseInt(eQty)||1);

  const printInvoice = () => {
    const w = window.open("","_blank","width=800,height=600");
    w.document.write(`<html><head><title>Factura ${o.id}</title><style>
      body{font-family:Arial,sans-serif;padding:40px;color:#222;max-width:700px;margin:0 auto}
      h1{font-size:22px;margin-bottom:4px} .sub{color:#666;font-size:12px}
      table{width:100%;border-collapse:collapse;margin:20px 0} th,td{padding:8px 12px;border:1px solid #ddd;text-align:left;font-size:13px}
      th{background:#f5f5f5} .total{font-size:18px;font-weight:bold;color:#16a34a}
      .pix{text-align:center;margin:20px 0} .pix img{width:180px} .footer{margin-top:30px;font-size:11px;color:#888;border-top:1px solid #ddd;padding-top:10px}
    </style></head><body>
      <h1>${EMPRESA.nome} — Labo 3D</h1>
      <p class="sub">CNPJ: ${EMPRESA.cnpj} · ${EMPRESA.email} · ${EMPRESA.tel}</p>
      <hr style="margin:16px 0;border:none;border-top:2px solid #222">
      <h2 style="font-size:16px">FACTURA N° ${o.id.toUpperCase()}</h2>
      <table>
        <tr><th>Cliente</th><td>${o.prospectName||"–"}</td></tr>
        <tr><th>Produto</th><td>${o.product||"–"}</td></tr>
        <tr><th>Quantidade</th><td>${o.qty||1}</td></tr>
        <tr><th>Data</th><td>${o.date||new Date().toISOString().slice(0,10)}</td></tr>
      </table>
      <p class="total">TOTAL: R$ ${orderTotal?.toFixed(2)||"0.00"}</p>
      ${pixQrUrl?`<div class="pix"><p style="font-size:13px;font-weight:bold">Pagamento PIX</p><img src="${pixQrUrl}" alt="QR PIX"/><p style="font-size:11px;color:#666;margin-top:6px">Chave PIX (CNPJ): ${EMPRESA.cnpj}</p></div>`:""}
      <div class="footer">
        <p>${EMPRESA.nome} — Labo 3D · CNPJ ${EMPRESA.cnpj} · ${EMPRESA.cidade}</p>
        <p>Documento gerado em ${new Date().toLocaleDateString("pt-BR")}</p>
      </div>
    </body></html>`);
    w.document.close();
    setTimeout(()=>w.print(), 300);
  };

  const exportCSV = () => {
    const rows = [
      ["N°","Cliente","Produto","Qtd","Valor Unit.","Valor Total","Data","Status"],
      [o.id, o.prospectName, o.product, o.qty||1, o.amount?.toFixed(2), orderTotal?.toFixed(2), o.date, o.status]
    ];
    const csv = rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`factura_${o.id}.csv`; a.click();
  };

  return (
    <ModalWrap title={`${isCmd?"📦 Commande":"📋 Devis"} — ${o.prospectName||"–"}`} onClose={()=>setDetailOrder(null)} wide>
      {o.thumbnail&&(
        <div style={{marginBottom:14,textAlign:"center"}}>
          <img src={o.thumbnail} alt="Aperçu" style={{maxWidth:"100%",maxHeight:180,borderRadius:9,border:"1px solid #1a2035"}}/>
        </div>
      )}
      {isCmd&&(
        <div style={{display:"flex",gap:4,marginBottom:14}}>
          {ORDER_STATUSES.filter(s=>s!=="Annulée").map((s,i)=>{
            const cur = ORDER_STATUSES.indexOf(o.status);
            const done = i <= cur;
            return <div key={s} style={{flex:1,textAlign:"center"}}>
              <div style={{height:4,borderRadius:2,background:done?"#22c55e":"#1a2035",marginBottom:4}}/>
              <span style={{fontSize:9,color:done?"#4ade80":"#4b5563",fontWeight:i===cur?700:400}}>{s}</span>
            </div>;
          })}
        </div>
      )}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:6}}>
        {!editing
          ? <button onClick={()=>setEditing(true)} style={{fontSize:10,color:"#a78bfa",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>✏️ Modifier</button>
          : <div style={{display:"flex",gap:8}}>
              <button onClick={saveEdit} style={{fontSize:10,color:"#4ade80",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>✓ Enregistrer</button>
              <button onClick={()=>setEditing(false)} style={{fontSize:10,color:"#4b5563",background:"none",border:"none",cursor:"pointer"}}>Annuler</button>
            </div>
        }
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 14px",marginBottom:14}}>
        <div><p style={{fontSize:10,color:"#4b5563",fontWeight:600,textTransform:"uppercase",marginBottom:3}}>Client</p><p style={{fontSize:13,color:"#f1f5f9",fontWeight:600}}>{o.prospectName||"–"}</p></div>
        <div><p style={{fontSize:10,color:"#4b5563",fontWeight:600,textTransform:"uppercase",marginBottom:3}}>Produit</p>
          {editing ? <input value={eProduct} onChange={e=>setEProduct(e.target.value)} style={inputSt}/> : <p style={{fontSize:13,color:"#f1f5f9"}}>{o.product||"–"}</p>}
        </div>
        <div><p style={{fontSize:10,color:"#4b5563",fontWeight:600,textTransform:"uppercase",marginBottom:3}}>Montant unitaire</p>
          {editing ? <input type="number" value={eAmount} onChange={e=>setEAmount(e.target.value)} style={inputSt}/> : <p style={{fontSize:13,color:"#f1f5f9"}}>{$(o.amount)}</p>}
        </div>
        <div><p style={{fontSize:10,color:"#4b5563",fontWeight:600,textTransform:"uppercase",marginBottom:3}}>Quantité</p>
          {editing ? <input type="number" value={eQty} onChange={e=>setEQty(e.target.value)} style={inputSt}/> : <p style={{fontSize:13,color:"#f1f5f9"}}>{o.qty||1}</p>}
        </div>
        <div><p style={{fontSize:10,color:"#4b5563",fontWeight:600,textTransform:"uppercase",marginBottom:3}}>Total</p><p style={{fontSize:15,color:"#22c55e",fontWeight:700}}>{$(editing ? editTotal : orderTotal)}</p></div>
        <div><p style={{fontSize:10,color:"#4b5563",fontWeight:600,textTransform:"uppercase",marginBottom:3}}>Date</p>
          {editing ? <input type="date" value={eDate} onChange={e=>setEDate(e.target.value)} style={inputSt}/> : <p style={{fontSize:13,color:"#f1f5f9"}}>{o.date||"–"}</p>}
        </div>
        <div style={{gridColumn:"span 2"}}><p style={{fontSize:10,color:"#4b5563",fontWeight:600,textTransform:"uppercase",marginBottom:3}}>Statut</p>
          <select value={o.status} onChange={e=>{updateOrder(o.id,{status:e.target.value});setDetailOrder(d=>({...d,status:e.target.value}));}}
            style={{padding:"5px 8px",borderRadius:6,fontSize:12,outline:"none",cursor:"pointer",background:"#080a0f",border:"1px solid #1a2035",color:"#f1f5f9",fontFamily:"inherit"}}>
            {allowedStatuses.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {(o.notes||editing)&&(
        <div style={{background:"#080a0f",borderRadius:8,padding:"10px 12px",border:"1px solid #0f1520",marginBottom:14}}>
          <p style={{fontSize:10,color:"#4b5563",fontWeight:600,textTransform:"uppercase",marginBottom:6}}>{editing?"Notes (visibles par le client)":"Détail calcul"}</p>
          {editing
            ? <textarea value={eNotes} onChange={e=>setENotes(e.target.value)} rows={4} style={{...inputSt,resize:"vertical",lineHeight:1.6}}/>
            : <p style={{fontSize:12,color:"#e2e8f0",lineHeight:1.7}}>{o.notes.split(" · ").join("\n").split("\n").map((l,i)=><span key={i}>{l}<br/></span>)}</p>
          }
        </div>
      )}
      {/* Conditions de paiement */}
      {(!isCmd) && (
        <div style={{background:"#080a0f",borderRadius:8,padding:"10px 12px",border:"1px solid #0f1520",marginBottom:14}}>
          <p style={{fontSize:10,color:"#4b5563",fontWeight:600,textTransform:"uppercase",marginBottom:6}}>💳 Conditions de paiement</p>
          {editing
            ? <input value={ePayTerms} onChange={e=>setEPayTerms(e.target.value)} placeholder="Ex: 50% na aprovação, 50% na entrega" style={inputSt}/>
            : <p style={{fontSize:12,color:"#e2e8f0"}}>{o.payTerms || "50% na aprovação, 50% na entrega"}</p>
          }
        </div>
      )}
      {isCmd && statusIdx >= 1 && pixQrUrl && (
        <div style={{background:"#080a0f",borderRadius:8,padding:"14px",border:"1px solid #22c55e18",marginBottom:14,textAlign:"center"}}>
          <p style={{fontSize:11,fontWeight:700,color:"#22c55e",marginBottom:8,textTransform:"uppercase"}}>Pagamento PIX</p>
          <img src={pixQrUrl} alt="QR PIX" style={{width:160,height:160,borderRadius:8,border:"4px solid white"}}/>
          <p style={{fontSize:11,color:"#4b5563",marginTop:8}}>Chave CNPJ: {EMPRESA.cnpj}</p>
          <p style={{fontSize:13,fontWeight:700,color:"#4ade80",marginTop:4}}>R$ {orderTotal?.toFixed(2)}</p>
          <button onClick={()=>{navigator.clipboard.writeText(pixStr);}} style={{marginTop:8,padding:"5px 14px",background:"#22c55e15",border:"1px solid #22c55e28",borderRadius:6,color:"#4ade80",fontSize:11,fontWeight:600,cursor:"pointer"}}>
            Copier code PIX
          </button>
        </div>
      )}
      {linkedProspect && (
        <div style={{marginBottom:14}}>
          <button onClick={()=>{setDetailOrder(null);setDetailProspect({...linkedProspect,_proj:o.proj});}}
            style={{padding:"7px 14px",background:"#3b82f610",border:"1px solid #3b82f625",borderRadius:7,color:"#60a5fa",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            👤 Voir fiche {linkedProspect.name} {linkedProspect.email&&<span style={{color:"#4b5563"}}>({linkedProspect.email})</span>}
          </button>
        </div>
      )}
      {/* Lien partageable + envoi par email */}
      {!isCmd && (
        <div style={{background:"#080a0f",border:"1px solid #8b5cf620",borderRadius:8,padding:"14px",marginBottom:14}}>
          <p style={{fontSize:10,color:"#4b5563",fontWeight:600,textTransform:"uppercase",marginBottom:10}}>🔗 Lien devis client</p>
          {!quoteLink ? (
            <button onClick={publishQuote} disabled={publishing}
              style={{width:"100%",padding:"10px",background:"#8b5cf618",border:"1px solid #8b5cf628",borderRadius:7,color:"#a78bfa",fontSize:12,fontWeight:600,cursor:publishing?"default":"pointer",opacity:publishing?0.6:1}}>
              {publishing ? "Publication…" : "📤 Publier le devis & générer le lien"}
            </button>
          ) : (
            <>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                <input value={quoteLink} readOnly style={{flex:1,padding:"7px 9px",borderRadius:6,fontSize:11,background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"monospace"}}/>
                <button onClick={copyLink} style={{padding:"7px 14px",borderRadius:6,fontSize:11,fontWeight:600,background:linkCopied?"#22c55e18":"#8b5cf618",border:`1px solid ${linkCopied?"#22c55e28":"#8b5cf628"}`,color:linkCopied?"#4ade80":"#a78bfa",cursor:"pointer",whiteSpace:"nowrap"}}>
                  {linkCopied ? "✓ Copié" : "📋 Copier"}
                </button>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                <a href={quoteLink+"?preview=1"} target="_blank" rel="noopener" style={{fontSize:11,color:"#60a5fa",textDecoration:"none"}}>👁 Aperçu</a>
                <span style={{fontSize:10,color:"#1a2035"}}>·</span>
                <button onClick={()=>publishQuote(true)} disabled={publishing}
                  style={{fontSize:11,color:"#f59e0b",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>
                  {publishing?"…":"🔄 Re-publier"}
                </button>
              </div>
              {/* WhatsApp */}
              {linkedProspect?.phone && (
                <a href={waLink(linkedProspect.phone, `Olá${linkedProspect.contact?` ${linkedProspect.contact.split(" ")[0]}`:""}!\n\nSegue o orçamento para *${o.product||"seu projeto"}*:\n\n${quoteLink}\n\n• Produto: ${o.product||"Peça 3D"}\n• Qtd: ${o.qty||1}\n• Total: *R$${orderTotal.toFixed(2)}*\n\nVocê pode aceitar diretamente pelo link.\n\nAbraço,\nAnthony · ${EMPRESA.nome}`)} target="_blank" rel="noopener"
                  style={{display:"block",width:"100%",padding:"9px",background:"#22c55e18",border:"1px solid #22c55e28",borderRadius:7,color:"#4ade80",fontSize:12,fontWeight:600,textDecoration:"none",textAlign:"center",marginBottom:8,boxSizing:"border-box"}}>
                  WhatsApp — Envoyer le devis à {linkedProspect.contact?.split(" ")[0]||linkedProspect.name}
                </a>
              )}
              {/* Tracking */}
              {o.quoteToken && <QuoteTracking token={o.quoteToken}/>}
              {/* Envoyer par email */}
              {linkedProspect?.email && (()=>{
                const defaultSubject = `Orçamento ${o.product||"Peça 3D"} — ${EMPRESA.nome}`;
                const defaultBody = `Prezado(a)${linkedProspect.contact?` ${linkedProspect.contact.split(" ")[0]}`:""},\n\nSegue o orçamento para o seu projeto:\n\n${quoteLink}\n\n• Produto: ${o.product||"Peça 3D"}\n• Quantidade: ${o.qty||1}\n• Valor total: R$${orderTotal.toFixed(2)}\n• Ref.: ${o.id.toUpperCase()}\n\nEste orçamento é válido por 30 dias.\nVocê pode aceitar diretamente pelo link acima.\n\nQualquer dúvida, estamos à disposição.\n\nAtenciosamente,\nAnthony Donzel\n${EMPRESA.nome} · ${EMPRESA.tel}`;
                return <QuoteEmailForm key={`${o.id}-${o.amount}-${o.qty}-${o.product}`} to={linkedProspect.email} defaultSubject={defaultSubject} defaultBody={defaultBody} projId={o.proj} onSend={sendGmail}
                  onSent={()=>{updateOrder(o.id,{status:"Envoyé"});setDetailOrder(d=>({...d,status:"Envoyé"}));}}/>;
              })()}
            </>
          )}
        </div>
      )}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {!isCmd && o.status==="Accepté"&&(
          <button onClick={()=>{updateOrder(o.id,{type:"commande",status:"En attente"});setDetailOrder(d=>({...d,type:"commande",status:"En attente"}));celebrate();}}
            style={{flex:1,padding:"9px",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:7,color:"white",fontSize:13,fontWeight:600,cursor:"pointer"}}>→ Passer en commande</button>
        )}
        {isCmd && <button onClick={printInvoice} style={{flex:1,padding:"9px",background:"#3b82f615",border:"1px solid #3b82f628",borderRadius:7,color:"#60a5fa",fontSize:12,fontWeight:600,cursor:"pointer"}}>🖨 Imprimer facture</button>}
        {isCmd && <button onClick={exportCSV} style={{flex:1,padding:"9px",background:"#f59e0b15",border:"1px solid #f59e0b28",borderRadius:7,color:"#fbbf24",fontSize:12,fontWeight:600,cursor:"pointer"}}>📊 Export CSV</button>}
        <button onClick={()=>setDetailOrder(null)} style={{flex:1,padding:"9px",background:"#0b0d16",border:"1px solid #0f1520",borderRadius:7,color:"#6b7280",fontSize:12,cursor:"pointer"}}>Fermer</button>
      </div>
    </ModalWrap>
  );
}

function IdeasBox({ data, user, save }) {
  const [text, setText] = useState("");
  const [type, setType] = useState("idee"); // "idee" | "bug" | "amelioration"
  const ideas = (data?.ideas || []).slice().reverse();

  const addIdea = async () => {
    if (!text.trim()) return;
    const idea = { id: Date.now(), text: text.trim(), type, by: user, byLabel: USERS[user]?.label, at: Date.now(), status: "nouveau", votes: [] };
    await save({ ...data, ideas: [...(data.ideas || []), idea] });
    setText("");
  };

  const vote = async (id) => {
    const nd = { ...data, ideas: (data.ideas || []).map(i => {
      if (i.id !== id) return i;
      const hasVoted = (i.votes || []).includes(user);
      return { ...i, votes: hasVoted ? i.votes.filter(v => v !== user) : [...(i.votes || []), user] };
    })};
    await save(nd);
  };

  const setStatus = async (id, status) => {
    await save({ ...data, ideas: (data.ideas || []).map(i => i.id === id ? { ...i, status } : i) });
  };

  const deleteIdea = async (id) => {
    if (!confirm("Supprimer cette idée ?")) return;
    await save({ ...data, ideas: (data.ideas || []).filter(i => i.id !== id) });
  };

  const typeConfig = { idee: { icon: "💡", label: "Idée", color: "#f59e0b" }, bug: { icon: "🐛", label: "Bug", color: "#ef4444" }, amelioration: { icon: "✨", label: "Amélioration", color: "#8b5cf6" } };
  const statusConfig = { nouveau: { label: "Nouveau", color: "#3b82f6" }, enCours: { label: "En cours", color: "#f59e0b" }, fait: { label: "Fait", color: "#22c55e" }, rejete: { label: "Rejeté", color: "#6b7280" } };

  return (
    <div className="fade">
      <p style={{fontSize:16,fontWeight:700,color:"#f1f5f9",marginBottom:14}}>💡 Boîte à idées</p>

      {/* Formulaire */}
      <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:10,padding:14,marginBottom:16}}>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          {Object.entries(typeConfig).map(([k, v]) => (
            <button key={k} onClick={() => setType(k)} className="btn"
              style={{padding:"5px 10px",borderRadius:6,fontSize:11,fontWeight:600,background:type===k?`${v.color}18`:"transparent",border:`1px solid ${type===k?`${v.color}28`:"#1a2035"}`,color:type===k?v.color:"#4b5563",cursor:"pointer"}}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Décris ton idée, bug ou amélioration..."
            onKeyDown={e => { if (e.key === "Enter") addIdea(); }}
            style={{flex:1,padding:"9px 12px",borderRadius:7,fontSize:12,outline:"none",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"}} />
          <button onClick={addIdea} style={{padding:"9px 16px",borderRadius:7,fontSize:12,fontWeight:600,background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",border:"none",color:"white",cursor:"pointer"}}>
            Ajouter
          </button>
        </div>
      </div>

      {/* Liste */}
      {ideas.length === 0
        ? <p style={{textAlign:"center",color:"#374151",fontSize:12,padding:30}}>Aucune idée pour le moment. Sois le premier !</p>
        : ideas.map(idea => {
          const tc = typeConfig[idea.type] || typeConfig.idee;
          const sc = statusConfig[idea.status] || statusConfig.nouveau;
          const hasVoted = (idea.votes || []).includes(user);
          return (
            <div key={idea.id} style={{background:"#0b0d16",border:`1px solid ${tc.color}15`,borderRadius:10,padding:"12px 14px",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                {/* Vote */}
                <div style={{textAlign:"center",flexShrink:0}}>
                  <button onClick={() => vote(idea.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:0,color:hasVoted?"#f59e0b":"#374151"}}>
                    {hasVoted ? "▲" : "△"}
                  </button>
                  <p style={{fontSize:12,fontWeight:700,color:hasVoted?"#f59e0b":"#4b5563"}}>{(idea.votes || []).length}</p>
                </div>
                {/* Content */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:`${tc.color}15`,color:tc.color,fontWeight:600}}>{tc.icon} {tc.label}</span>
                    <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:`${sc.color}15`,color:sc.color,fontWeight:600}}>{sc.label}</span>
                    <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>{ago(idea.at)}</span>
                  </div>
                  <p style={{fontSize:12,color:"#e2e8f0",lineHeight:1.5}}>{idea.text}</p>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                    <span style={{fontSize:10,color:USERS[idea.by]?.color||"#4b5563",fontWeight:600}}>{idea.byLabel || idea.by}</span>
                    {/* Actions */}
                    <div style={{marginLeft:"auto",display:"flex",gap:4}}>
                      {Object.entries(statusConfig).map(([k, v]) => (
                        <button key={k} onClick={() => setStatus(idea.id, k)}
                          style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:idea.status===k?`${v.color}20`:"transparent",border:`1px solid ${idea.status===k?`${v.color}30`:"transparent"}`,color:idea.status===k?v.color:"#374151",cursor:"pointer",fontWeight:600}}>
                          {v.label}
                        </button>
                      ))}
                      <button onClick={() => deleteIdea(idea.id)} style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:"transparent",border:"none",color:"#374151",cursor:"pointer"}}>🗑</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      }
    </div>
  );
}

function ActivityLog({ data, projId, effectiveProjId, user, prospects, projOrders, P, accent }) {
  const [showGlobal, setShowGlobal] = useState(false);
  const [filterBy, setFilterBy] = useState("tous");

  const allActivity = (data?.activity||[]).slice().reverse();
  const projActivity = allActivity.filter(a=>a.proj===projId || a.proj===effectiveProjId);
  const displayActs = showGlobal ? allActivity : projActivity;
  const filtered = filterBy === "tous" ? displayActs
    : filterBy === "system" ? displayActs.filter(a=>a.by==="system")
    : displayActs.filter(a=>a.by===filterBy);

  const formatDate = ts => {
    if (!ts) return "–";
    const d = new Date(ts);
    return d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit"}) + " " + d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
  };
  const getIcon = a => {
    if (a.by==="system") {
      if (a.action?.includes("accepté")||a.action?.includes("ACCEPTÉ")) return "✅";
      if (a.action?.includes("ouvert")) return "👁";
      return "📬";
    }
    if (a.action?.includes("ajouté")) return "➕";
    if (a.action?.includes("supprimé")) return "🗑";
    if (a.action?.includes("devis")||a.action?.includes("commande")) return "📋";
    if (a.action?.includes("→")) return "🔄";
    if (a.action?.includes("modifié")) return "✏️";
    return "📌";
  };
  const getColor = a => {
    if (a.by==="system") return a.action?.includes("accepté")?"#22c55e":"#3b82f6";
    return USERS[a.by]?.color || "#6b7280";
  };

  return (
    <div className="fade">
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:12}}>
        {Object.entries(USERS).map(([uid,u])=>(
          <div key={uid} style={{background:"#0b0d16",border:`1px solid ${u.color}15`,borderRadius:10,padding:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:`linear-gradient(135deg,${u.color}70,${u.color})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white"}}>{u.avatar}</div>
              <p style={{fontSize:11,fontWeight:600,color:"#f1f5f9"}}>{u.label} {user===uid&&<span style={{fontSize:9,color:"#4b5563"}}>(vous)</span>}</p>
            </div>
            {[{l:"Assignés",v:prospects.filter(p=>p.assignedTo===uid).length,c:u.color},{l:"Modifiés",v:prospects.filter(p=>p.lastEditBy===uid).length,c:"#f1f5f9"},{l:"Actions",v:allActivity.filter(a=>a.by===uid).length,c:"#f59e0b"}].map(r=>(
              <div key={r.l} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:10,color:"#4b5563"}}>{r.l}</span>
                <span style={{fontSize:11,fontWeight:700,color:r.c}}>{r.v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>setShowGlobal(s=>!s)} className="btn"
          style={{padding:"4px 10px",borderRadius:5,fontSize:10,fontWeight:600,background:showGlobal?"#3b82f618":"#0b0d16",border:`1px solid ${showGlobal?"#3b82f628":"#1a2035"}`,color:showGlobal?"#60a5fa":"#4b5563",cursor:"pointer"}}>
          {showGlobal?"🌐 Global":"📂 "+P.label}
        </button>
        <span style={{fontSize:10,color:"#1a2035"}}>|</span>
        {[["tous","Tous"],["system","📬 Clients"],["anthony","Anthony"],["harold","Harold"],["jade","Jade"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilterBy(k)} className="btn"
            style={{padding:"3px 8px",borderRadius:4,fontSize:10,fontWeight:600,background:filterBy===k?`${k==="system"?"#22c55e":USERS[k]?.color||accent}18`:"transparent",border:`1px solid ${filterBy===k?`${k==="system"?"#22c55e":USERS[k]?.color||accent}28`:"transparent"}`,color:filterBy===k?(k==="system"?"#4ade80":USERS[k]?.color||accent):"#374151",cursor:"pointer"}}>
            {l}
          </button>
        ))}
        <span style={{fontSize:10,color:"#374151",marginLeft:"auto"}}>{filtered.length} événements</span>
      </div>

      <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:10,overflow:"hidden"}}>
        <div style={{padding:"9px 14px",borderBottom:"1px solid #0d1020",display:"flex",alignItems:"center",gap:7}}>
          <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>
          <p style={{fontSize:11,color:"#6b7280",fontWeight:600}}>Journal d'activité — {showGlobal?"Tous projets":P.label}</p>
        </div>
        {filtered.length===0
          ? <div style={{padding:"30px",textAlign:"center",color:"#2d3748"}}><p style={{fontSize:12}}>Aucune activité.</p></div>
          : filtered.map((a,i)=>{
            const isSys = a.by==="system";
            const icon = getIcon(a);
            const color = getColor(a);
            const projIcon = PROJECTS[a.proj]?.icon||"";
            return(
            <div key={a.id||i} style={{padding:"7px 14px",borderBottom:"1px solid #080a0f",display:"flex",alignItems:"center",gap:8,background:isSys?"#22c55e05":"transparent"}}
              onMouseEnter={e=>e.currentTarget.style.background=isSys?"#22c55e0a":"#0f1520"}
              onMouseLeave={e=>e.currentTarget.style.background=isSys?"#22c55e05":"transparent"}>
              <span style={{fontSize:12,width:20,textAlign:"center",flexShrink:0}}>{icon}</span>
              <div style={{width:18,height:18,borderRadius:"50%",background:isSys?"#22c55e":`linear-gradient(135deg,${color}70,${color})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"white",flexShrink:0}}>
                {isSys?"⚡":USERS[a.by]?.avatar||"?"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                  {showGlobal&&<span style={{fontSize:10}}>{projIcon}</span>}
                  <span style={{fontSize:11,color,fontWeight:600}}>{isSys?"Client":a.byLabel||a.by}</span>
                  <span style={{fontSize:11,color:"#4b5563"}}>·</span>
                  <span style={{fontSize:11,color:"#e2e8f0",fontWeight:500}}>{a.prospectName}</span>
                </div>
                <p style={{fontSize:11,color:isSys?"#86efac":"#6b7280",marginTop:1}}>{a.action}</p>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{fontSize:9,color:"#94a3b8"}}>{formatDate(a.at)}</p>
                <p style={{fontSize:9,color:"#6b7280"}}>{ago(a.at)}</p>
              </div>
            </div>
          );})}
      </div>
    </div>
  );
}

function QuoteTracking({ token }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("amigo_data").select("value").eq("key", `quote_${token}`).single();
        if (data?.value) setInfo(typeof data.value === "string" ? JSON.parse(data.value) : data.value);
      } catch(_) {}
    })();
  }, [token]);
  if (!info) return null;
  const views = info.views || [];
  const ago = ts => {
    const s = Math.floor((Date.now()-ts)/1000);
    if (s<60) return "à l'instant";
    if (s<3600) return `il y a ${Math.floor(s/60)}min`;
    if (s<86400) return `il y a ${Math.floor(s/3600)}h`;
    return `il y a ${Math.floor(s/86400)}j`;
  };
  return (
    <div style={{marginBottom:8,padding:"8px 10px",background:"#0b0d16",borderRadius:6,border:"1px solid #0f1520"}}>
      <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:info.status==="sent"?"#f59e0b":info.status==="viewed"?"#3b82f6":"#22c55e",fontWeight:700}}>
          {info.status==="sent"?"📤 Envoyé":info.status==="viewed"?"👁 Ouvert par le client":"✅ Accepté"}
        </span>
        {views.length>0 && <span style={{fontSize:10,color:"#4b5563"}}>{views.length} vue{views.length>1?"s":""} · dernière {ago(views[views.length-1].at)}</span>}
        {info.acceptedAt && <span style={{fontSize:10,color:"#4ade80",fontWeight:600}}>Accepté {ago(info.acceptedAt)}</span>}
      </div>
    </div>
  );
}

function QuoteEmailForm({ to, defaultSubject, defaultBody, projId, onSend, onSent }) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody]       = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");
  const [open, setOpen]       = useState(false);
  const senderEmail = PROJECT_EMAIL[projId] || null;

  const handleSend = async () => {
    setSending(true); setError("");
    const ok = await onSend({ to, subject, body, from: senderEmail });
    setSending(false);
    if (ok) { setSent(true); if (onSent) onSent(); }
    else setError(senderEmail
      ? `Échec envoi. L'alias "${senderEmail}" est-il configuré dans Gmail ?`
      : "Échec envoi. Vérifie ta connexion Gmail.");
  };

  if (sent) return (
    <div style={{background:"#22c55e10",border:"1px solid #22c55e25",borderRadius:8,padding:"12px 14px",marginBottom:14,textAlign:"center"}}>
      <p style={{fontSize:12,color:"#4ade80",fontWeight:600}}>✓ Devis envoyé à {to}</p>
      {senderEmail&&<p style={{fontSize:10,color:"#4b5563",marginTop:4}}>Envoyé depuis {senderEmail}</p>}
    </div>
  );

  if (!open) return (
    <div style={{marginBottom:14}}>
      <button onClick={()=>setOpen(true)}
        style={{width:"100%",padding:"9px",background:"#8b5cf615",border:"1px solid #8b5cf628",borderRadius:7,color:"#a78bfa",fontSize:12,fontWeight:600,cursor:"pointer"}}>
        ✉️ Envoyer le devis par email à {to}
      </button>
    </div>
  );

  return (
    <div style={{background:"#080a0f",border:"1px solid #8b5cf620",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
      <p style={{fontSize:10,color:"#4b5563",fontWeight:600,textTransform:"uppercase",marginBottom:8}}>✉️ Envoyer devis par email</p>
      <p style={{fontSize:11,color:"#6b7280",marginBottom:6}}>À : <strong style={{color:"#f1f5f9"}}>{to}</strong>{senderEmail&&<span> · depuis {senderEmail}</span>}</p>
      <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Objet"
        style={{width:"100%",padding:"6px 8px",borderRadius:6,fontSize:11,marginBottom:6,outline:"none",background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit"}}/>
      <textarea value={body} onChange={e=>setBody(e.target.value)} rows={8}
        style={{width:"100%",padding:"7px 8px",borderRadius:6,fontSize:11,resize:"vertical",outline:"none",background:"#0b0d16",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit",lineHeight:1.6}}/>
      {error&&<p style={{fontSize:10,color:"#ef4444",marginTop:4}}>{error}</p>}
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button onClick={handleSend} disabled={sending}
          style={{flex:1,padding:"8px",background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",border:"none",borderRadius:6,color:"white",fontSize:12,fontWeight:600,cursor:sending?"default":"pointer",opacity:sending?0.6:1}}>
          {sending?"Envoi…":"📩 Envoyer"}
        </button>
        <button onClick={()=>setOpen(false)}
          style={{padding:"8px 14px",background:"#0b0d16",border:"1px solid #1a2035",borderRadius:6,color:"#4b5563",fontSize:11,cursor:"pointer"}}>Annuler</button>
      </div>
    </div>
  );
}

// ── Page publique devis (accessible sans auth) ──────────────────────────────
function PublicQuotePage({ token }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase.from("amigo_data").select("value").eq("key", `quote_${token}`).single();
        if (err || !data) { setError("Orçamento não encontrado."); setLoading(false); return; }
        const q = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        setQuote(q);
        setAccepted(q.status === "accepted");
        // Ne pas tracker les aperçus internes
        const isPreview = window.location.href.includes("preview=1");
        if (!isPreview) {
          const view = { at: Date.now(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
          const views = [...(q.views || []), view];
          const updated = { ...q, views, status: q.status === "sent" ? "viewed" : q.status, viewedAt: q.viewedAt || Date.now() };
          await supabase.from("amigo_data").upsert({ key: `quote_${token}`, value: JSON.stringify(updated), updated_at: new Date().toISOString() });
          setQuote(updated);
        }
        // Notifier dans le CRM (ajouter à l'activité + notification email)
        if (!isPreview && q.status === "sent") {
          try {
            const main = await supabase.from("amigo_data").select("value").eq("key", "amigo-v9").single();
            if (main?.data?.value) {
              const d = typeof main.data.value === "string" ? JSON.parse(main.data.value) : main.data.value;
              d.activity = [...(d.activity || []).slice(-99), { id: Date.now(), by: "system", byLabel: "📬 Client", prospectName: q.prospectName, action: `a ouvert le devis ${q.product}`, at: Date.now(), proj: q.proj }];
              d.pendingEmails = [...(d.pendingEmails||[]), { id: Date.now(), type: "quote_viewed", prospectName: q.prospectName, product: q.product, proj: q.proj, at: Date.now() }];
              await supabase.from("amigo_data").upsert({ key: "amigo-v9", value: JSON.stringify(d), updated_at: new Date().toISOString() });
            }
          } catch(_) {}
        }
      } catch(e) { setError("Erro ao carregar."); }
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!quote || accepted) return;
    setAccepting(true);
    try {
      const updated = { ...quote, status: "accepted", acceptedAt: Date.now() };
      await supabase.from("amigo_data").upsert({ key: `quote_${token}`, value: JSON.stringify(updated), updated_at: new Date().toISOString() });
      // Mettre à jour le statut de la commande dans le CRM
      try {
        const main = await supabase.from("amigo_data").select("value").eq("key", "amigo-v9").single();
        if (main?.data?.value) {
          const d = typeof main.data.value === "string" ? JSON.parse(main.data.value) : main.data.value;
          d.orders = (d.orders || []).map(o => o.id === quote.orderId ? { ...o, status: "Accepté" } : o);
          d.activity = [...(d.activity || []).slice(-99), { id: Date.now(), by: "system", byLabel: "✅ Client", prospectName: quote.prospectName, action: `a ACCEPTÉ le devis ${quote.product}`, at: Date.now(), proj: quote.proj }];
          d.pendingEmails = [...(d.pendingEmails||[]), { id: Date.now(), type: "quote_accepted", prospectName: quote.prospectName, product: quote.product, amount: quote.amount*(quote.qty||1), proj: quote.proj, at: Date.now() }];
          await supabase.from("amigo_data").upsert({ key: "amigo-v9", value: JSON.stringify(d), updated_at: new Date().toISOString() });
        }
      } catch(_) {}
      setQuote(updated);
      setAccepted(true);
    } catch(e) { console.error(e); }
    setAccepting(false);
  };

  const total = quote ? quote.amount * (quote.qty || 1) : 0;
  const has5050 = (quote?.payTerms||"").includes("50%");
  const pixAmount = has5050 ? total * 0.5 : total;
  const pixStr = accepted && pixAmount > 0 ? pixPayload(pixAmount, (quote.orderId || "AMIGO").slice(0, 25)) : "";
  const pixQrUrl = pixStr ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixStr)}` : "";
  const validUntil = quote?.validUntil;
  const isExpired = validUntil && new Date(validUntil) < new Date();

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8f9fa",fontFamily:"Inter,system-ui,sans-serif"}}>
      <p style={{fontSize:16,color:"#6b7280"}}>Carregando orçamento...</p>
    </div>
  );

  if (error) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8f9fa",fontFamily:"Inter,system-ui,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <p style={{fontSize:48,marginBottom:12}}>📋</p>
        <p style={{fontSize:16,color:"#ef4444"}}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f8f9fa",fontFamily:"Inter,system-ui,sans-serif",padding:"20px"}}>
      <div style={{maxWidth:600,margin:"0 auto",background:"white",borderRadius:16,boxShadow:"0 4px 24px rgba(0,0,0,.08)",overflow:"hidden"}}>
        {/* En-tête entreprise */}
        <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",padding:"28px 32px",color:"white"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <h1 style={{fontSize:22,fontWeight:700,margin:0}}>{EMPRESA.nome}</h1>
              <p style={{fontSize:12,color:"#94a3b8",marginTop:4}}>Labo 3D · Impressão sob medida</p>
              <p style={{fontSize:11,color:"#64748b",marginTop:2}}>CNPJ: {EMPRESA.cnpj} · {EMPRESA.email}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:11,color:"#94a3b8"}}>ORÇAMENTO</p>
              <p style={{fontSize:14,fontWeight:700,color:"#38bdf8",fontFamily:"monospace"}}>#{quote.orderId?.toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div style={{padding:"28px 32px"}}>
          {/* Infos client */}
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:24,padding:"16px",background:"#f1f5f9",borderRadius:10}}>
            <div>
              <p style={{fontSize:10,color:"#64748b",textTransform:"uppercase",fontWeight:600,marginBottom:4}}>Cliente</p>
              <p style={{fontSize:15,fontWeight:600,color:"#0f172a"}}>{quote.prospectName}</p>
              {quote.prospectCnpj && <p style={{fontSize:11,color:"#64748b"}}>CNPJ: {quote.prospectCnpj}</p>}
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:10,color:"#64748b",textTransform:"uppercase",fontWeight:600,marginBottom:4}}>Data</p>
              <p style={{fontSize:13,color:"#0f172a"}}>{quote.date}</p>
              {validUntil && <p style={{fontSize:11,color:isExpired?"#ef4444":"#64748b"}}>Válido até: {validUntil}</p>}
            </div>
          </div>

          {/* Tableau des items */}
          <table style={{width:"100%",borderCollapse:"collapse",marginBottom:20}}>
            <thead>
              <tr style={{borderBottom:"2px solid #e2e8f0"}}>
                <th style={{textAlign:"left",padding:"10px 8px",fontSize:11,color:"#64748b",fontWeight:600,textTransform:"uppercase"}}>Descrição</th>
                <th style={{textAlign:"center",padding:"10px 8px",fontSize:11,color:"#64748b",fontWeight:600}}>Qtd</th>
                <th style={{textAlign:"right",padding:"10px 8px",fontSize:11,color:"#64748b",fontWeight:600}}>Valor unit.</th>
                <th style={{textAlign:"right",padding:"10px 8px",fontSize:11,color:"#64748b",fontWeight:600}}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{borderBottom:"1px solid #f1f5f9"}}>
                <td style={{padding:"12px 8px",fontSize:14,color:"#0f172a",fontWeight:500}}>{quote.product}</td>
                <td style={{padding:"12px 8px",fontSize:14,color:"#0f172a",textAlign:"center"}}>{quote.qty || 1}</td>
                <td style={{padding:"12px 8px",fontSize:14,color:"#0f172a",textAlign:"right"}}>R${quote.amount?.toFixed(2)}</td>
                <td style={{padding:"12px 8px",fontSize:16,color:"#0f172a",fontWeight:700,textAlign:"right"}}>R${total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {/* Total */}
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:24}}>
            <div style={{background:"#0f172a",borderRadius:10,padding:"14px 24px",textAlign:"right"}}>
              <p style={{fontSize:11,color:"#94a3b8",marginBottom:2}}>TOTAL</p>
              <p style={{fontSize:24,fontWeight:700,color:"#4ade80",margin:0}}>R$ {total.toFixed(2)}</p>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"12px 16px",marginBottom:20}}>
              <p style={{fontSize:10,color:"#92400e",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Observações</p>
              <p style={{fontSize:12,color:"#78350f",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{quote.notes}</p>
            </div>
          )}

          {/* Conditions de paiement */}
          {quote.payTerms && (
            <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"12px 16px",marginBottom:20}}>
              <p style={{fontSize:10,color:"#1e40af",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Condições de pagamento</p>
              <p style={{fontSize:13,color:"#1e3a5f",fontWeight:500}}>{quote.payTerms}</p>
            </div>
          )}

          {/* Statut */}
          {isExpired && !accepted && (
            <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"16px",textAlign:"center",marginBottom:20}}>
              <p style={{fontSize:14,color:"#dc2626",fontWeight:600}}>⏰ Este orçamento expirou</p>
              <p style={{fontSize:12,color:"#7f1d1d",marginTop:4}}>Entre em contato para solicitar um novo orçamento.</p>
            </div>
          )}

          {accepted && (
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"16px",textAlign:"center",marginBottom:20}}>
              <p style={{fontSize:18,fontWeight:700,color:"#16a34a"}}>✅ Orçamento aceito!</p>
              <p style={{fontSize:12,color:"#166534",marginTop:4}}>Obrigado pela confiança. Entraremos em contato em breve.</p>
            </div>
          )}

          {/* Bouton accepter */}
          {!accepted && !isExpired && (
            <button onClick={handleAccept} disabled={accepting}
              style={{width:"100%",padding:"16px",background:"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:10,color:"white",fontSize:16,fontWeight:700,cursor:accepting?"default":"pointer",opacity:accepting?0.7:1,marginBottom:20,boxShadow:"0 4px 12px rgba(34,197,94,.3)"}}>
              {accepting ? "Processando..." : "✅ Aceitar orçamento"}
            </button>
          )}

          {/* PIX après acceptation */}
          {accepted && pixQrUrl && (
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"24px",textAlign:"center",marginBottom:20}}>
              <p style={{fontSize:14,fontWeight:700,color:"#16a34a",marginBottom:12}}>Pagamento via PIX{has5050?" — 1ª parcela":""}</p>
              <img src={pixQrUrl} alt="QR PIX" style={{width:200,height:200,borderRadius:8,border:"4px solid white",boxShadow:"0 2px 8px rgba(0,0,0,.1)"}}/>
              <p style={{fontSize:12,color:"#166534",marginTop:10}}>Chave PIX (CNPJ): <strong>{EMPRESA.cnpj}</strong></p>
              <p style={{fontSize:22,fontWeight:700,color:"#16a34a",marginTop:6}}>R$ {pixAmount.toFixed(2)}</p>
              {has5050&&<p style={{fontSize:12,color:"#166534",marginTop:4}}>50% agora · 50% na entrega (R${(total*0.5).toFixed(2)} + R${(total*0.5).toFixed(2)})</p>}
              {has5050&&<p style={{fontSize:11,color:"#64748b",marginTop:2}}>Total do orçamento: R${total.toFixed(2)}</p>}
              <button onClick={()=>navigator.clipboard.writeText(pixStr)}
                style={{marginTop:12,padding:"8px 20px",background:"#16a34a",border:"none",borderRadius:6,color:"white",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                📋 Copiar código PIX
              </button>
            </div>
          )}

          {/* Footer */}
          <div style={{borderTop:"1px solid #e2e8f0",paddingTop:16,textAlign:"center"}}>
            <p style={{fontSize:11,color:"#94a3b8"}}>{EMPRESA.nome} · CNPJ {EMPRESA.cnpj} · {EMPRESA.cidade}</p>
            <p style={{fontSize:11,color:"#94a3b8"}}>{EMPRESA.tel} · {EMPRESA.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page publique devis GROUPÉ ───────────────────────────────────────────────
function PublicGroupQuotePage({ token }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acceptedItems, setAcceptedItems] = useState([]);
  const [accepting, setAccepting] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase.from("amigo_data").select("value").eq("key", `gquote_${token}`).single();
        if (err || !data) { setError("Orçamentos não encontrados."); setLoading(false); return; }
        const q = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        setQuote(q);
        setAcceptedItems(q.acceptedItems || []);
        // Tracker la vue
        const isPreview = window.location.href.includes("preview=1");
        if (!isPreview) {
          const view = { at: Date.now(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
          const updated = { ...q, views: [...(q.views||[]), view], status: q.status === "sent" ? "viewed" : q.status, viewedAt: q.viewedAt || Date.now() };
          await supabase.from("amigo_data").upsert({ key: `gquote_${token}`, value: JSON.stringify(updated), updated_at: new Date().toISOString() });
          setQuote(updated);
          if (q.status === "sent") {
            try {
              const main = await supabase.from("amigo_data").select("value").eq("key", "amigo-v9").single();
              if (main?.data?.value) {
                const d = typeof main.data.value === "string" ? JSON.parse(main.data.value) : main.data.value;
                d.activity = [...(d.activity||[]).slice(-99), { id: Date.now(), by: "system", byLabel: "📬 Client", prospectName: q.prospectName, action: `a ouvert les ${q.items?.length||0} devis`, at: Date.now(), proj: "print3d" }];
                d.pendingEmails = [...(d.pendingEmails||[]), { id: Date.now(), type: "quote_viewed", prospectName: q.prospectName, product: `${q.items?.length||0} devis`, proj: "print3d", at: Date.now() }];
                await supabase.from("amigo_data").upsert({ key: "amigo-v9", value: JSON.stringify(d), updated_at: new Date().toISOString() });
              }
            } catch(_) {}
          }
        }
      } catch(e) { setError("Erro ao carregar."); }
      setLoading(false);
    })();
  }, [token]);

  const handleAcceptItem = async (orderId) => {
    if (!quote || acceptedItems.includes(orderId)) return;
    setAccepting(orderId);
    try {
      const newAccepted = [...acceptedItems, orderId];
      const allAccepted = newAccepted.length === (quote.items||[]).length;
      const updated = { ...quote, acceptedItems: newAccepted, status: allAccepted ? "accepted" : "partial", [`accepted_${orderId}_at`]: Date.now() };
      await supabase.from("amigo_data").upsert({ key: `gquote_${token}`, value: JSON.stringify(updated), updated_at: new Date().toISOString() });
      // Mettre à jour le statut dans le CRM
      try {
        const main = await supabase.from("amigo_data").select("value").eq("key", "amigo-v9").single();
        if (main?.data?.value) {
          const d = typeof main.data.value === "string" ? JSON.parse(main.data.value) : main.data.value;
          const item = (quote.items||[]).find(i => i.orderId === orderId);
          d.orders = (d.orders||[]).map(o => o.id === orderId ? { ...o, status: "Accepté" } : o);
          d.activity = [...(d.activity||[]).slice(-99), { id: Date.now(), by: "system", byLabel: "✅ Client", prospectName: quote.prospectName, action: `a accepté le devis "${item?.product||"?"}"${allAccepted?" — TOUS acceptés":""}`, at: Date.now(), proj: "print3d" }];
          d.pendingEmails = [...(d.pendingEmails||[]), { id: Date.now(), type: allAccepted?"all_accepted":"quote_accepted", prospectName: quote.prospectName, product: item?.product||"?", amount: item?item.amount*(item.qty||1):0, proj: "print3d", at: Date.now() }];
          await supabase.from("amigo_data").upsert({ key: "amigo-v9", value: JSON.stringify(d), updated_at: new Date().toISOString() });
        }
      } catch(_) {}
      setAcceptedItems(newAccepted);
      setQuote(updated);
    } catch(e) { console.error(e); }
    setAccepting(null);
  };

  if (loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8f9fa",fontFamily:"Inter,system-ui,sans-serif"}}><p style={{fontSize:16,color:"#6b7280"}}>Carregando orçamentos...</p></div>;
  if (error) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8f9fa",fontFamily:"Inter,system-ui,sans-serif"}}><p style={{fontSize:16,color:"#ef4444"}}>{error}</p></div>;

  const items = quote.items || [];
  const grandTotal = items.reduce((s, i) => s + i.amount * (i.qty || 1), 0);
  const acceptedTotal = items.filter(i => acceptedItems.includes(i.orderId)).reduce((s, i) => s + i.amount * (i.qty || 1), 0);
  const allAccepted = acceptedItems.length === items.length;
  const validUntil = quote.validUntil;
  const isExpired = validUntil && new Date(validUntil) < new Date();
  const gHas5050 = (quote?.payTerms||"").includes("50%");
  const gPixAmount = gHas5050 ? grandTotal * 0.5 : grandTotal;
  const pixStr = allAccepted && gPixAmount > 0 ? pixPayload(gPixAmount, token.slice(0, 25)) : "";
  const pixQrUrl = pixStr ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixStr)}` : "";

  return (
    <div style={{minHeight:"100vh",background:"#f8f9fa",fontFamily:"Inter,system-ui,sans-serif",padding:"20px"}}>
      <div style={{maxWidth:650,margin:"0 auto",background:"white",borderRadius:16,boxShadow:"0 4px 24px rgba(0,0,0,.08)",overflow:"hidden"}}>
        <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",padding:"28px 32px",color:"white"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <h1 style={{fontSize:22,fontWeight:700,margin:0}}>{EMPRESA.nome}</h1>
              <p style={{fontSize:12,color:"#94a3b8",marginTop:4}}>Labo 3D · Impressão sob medida</p>
              <p style={{fontSize:11,color:"#64748b",marginTop:2}}>CNPJ: {EMPRESA.cnpj} · {EMPRESA.email}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:11,color:"#94a3b8"}}>ORÇAMENTOS</p>
              <p style={{fontSize:13,fontWeight:600,color:"#38bdf8"}}>{items.length} ite{items.length>1?"ns":"m"}</p>
            </div>
          </div>
        </div>

        <div style={{padding:"28px 32px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:20,padding:"14px 16px",background:"#f1f5f9",borderRadius:10}}>
            <div>
              <p style={{fontSize:10,color:"#64748b",textTransform:"uppercase",fontWeight:600,marginBottom:4}}>Cliente</p>
              <p style={{fontSize:15,fontWeight:600,color:"#0f172a"}}>{quote.prospectName}</p>
              {quote.prospectCnpj && <p style={{fontSize:11,color:"#64748b"}}>CNPJ: {quote.prospectCnpj}</p>}
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:10,color:"#64748b",textTransform:"uppercase",fontWeight:600,marginBottom:4}}>Data</p>
              <p style={{fontSize:13,color:"#0f172a"}}>{quote.date}</p>
              {validUntil && <p style={{fontSize:11,color:isExpired?"#ef4444":"#64748b"}}>Válido até: {validUntil}</p>}
            </div>
          </div>

          {/* Liste des items */}
          {items.map((item, idx) => {
            const total = item.amount * (item.qty || 1);
            const isAccepted = acceptedItems.includes(item.orderId);
            return (
              <div key={item.orderId} style={{border:`1px solid ${isAccepted?"#bbf7d0":"#e2e8f0"}`,borderRadius:10,padding:"16px",marginBottom:12,background:isAccepted?"#f0fdf4":"white",transition:"all .2s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <p style={{fontSize:10,color:"#64748b",fontWeight:600}}>ITEM {idx+1}</p>
                    <p style={{fontSize:15,fontWeight:600,color:"#0f172a"}}>{item.product}</p>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <p style={{fontSize:18,fontWeight:700,color:isAccepted?"#16a34a":"#0f172a"}}>R$ {total.toFixed(2)}</p>
                    <p style={{fontSize:11,color:"#64748b"}}>{item.qty||1}x · R${item.amount?.toFixed(2)}/un.</p>
                  </div>
                </div>
                {item.notes && <p style={{fontSize:11,color:"#64748b",lineHeight:1.5,marginBottom:8,whiteSpace:"pre-wrap"}}>{item.notes}</p>}
                {isAccepted
                  ? <p style={{fontSize:13,color:"#16a34a",fontWeight:600,textAlign:"center"}}>✅ Aceito</p>
                  : !isExpired && (
                    <button onClick={()=>handleAcceptItem(item.orderId)} disabled={accepting===item.orderId}
                      style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#16a34a,#22c55e)",border:"none",borderRadius:8,color:"white",fontSize:13,fontWeight:600,cursor:accepting===item.orderId?"default":"pointer",opacity:accepting===item.orderId?0.7:1}}>
                      {accepting===item.orderId ? "Processando..." : "✅ Aceitar este item"}
                    </button>
                  )
                }
              </div>
            );
          })}

          {/* Total */}
          <div style={{display:"flex",justifyContent:"flex-end",gap:16,marginBottom:20}}>
            {acceptedItems.length > 0 && acceptedItems.length < items.length && (
              <div style={{background:"#eff6ff",borderRadius:10,padding:"12px 20px",textAlign:"right"}}>
                <p style={{fontSize:10,color:"#3b82f6"}}>ACEITO</p>
                <p style={{fontSize:18,fontWeight:700,color:"#3b82f6"}}>R$ {acceptedTotal.toFixed(2)}</p>
              </div>
            )}
            <div style={{background:"#0f172a",borderRadius:10,padding:"12px 20px",textAlign:"right"}}>
              <p style={{fontSize:10,color:"#94a3b8"}}>TOTAL</p>
              <p style={{fontSize:22,fontWeight:700,color:"#4ade80"}}>R$ {grandTotal.toFixed(2)}</p>
            </div>
          </div>

          {/* Conditions de paiement */}
          {quote.payTerms && (
            <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"12px 16px",marginBottom:20}}>
              <p style={{fontSize:10,color:"#1e40af",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>Condições de pagamento</p>
              <p style={{fontSize:13,color:"#1e3a5f",fontWeight:500}}>{quote.payTerms}</p>
            </div>
          )}

          {isExpired && !allAccepted && (
            <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"16px",textAlign:"center",marginBottom:20}}>
              <p style={{fontSize:14,color:"#dc2626",fontWeight:600}}>⏰ Estes orçamentos expiraram</p>
            </div>
          )}

          {allAccepted && (
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"16px",textAlign:"center",marginBottom:20}}>
              <p style={{fontSize:18,fontWeight:700,color:"#16a34a"}}>✅ Todos os orçamentos aceitos!</p>
              <p style={{fontSize:12,color:"#166534",marginTop:4}}>Obrigado pela confiança.</p>
            </div>
          )}

          {/* PIX après tout accepté */}
          {allAccepted && pixQrUrl && (
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"24px",textAlign:"center",marginBottom:20}}>
              <p style={{fontSize:14,fontWeight:700,color:"#16a34a",marginBottom:12}}>Pagamento via PIX{gHas5050?" — 1ª parcela":""}</p>
              <img src={pixQrUrl} alt="QR PIX" style={{width:200,height:200,borderRadius:8,border:"4px solid white",boxShadow:"0 2px 8px rgba(0,0,0,.1)"}}/>
              <p style={{fontSize:12,color:"#166534",marginTop:10}}>Chave PIX (CNPJ): <strong>{EMPRESA.cnpj}</strong></p>
              <p style={{fontSize:22,fontWeight:700,color:"#16a34a",marginTop:6}}>R$ {gPixAmount.toFixed(2)}</p>
              {gHas5050&&<p style={{fontSize:12,color:"#166534",marginTop:4}}>50% agora · 50% na entrega (R${(grandTotal*0.5).toFixed(2)} + R${(grandTotal*0.5).toFixed(2)})</p>}
              {gHas5050&&<p style={{fontSize:11,color:"#64748b",marginTop:2}}>Total: R${grandTotal.toFixed(2)}</p>}
              <button onClick={()=>navigator.clipboard.writeText(pixStr)} style={{marginTop:12,padding:"8px 20px",background:"#16a34a",border:"none",borderRadius:6,color:"white",fontSize:12,fontWeight:600,cursor:"pointer"}}>📋 Copiar código PIX</button>
            </div>
          )}

          <div style={{borderTop:"1px solid #e2e8f0",paddingTop:16,textAlign:"center"}}>
            <p style={{fontSize:11,color:"#94a3b8"}}>{EMPRESA.nome} · CNPJ {EMPRESA.cnpj} · {EMPRESA.cidade}</p>
            <p style={{fontSize:11,color:"#94a3b8"}}>{EMPRESA.tel} · {EMPRESA.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AmigoCRM() {
  // Routes publiques devis — pas besoin d'auth
  const hashMatch = window.location.hash.match(/^#\/quote\/([^?]+)/);
  if (hashMatch) return <PublicQuotePage token={hashMatch[1]} />;
  const groupMatch = window.location.hash.match(/^#\/quotes\/([^?]+)/);
  if (groupMatch) return <PublicGroupQuotePage token={groupMatch[1]} />;

  const [authUser, setAuthUser] = useState(null); // session Google
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError]   = useState("");
  const [user,    setUser]    = useState(null);
  const [projId,  setProjIdRaw]  = useState(()=>localStorage.getItem("amigo-proj")||"makeup");
  const setProjId = useCallback((v) => { setProjIdRaw(v); localStorage.setItem("amigo-proj", v); }, []);
  const [vinSubType, setVinSubType] = useState("vin");
  const [vinFilter, setVinFilter] = useState("tous"); // "tous" | "fournisseurs" | "clients"
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSync,setLastSync]= useState(null);
  const [notif,   setNotif]   = useState(null);
  const [view,    setViewRaw]    = useState(()=>localStorage.getItem("amigo-view")||"dashboard");
  const [theme,   setTheme]   = useState(()=>localStorage.getItem("amigo-theme")||"dark");

  const THEMES = {
    dark:  { label:"🌑 Dark",  filter:"none" },
    dim:   { label:"🌓 Dim",   filter:"brightness(1.15) contrast(0.92)" },
    warm:  { label:"🌅 Warm",  filter:"sepia(0.25) brightness(1.08) contrast(0.95)" },
    light: { label:"☀️ Light", filter:"invert(1) hue-rotate(180deg)" },
  };

  const switchTheme = (t) => { setTheme(t); localStorage.setItem("amigo-theme",t); };

  // Navigation avec historique navigateur (bouton retour)
  const setView = useCallback((v) => {
    setViewRaw(v);
    localStorage.setItem("amigo-view", v);
    try { window.history.pushState({ view: v, proj: projId }, ""); } catch(_) {}
  }, [projId]);

  useEffect(() => {
    const onPop = (e) => {
      if (e.state?.view) {
        setViewRaw(e.state.view);
        localStorage.setItem("amigo-view", e.state.view);
        if (e.state.proj) { setProjIdRaw(e.state.proj); localStorage.setItem("amigo-proj", e.state.proj); }
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const [showAddProspect, setShowAddProspect] = useState(false);
  const [showAddOrder,    setShowAddOrder]    = useState(undefined);
  const [showCalculateur, setShowCalculateur] = useState(false);
  const [detailOrder,     setDetailOrder]     = useState(null);
  const [sortMode,        setSortMode]        = useState(()=>localStorage.getItem("amigo-sort")||"alpha");
  const [detailProspect,  setDetailProspect]  = useState(null);
  const [showAddEvent,    setShowAddEvent]    = useState(null);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [searchOpen,      setSearchOpen]      = useState(false);

  const KEY = "amigo-v9";
  const pollRef  = useRef(null);
  const savingRef = useRef(false);
  const prevLen  = useRef(0);

  // ── Auth Google ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user || null);
      if (session?.user) setUser(emailToUser(session.user.email));
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      if (u && !ALLOWED_EMAILS.includes(u.email?.toLowerCase())) {
        supabase.auth.signOut();
        setAuthError("Accès non autorisé. Contacte Anthony.");
        return;
      }
      setAuthUser(u);
      if (u) setUser(emailToUser(u.email));
      else setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setUser(null);
  };

  const importSeedData = async () => {
    if (!data) return;
    const existMakeup = new Set((data.makeup||[]).map(p=>p.name.toLowerCase().trim()));
    const exist3d     = new Set((data.print3d||[]).map(p=>p.name.toLowerCase().trim()));
    const newMakeup = SEED_MAKEUP.filter(e=>!existMakeup.has(e.name.toLowerCase().trim()));
    const new3d     = SEED_3D.filter(e=>!exist3d.has(e.name.toLowerCase().trim()));
    if (newMakeup.length===0 && new3d.length===0) { alert("Toutes les données sont déjà importées !"); return; }
    const nd = {...data, makeup:[...(data.makeup||[]),...newMakeup], print3d:[...(data.print3d||[]),...new3d]};
    await save(nd);
    alert(`✅ ${newMakeup.length} école(s) maquillage + ${new3d.length} client(s) 3D ajouté(s) !`);
  };

  // ── Google API helpers ────────────────────────────────────────────────────
  const getGToken = async () => {
    let { data } = await supabase.auth.getSession();
    if (data?.session?.provider_token) return data.session.provider_token;
    // Token expiré — tenter un refresh
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (!error && refreshed?.session?.provider_token) return refreshed.session.provider_token;
    // Pas de redirect automatique — retourner null, l'utilisateur devra se reconnecter manuellement
    return null;
  };

  const [calEvents,    setCalEvents]    = useState([]);
  const [calLoading,   setCalLoading]   = useState(false);
  const [calMonth,     setCalMonth]     = useState(new Date().getMonth());
  const [calYear,      setCalYear]      = useState(new Date().getFullYear());
  const [showEmailModal, setShowEmailModal] = useState(null);
  const [eurBrl,       setEurBrl]       = useState(null);
  const [heureFrance,  setHeureFrance]  = useState("");

  // Widget heure France (UTC+1 hiver, UTC+2 été)
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const fr = new Intl.DateTimeFormat("fr-FR", { timeZone:"Europe/Paris", hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(now);
      setHeureFrance(fr);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Widget taux EUR/BRL — API gratuite
  useEffect(() => {
    fetch("https://api.exchangerate-api.com/v4/latest/EUR")
      .then(r=>r.json())
      .then(d=>setEurBrl(d?.rates?.BRL?.toFixed(2)||null))
      .catch(()=>{});
    // Rafraîchir toutes les heures
    const t = setInterval(()=>{
      fetch("https://api.exchangerate-api.com/v4/latest/EUR")
        .then(r=>r.json())
        .then(d=>setEurBrl(d?.rates?.BRL?.toFixed(2)||null))
        .catch(()=>{});
    }, 3600000);
    return () => clearInterval(t);
  }, []);

  const loadCalendar = async (month, year) => {
    setCalLoading(true);
    try {
      const token = await getGToken();
      if (!token) { setCalLoading(false); return; }
      const start = new Date(year, month, 1).toISOString();
      const end   = new Date(year, month+1, 0, 23, 59).toISOString();
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime&maxResults=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = await res.json();
      setCalEvents(d.items || []);
    } catch(e) { console.error(e); }
    setCalLoading(false);
  };

  const createCalEvent = async (ev) => {
    try {
      const token = await getGToken();
      if (!token) return;
      const body = {
        summary: ev.title,
        description: ev.note || "",
        start: ev.time ? { dateTime: `${ev.date}T${ev.time}:00`, timeZone: "America/Sao_Paulo" } : { date: ev.date },
        end:   ev.time ? { dateTime: `${ev.date}T${ev.time}:00`, timeZone: "America/Sao_Paulo" } : { date: ev.date },
        visibility: "public",
      };
      await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadCalendar(calMonth, calYear);
    } catch(e) { console.error(e); }
  };

  const sendGmail = async ({ to, subject, body, from }) => {
    try {
      const token = await getGToken();
      if (!token) return false;
      const toB64 = str => {
        const bytes = new TextEncoder().encode(str);
        let bin = "";
        bytes.forEach(b => bin += String.fromCharCode(b));
        return btoa(bin);
      };
      const senderEmail = from || PROJECT_EMAIL[projId] || null;
      const headers = [];
      if (senderEmail) headers.push(`From: ${senderEmail}`);
      headers.push(`To: ${to}`);
      headers.push(`Subject: =?UTF-8?B?${toB64(subject)}?=`);
      headers.push("MIME-Version: 1.0");
      headers.push("Content-Type: text/plain; charset=UTF-8");
      headers.push("Content-Transfer-Encoding: base64");
      headers.push("");
      headers.push(toB64(body));
      const raw = headers.join("\r\n");
      const encoded = toB64(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: encoded }),
      });
      return res.ok;
    } catch(e) { console.error(e); return false; }
  };

  // ── Gmail scan (règles fixes, pas d'IA) ───────────────────────────────────
  const [gmailThreads, setGmailThreads] = useState([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const scanningRef = useRef(false);

  const matchEmailToProspect = (from, to, subject, snippet, allProspects) => {
    const haystack = `${from} ${to} ${subject} ${snippet}`.toLowerCase();
    // 1. Match par email exact — le plus fiable
    for (const p of allProspects) {
      if (p.email) {
        const em = p.email.toLowerCase();
        const domain = em.split("@")[1];
        const GENERIC = ["gmail.com","hotmail.com","yahoo.com","outlook.com","orange.fr","wanadoo.fr","free.fr","sfr.fr","laposte.net"];
        if (GENERIC.includes(domain)) {
          if (haystack.includes(em)) return p;
        } else if (domain && haystack.includes(domain)) {
          return p;
        }
      }
    }
    // 2. Match par nom d'entreprise / producteur (>5 chars)
    for (const p of allProspects) {
      const names = [p.name, p.producteur].filter(Boolean).map(n=>n.toLowerCase().trim());
      for (const n of names) {
        if (n.length > 5 && haystack.includes(n)) return p;
      }
    }
    // 3. Match par contact / appellation / cépage (mails transférés — dans le snippet)
    for (const p of allProspects) {
      const terms = [p.contact, p.appellation, p.cepage].filter(Boolean).map(n=>n.toLowerCase().trim());
      for (const t of terms) {
        if (t.length > 5 && haystack.includes(t)) return p;
      }
    }
    // 4. Match par téléphone (format +33, +55, etc.)
    for (const p of allProspects) {
      if (p.phone) {
        const tel = p.phone.replace(/\s/g,"");
        if (tel.length > 8 && haystack.includes(tel)) return p;
      }
    }
    return null;
  };

  const matchEmailToProj = (from, to, subject, snippet) => {
    const h = `${from} ${to} ${subject} ${snippet}`.toLowerCase();
    if (["carnaval","gall","maquillage","makeup","école","ecole","formation","beauté","beaute","cosmétique","cosmetique"].some(k=>h.includes(k))) return "makeup";
    if ([
      // Générique vin
      "vin","wine","vinho","vins","winery","vignoble","vigneron","viticulteur","viticulture",
      // Production
      "domaine","château","chateau","cave","cuvée","cuvee","millésime","millesime","vendange","récolte","recolte","cépage","cepage","terroir","appellation",
      // Régions
      "bordeaux","bourgogne","champagne","alsace","loire","rhône","rhone","languedoc","provence","beaujolais","côtes","cotes","saint-émilion","pomerol","médoc","medoc","pessac","sauternes","vouvray","touraine","chinon","muscadet",
      // Labels
      "aoc","igp","bio","biodynamie","biodynamique","nature","naturel","sans soufre","soufre","agriculture biologique","certifié","certifie","ecocert","ab label",
      // Commerce
      "bodega","import","importation","exportation","négociant","negociant","grossiste","commande","bouteille","caisse","palette","conteneur","fob","cif","incoterm","expédition","expedition","livraison","tarif","devis","prix","facture",
      // Cérémonies
      "dégustation","degustation","salon","vinexpo","prowein",
    ].some(k=>h.includes(k))) return "vin";
    if (["3d","impression","print","architecture","maquette","prototype","filament","résine","resine","fraisage","usinage"].some(k=>h.includes(k))) return "print3d";
    return null;
  };

  const [gmailFilter, setGmailFilter] = useState("projets"); // "projets" | "tous"
  const [expandedGlobalEmail, setExpandedGlobalEmail] = useState(null);

  const scanGmail = async (filter) => {
    const f = filter || gmailFilter;
    setGmailLoading(true);
    scanningRef.current = true;
    try {
      const token = await getGToken();
      if (!token) { setGmailLoading(false);scanningRef.current=false; return; }
      const allProspects = [...(data?.makeup||[]), ...(data?.vin||[]), ...(data?.print3d||[])];

      let query;
      if (f === "tous") {
        query = "in:anywhere";
      } else {
        // Domaines des prospects — chercher dans headers ET body (pour les forwards)
        const domainSet = new Set(allProspects
          .map(p => p.email?.split("@")[1]?.toLowerCase())
          .filter(Boolean)
          .filter(d => !["gmail.com","hotmail.com","yahoo.com","outlook.com","orange.fr","free.fr","sfr.fr","laposte.net","wanadoo.fr"].includes(d)));
        const domainTerms = [...domainSet].map(d => `"${d}"`); // Cherche partout (body inclus)
        // Noms des prospects/producteurs pour matcher les mails transférés
        const prospectNames = allProspects
          .flatMap(p => [p.name, p.producteur, p.contact].filter(Boolean))
          .filter(n => n.length > 5)
          .slice(0, 30)
          .map(n => `"${n}"`);
        // Emails complets des prospects
        const emails = allProspects
          .map(p => p.email?.toLowerCase())
          .filter(Boolean)
          .slice(0, 20)
          .map(e => `"${e}"`);
        const keywords = [
          "carnaval","gall","maquillage","formation",
          "vin","wine","domaine","château","chateau","bodega","import","importation","conditions",
          "impression 3d","print 3d","maquette","prototype","filament"
        ].map(k=>`"${k}"`);
        // Limiter la taille totale de la query (Gmail max ~1500 chars)
        const allTerms = [...domainTerms, ...emails, ...prospectNames, ...keywords];
        const maxLen = 1400;
        let q = "";
        for (const t of allTerms) {
          const next = q ? q + " OR " + t : t;
          if (next.length > maxLen) break;
          q = next;
        }
        query = q || "in:anywhere";
      }

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=200&q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = await res.json();
      if (!d.messages) { setGmailLoading(false);scanningRef.current=false; return; }

      const threads = await Promise.all(
        d.messages.map(async m => {
          // D'abord récupérer en format full pour avoir le snippet + body
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const msg = await r.json();
          const headers = msg.payload?.headers||[];
          const get = name => headers.find(h=>h.name.toLowerCase()===name.toLowerCase())?.value||"";
          const from = get("From"), to = get("To"), cc = get("Cc"), replyTo = get("Reply-To"), subject = get("Subject"), date = get("Date");
          const snippet = decodeSnippet(msg.snippet);
          // Extraire le body texte pour le matching (mails transférés)
          let bodyText = "";
          try {
            const parts = msg.payload?.parts || [msg.payload];
            for (const part of parts) {
              if (part?.mimeType === "text/plain" && part?.body?.data) {
                bodyText = atob(part.body.data.replace(/-/g,"+").replace(/_/g,"/"));
                break;
              }
            }
          } catch(_) {}
          // Chercher dans tous les champs + body pour les forwards
          const searchText = `${from} ${to} ${cc} ${replyTo} ${subject} ${snippet} ${bodyText.slice(0,1000)}`;
          const prospect = matchEmailToProspect(searchText, "", "", "", allProspects);
          const proj = prospect ? (prospect._proj||"vin") : matchEmailToProj(from, to, subject, snippet);
          if (f === "projets" && !proj) return null;
          const labelIds = msg.labelIds||[];
          const folder = labelIds.includes("SENT")?"Envoyés":labelIds.includes("DRAFT")?"Brouillons":labelIds.includes("INBOX")?"Reçus":"Autre";
          const timestamp = msg.internalDate ? parseInt(msg.internalDate) : 0;
          return { id:m.id, from, to, subject, date, timestamp, prospect, proj, folder, snippet };
        })
      );

      const sorted = threads
        .filter(Boolean)
        .sort((a,b) => b.timestamp - a.timestamp);

      setGmailThreads(sorted);

      // Sauvegarder les emails matchés dans Supabase (prospectEmails)
      if (data) {
        const newProspectEmails = {...(data.prospectEmails||{})};
        sorted.forEach(t => {
          if (t.prospect) {
            if (!newProspectEmails[t.prospect.id]) newProspectEmails[t.prospect.id] = [];
            const existing = new Set(newProspectEmails[t.prospect.id].map(e=>e.id));
            if (!existing.has(t.id)) {
              newProspectEmails[t.prospect.id].push({
                id:t.id, from:t.from, to:t.to, subject:t.subject, date:t.date,
                timestamp:t.timestamp, folder:t.folder, snippet:t.snippet
              });
            }
          }
        });
        const nd = {...data, prospectEmails: newProspectEmails};
        savingRef.current = true;
        setData({...nd});
        try {
          await storage.set(KEY, JSON.stringify(nd)); setLastSync(Date.now());
          const ts = await storage.getTimestamp(KEY); if (ts) lastRemoteTs.current = ts;
        }
        catch(e) { console.error(e); }
        finally { setTimeout(()=>{ savingRef.current = false; }, 6000); }
      }
    } catch(e) { console.error(e); }
    setGmailLoading(false);scanningRef.current=false;
  };

  useEffect(() => { if (authUser && view==="agenda") loadCalendar(calMonth, calYear); }, [view, calMonth, calYear, authUser]);

  // ── Import XLS ────────────────────────────────────────────────────────────
  const importXLS = async (file) => {
    if (!file || !data) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const clean = s => String(s||"").trim();
        const cleanEmail = s => { const m = clean(s).replace("mailto:",""); return m.includes("@")?m:""; };

        const existing = new Set(data.vin.map(v => `${v.name}|${v.producteur}`.toLowerCase().trim()));

        const mapped = rows
          .filter(r => clean(r["NOM"]) || clean(r["PRODUCTEUR"]))
          .filter(r => {
            const key = `${clean(r["NOM"])||clean(r["PRODUCTEUR"])}|${clean(r["PRODUCTEUR"])}`.toLowerCase();
            return !existing.has(key);
          })
          .map((r) => {
            const nom = clean(r["NOM"]);
            const prod = clean(r["PRODUCTEUR"]);
            const prixMagasin = parseFloat(r["PRIX MAGASIN France"])||0;
            const prixProd = parseFloat(r["PRIX PROD"])||0;
            return {
              id: "xls" + uid(),
              name:             nom || prod,
              geo:              "France 🇫🇷",
              sub:              clean(r["CERTIFICAT"]).split(" ").slice(-2).join(" ") || "",
              contact:          clean(r["CONTACT"]),
              email:            cleanEmail(r["Mail "]),
              phone:            "",
              valeur:           prixMagasin ? Math.round(prixMagasin * 12 * 50) : 0,
              note:             clean(r["Observation "]),
              tags:             [clean(r["TYPE"]), clean(r["CEPAGE"])].filter(Boolean).slice(0,2),
              type:             clean(r["TYPE"]),
              producteur:       prod,
              cepage:           clean(r["CEPAGE"]),
              appellation:      clean(r["CERTIFICAT"]),
              millesime:        r["ANNÉE"] ? String(Math.round(parseFloat(r["ANNÉE"]))||"") : "",
              certificat:       clean(r["CERTIFICAT"]).split(" ")[0] || "",
              alcool:           "",
              bio:              ["OUI","Oui","oui"].includes(clean(r["BIO"])),
              incoterm:         "FOB",
              prixProducteur:   prixProd ? String(prixProd) : "",
              prixMagasinFr:    prixMagasin ? String(prixMagasin) : "",
              prixVenteBresil:  "",
              prixMercadoLivre: "",
              minCommande:      "6",
              status:           PROJECTS.vin.statuses[0],
              assignedTo:       null, lastEditBy: user, lastEditAt: Date.now(), _proj: "vin",
            };
          });

        const nd = { ...data, vin: [...data.vin, ...mapped] };
        await save(nd);
        const skipped = rows.filter(r => clean(r["NOM"]) || clean(r["PRODUCTEUR"])).length - mapped.length;
        alert(`✅ ${mapped.length} fournisseur(s) importé(s)${skipped>0?` · ${skipped} doublon(s) ignoré(s)`:""}!`);
      } catch(err) {
        console.error(err);
        alert("❌ Erreur import : " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const lastRemoteTs = useRef(null);

  const load = useCallback(async (force = false) => {
    if (savingRef.current || scanningRef.current) return; // Ne pas écraser pendant un save ou scan
    try {
      // Polling intelligent : vérifier updated_at avant de télécharger le blob
      if (!force && lastRemoteTs.current) {
        const ts = await storage.getTimestamp(KEY);
        if (ts && ts === lastRemoteTs.current) return; // Pas de changement, on skip
      }
      const r = await storage.get(KEY);
      const d = r ? JSON.parse(r.value) : {...INIT_DATA};
      if (!d.print3d)       d.print3d       = [];
      if (!d.vinClients)    d.vinClients    = [];
      if (!d.prospectEmails) d.prospectEmails = {};
      if (!d.orders)        d.orders        = [];
      if (!d.activity)      d.activity      = [];
      if (!d.filamentStock) d.filamentStock = INIT_DATA.filamentStock;
      if (!d.sharedTokens)  d.sharedTokens  = {};
      // Nettoyer les body emails stockés pour réduire la taille du blob
      if (d.prospectEmails && force) {
        let cleaned = false;
        for (const pid of Object.keys(d.prospectEmails)) {
          d.prospectEmails[pid] = d.prospectEmails[pid].map(e => {
            if (e.body) { cleaned = true; const {body, ...rest} = e; return rest; }
            return e;
          });
        }
        if (cleaned) await storage.set(KEY, JSON.stringify(d));
      }
      // Mettre à jour le timestamp distant connu
      const ts = await storage.getTimestamp(KEY);
      if (ts) lastRemoteTs.current = ts;
      // NE PAS toucher gmailThreads ici — géré uniquement par scanGmail et loadInitialThreads
      // Ne re-rendre que si les données ont changé (évite de casser les modales en édition)
      setData(prev => {
        if (prev && JSON.stringify(prev) === JSON.stringify(d)) return prev;
        return d;
      });
      setLastSync(Date.now());
    } catch { setData({...INIT_DATA}); }
    finally { setLoading(false); }
  }, []);

  const save = useCallback(async d => {
    savingRef.current = true;
    try {
      await storage.set(KEY, JSON.stringify(d));
      // Mémoriser le timestamp pour éviter de re-télécharger au prochain poll
      const ts = await storage.getTimestamp(KEY);
      if (ts) lastRemoteTs.current = ts;
      setData({...d});
      setLastSync(Date.now());
    } catch(e){console.error(e);}
    finally { setTimeout(()=>{ savingRef.current = false; }, 6000); }
  }, []);

  useEffect(() => {
    // Premier chargement : charger data + threads depuis Supabase
    (async () => {
      await load(true);
      // Charger les threads sauvés après le premier load
      try {
        const r = await storage.get(KEY);
        const d = r ? (typeof r.value === "string" ? JSON.parse(r.value) : r.value) : null;
        if (d?.prospectEmails) {
          const all = Object.values(d.prospectEmails).flat();
          if (all.length > 0) setGmailThreads(all.sort((a,b)=>b.timestamp-a.timestamp));
        }
      } catch(_){}
    })();

    // Supabase Realtime — mises à jour instantanées
    const channel = supabase.channel("amigo-sync")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "amigo_data", filter: `key=eq.${KEY}` },
        () => {
          // Changement détecté → recharger (sauf si on est en train de sauver/scanner)
          if (!savingRef.current && !scanningRef.current) load();
        }
      )
      .subscribe((status) => {
        console.log("Realtime:", status);
      });

    // Poll de secours (15s) — sera remplacé par Realtime quand activé côté Supabase
    pollRef.current = setInterval(load, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollRef.current);
    };
  }, [load]);

  // Sync statuts depuis emails déjà sauvegardés — sans rescanner Gmail
  useEffect(() => {
    if (!data || !user) return;
    const emails = data.prospectEmails || {};
    if (!Object.keys(emails).length) return;

    const allProjects = ["makeup","vin","vinClients","print3d"];
    let changed = false;
    const newData = {...data};

    allProjects.forEach(projKey => {
      if (!newData[projKey]) return;
      newData[projKey] = newData[projKey].map(p => {
        const pEmails = emails[p.id] || [];
        if (!pEmails.length) return p;
        const hasSent    = pEmails.some(e=>e.folder==="Envoyés");
        const hasReply   = pEmails.some(e=>e.folder==="Reçus");
        const P2 = PROJECTS[projKey] || PROJECTS["vin"];
        const statuses = P2?.statuses || [];

        let newStatus = p.status;
        if (hasSent && hasReply && p.status === "Contacté") {
          const neg = statuses.find(s=>s.match(/négociation|discussion/i));
          if (neg) newStatus = neg;
        } else if (hasSent && p.status === "À contacter") {
          newStatus = "Contacté";
        }
        if (newStatus !== p.status) { changed = true; return {...p, status:newStatus}; }
        return p;
      });
    });

    if (changed) save(newData);
  }, [data?.prospectEmails, user]);

  // Scan uniquement via le bouton Scanner — pas d'auto-scan

  // Demander la permission pour les notifications navigateur
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Alerte relances au chargement
  // Envoyer les notifications email en attente (déposées par les pages publiques de devis)
  const emailProcessing = useRef(false);
  useEffect(() => {
    if (!data || !user || emailProcessing.current) return;
    const pending = data.pendingEmails || [];
    if (pending.length === 0) return;
    emailProcessing.current = true;
    (async () => {
      try {
        const token = await getGToken();
        if (!token) { emailProcessing.current = false; return; }
        const dest = "anthony.donzel@gmail.com";
        for (const pe of pending) {
          const subj = pe.type === "quote_accepted"
            ? `✅ DEVIS ACCEPTÉ — ${pe.prospectName} · ${pe.product}`
            : pe.type === "all_accepted"
            ? `🎉 TOUS LES DEVIS ACCEPTÉS — ${pe.prospectName}`
            : `👁 Devis consulté — ${pe.prospectName} · ${pe.product}`;
          const body = pe.type === "quote_accepted"
            ? `Le client ${pe.prospectName} a ACCEPTÉ le devis "${pe.product}" pour R$${(pe.amount||0).toFixed(2)}.\n\nConnecte-toi à Amigo pour voir les détails et le QR PIX.\nhttps://amigo-crm-gamma.vercel.app`
            : pe.type === "all_accepted"
            ? `🎉 ${pe.prospectName} a accepté TOUS les devis !\n\nConnecte-toi à Amigo pour voir les détails.\nhttps://amigo-crm-gamma.vercel.app`
            : `Le client ${pe.prospectName} vient d'ouvrir le devis "${pe.product}".\n\nConnecte-toi à Amigo pour suivre.\nhttps://amigo-crm-gamma.vercel.app`;
          await sendGmail({ to: dest, subject: subj, body });
        }
        // Vider la file
        const freshRaw = await storage.get(KEY);
        const fresh = freshRaw ? JSON.parse(freshRaw.value) : data;
        fresh.pendingEmails = [];
        await storage.set(KEY, JSON.stringify(fresh));
        const ts = await storage.getTimestamp(KEY); if (ts) lastRemoteTs.current = ts;
        setData(prev => ({...prev, pendingEmails: []}));
      } catch(e) { console.error("Email notif error:", e); }
      emailProcessing.current = false;
    })();
  }, [data?.pendingEmails?.length]);

  const relanceChecked = useRef(false);
  useEffect(() => {
    if (!data || !user || relanceChecked.current) return;
    relanceChecked.current = true;
    const pendingQuotes = (data.orders||[]).filter(o=>o.type==="devis"&&o.status==="Envoyé"&&o.createdAt&&(Date.now()-o.createdAt)>3*86400000);
    if (pendingQuotes.length > 0) {
      setTimeout(() => {
        setNotif({id:Date.now(),by:"system",byLabel:"🔔 Relances",prospectName:`${pendingQuotes.length} devis`,action:`sans réponse depuis 3j+`});
        setTimeout(()=>setNotif(null),8000);
      }, 2000);
    }
  }, [data, user]);

  useEffect(() => {
    if (!data||!user) return;
    const acts=data.activity||[];
    if (prevLen.current>0&&acts.length>prevLen.current) {
      const l=acts[acts.length-1];
      if (l.by!==user){
        setNotif(l);setTimeout(()=>setNotif(null),8000);
        // Notification navigateur (même si onglet en arrière-plan)
        if ("Notification" in window && Notification.permission === "granted") {
          const isQuote = l.by === "system";
          const n = new Notification(
            isQuote ? "📋 Devis — Amigo CRM" : "Amigo CRM",
            { body: `${l.prospectName} ${l.action}`, icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📋</text></svg>", tag: `amigo-${l.id}` }
          );
          n.onclick = () => { window.focus(); n.close(); };
        }
        // Son d'alerte pour les événements devis
        if (l.by === "system") {
          try { const ctx = new AudioContext(); const osc = ctx.createOscillator(); const g = ctx.createGain(); osc.connect(g); g.connect(ctx.destination); osc.frequency.value = 880; g.gain.value = 0.1; osc.start(); osc.stop(ctx.currentTime + 0.15); setTimeout(()=>{const o2=ctx.createOscillator();const g2=ctx.createGain();o2.connect(g2);g2.connect(ctx.destination);o2.frequency.value=1100;g2.gain.value=0.1;o2.start();o2.stop(ctx.currentTime+0.15);},180); } catch(_){}
        }
      }
    }
    prevLen.current=acts.length;
  }, [data, user]);

  const addAct = (d, by, name, action) => ({...d, activity:[...(d.activity||[]).slice(-99),{id:Date.now(),by,byLabel:USERS[by]?.label,prospectName:name,action,at:Date.now(),proj:projId}]});

  const updateProspect = async (pid, fields) => {
    if (!data||!user) return;
    // Update optimiste — state local immédiat
    const srcKey = data[effectiveProjId]?.find(x=>x.id===pid) ? effectiveProjId
      : Object.keys(data).find(k=>Array.isArray(data[k])&&data[k].find(x=>x.id===pid)) || effectiveProjId;
    const p = (data[srcKey]||[]).find(x=>x.id===pid);
    // Historique des modifications
    const changes = [];
    if (p) Object.keys(fields).forEach(k => {
      const oldVal = p[k], newVal = fields[k];
      if (oldVal !== newVal && k !== "lastEditBy" && k !== "lastEditAt") {
        const label = {name:"Nom",status:"Statut",email:"Email",phone:"Tél",contact:"Contact",geo:"Localisation",note:"Note",assignedTo:"Assigné",cnpj:"CNPJ",tags:"Tags"}[k] || k;
        changes.push(`${label}: ${oldVal||"–"} → ${newVal||"–"}`);
      }
    });
    const historyEntry = { at: Date.now(), by: user, byLabel: USERS[user]?.label, changes };
    const upd = {...fields, lastEditBy:user, lastEditAt:Date.now(), history:[...(p?.history||[]).slice(-49), historyEntry]};
    let nd = {...data, [srcKey]:(data[srcKey]||[]).map(x=>x.id===pid?{...x,...upd}:x)};
    nd = addAct(nd, user, p?.name, fields.status?`→ ${fields.status}`:changes.length?changes[0]:"modifié");
    setDetailProspect(s=>s?.id===pid?{...s,...upd}:s);
    setData({...nd}); // UI se met à jour instantanément
    // Save en arrière-plan
    savingRef.current = true;
    try {
      await storage.set(KEY, JSON.stringify(nd)); setLastSync(Date.now());
      const ts = await storage.getTimestamp(KEY); if (ts) lastRemoteTs.current = ts;
    }
    catch(e) { console.error(e); }
    finally { setTimeout(()=>{ savingRef.current = false; }, 6000); }
  };

  const addProspect = async p => {
    if (!data||!user) return;
    const targetProj = p._proj || effectiveProjId;
    p.lastEditBy=user; p.lastEditAt=Date.now(); p._proj=targetProj;
    let nd = {...data, [targetProj]:[...(data[targetProj]||[]), p]};
    nd = addAct(nd, user, p.name, "ajouté");
    setShowAddProspect(false);
    await save(nd);
    // Ouvrir la fiche immédiatement après création
    setDetailProspect(p);
  };

  const deleteProspect = async (pid) => {
    if (!data||!user) return;
    const srcKey = ["makeup","vin","vinClients","print3d"].find(k=>(data[k]||[]).some(p=>p.id===pid)) || effectiveProjId;
    const p = (data[srcKey]||[]).find(x=>x.id===pid);
    let nd = {...data, [srcKey]:(data[srcKey]||[]).filter(x=>x.id!==pid)};
    // Supprimer les emails et commandes liés
    nd.prospectEmails = {...(nd.prospectEmails||{})}; delete nd.prospectEmails[pid];
    nd.orders = (nd.orders||[]).filter(o=>o.prospectId!==pid);
    nd = addAct(nd, user, p?.name||"?", "supprimé");
    setDetailProspect(null);
    await save(nd);
  };

  const addOrder = async o => {
    if (!data||!user) return;
    o.createdBy=user; o.createdAt=Date.now();
    let nd = {...data, orders:[...(data.orders||[]), o]};
    nd = addAct(nd, user, o.prospectName, `${o.type||"commande"} ${$(o.amount*(o.qty||1))}`);
    setShowAddOrder(undefined);
    await save(nd);
  };

  const addProspectAndOrder = async (prospect, order) => {
    if (!data||!user) return;
    const targetProj = prospect._proj || effectiveProjId;
    prospect.lastEditBy=user; prospect.lastEditAt=Date.now();
    order.createdBy=user; order.createdAt=Date.now();
    let nd = {...data, [targetProj]:[...(data[targetProj]||[]), prospect], orders:[...(data.orders||[]), order]};
    nd = addAct(nd, user, prospect.name, "ajouté");
    nd = addAct(nd, user, order.prospectName, `${order.type||"commande"} ${$(order.amount*(order.qty||1))}`);
    await save(nd);
  };

  const updateFilamentStock = async (spoolId, gramsUsed) => {
    if (!data) return;
    const nd = {...data, filamentStock:(data.filamentStock||[]).map(s=>
      s.id===spoolId ? {...s, weightUsed: Math.min(s.weightTotal, (s.weightUsed||0) + gramsUsed)} : s
    )};
    setData({...nd});
    savingRef.current = true;
    try {
      await storage.set(KEY, JSON.stringify(nd)); setLastSync(Date.now());
      const ts = await storage.getTimestamp(KEY); if (ts) lastRemoteTs.current = ts;
    }
    catch(e) { console.error(e); }
    finally { setTimeout(()=>{ savingRef.current = false; }, 6000); }
  };

  const updateOrder = async (oid, fields) => {
    if (!data) return;
    let nd = {...data, orders:(data.orders||[]).map(o=>o.id===oid?{...o,...fields}:o)};

    // Sync statut prospect pour print3d
    if (fields.status || fields.type) {
      const order = nd.orders.find(o=>o.id===oid);
      if (order && order.proj==="print3d" && order.prospectId) {
        const statusMap = {
          "Brouillon":"Prospect", "Envoyé":"Devis envoyé", "Accepté":"Devis accepté",
          "En attente":"Devis accepté", "Confirmée":"En production", "En production":"En production",
          "Livré":"Livré", "Facturé":"Facturé"
        };
        const newProspectStatus = statusMap[order.status];
        if (newProspectStatus) {
          nd = {...nd, print3d:(nd.print3d||[]).map(p=>p.id===order.prospectId?{...p,status:newProspectStatus}:p)};
        }
      }
    }
    // Update optimiste
    setData({...nd});
    savingRef.current = true;
    try {
      await storage.set(KEY, JSON.stringify(nd)); setLastSync(Date.now());
      const ts = await storage.getTimestamp(KEY); if (ts) lastRemoteTs.current = ts;
    }
    catch(e) { console.error(e); }
    finally { setTimeout(()=>{ savingRef.current = false; }, 6000); }
  };

  const addEvent = async (ev) => {
    if (!data) return;
    const events = [...(data.events||[]), {...ev, id:"ev"+uid(), createdBy:user, createdAt:Date.now()}];
    let nd = {...data, events};
    nd = addAct(nd, user, ev.title, `événement ${ev.date}`);
    setShowAddEvent(null);
    await save(nd);
  };

  const deleteEvent = async (eid) => {
    if (!data) return;
    await save({...data, events:(data.events||[]).filter(e=>e.id!==eid)});
  };

  const clearProspectEmails = async (prospect) => {
    if (!confirm(`Vider tous les emails de ${prospect.name} ?`)) return;
    const freshRaw = await storage.get(KEY);
    const fresh = freshRaw ? (typeof freshRaw.value === "string" ? JSON.parse(freshRaw.value) : freshRaw.value) : data;
    const nd = {...fresh, prospectEmails:{...(fresh.prospectEmails||{}), [prospect.id]:[]}};
    await save(nd);
  };

  const clearAllEmails = async () => {
    if (!confirm("Vider TOUS les emails synchronisés ? Les nouveaux seront re-scannés depuis le nouveau compte.")) return;
    try {
      const freshRaw = await storage.get(KEY);
      const fresh = freshRaw ? (typeof freshRaw.value === "string" ? JSON.parse(freshRaw.value) : freshRaw.value) : data;
      setGmailThreads([]);
      await save({...fresh, prospectEmails:{}});
    } catch(e) { console.error("clearAllEmails error:", e); }
  };

  const [scanProgress, setScanProgress] = useState(null); // "Scan 3/12…"

  const scanForProspect = async (prospect, silent=false) => {
    scanningRef.current = true;
    setGmailLoading(true);
    try {
      const token = await getGToken();
      if (!token) { setGmailLoading(false);scanningRef.current=false; return; }
      const domain = prospect.email?.split("@")[1]?.toLowerCase();
      if (!domain) { setGmailLoading(false);scanningRef.current=false; return; }

      const GENERIC_DOMAINS = ["gmail.com","orange.fr","hotmail.com","hotmail.fr","yahoo.com","yahoo.fr","outlook.com","outlook.fr","free.fr","sfr.fr","laposte.net","wanadoo.fr","icloud.com","live.fr","live.com","bbox.fr","numericable.fr"];
      const emailAddr = prospect.email.toLowerCase();
      const useFullEmail = GENERIC_DOMAINS.includes(domain);
      // Inclure CC dans la recherche
      const query = useFullEmail
        ? `from:${emailAddr} OR to:${emailAddr} OR cc:${emailAddr}`
        : `from:${domain} OR to:${domain} OR cc:${emailAddr}`;
      const queryPJ1 = useFullEmail ? `has:attachment from:${emailAddr}` : `has:attachment from:${domain}`;
      const queryPJ2 = useFullEmail ? `has:attachment to:${emailAddr}` : `has:attachment to:${domain}`;

      const mailbox = "me";
      let d1, d2, d3;
      if (silent) {
        // Mode silencieux : 1 seule requête list, pas de recherche PJ
        const res1 = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${mailbox}/messages?maxResults=10&q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } });
        d1 = await res1.json(); d2 = { messages: [] }; d3 = { messages: [] };
      } else {
        const [res1, res2, res3] = await Promise.all([
          fetch(`https://gmail.googleapis.com/gmail/v1/users/${mailbox}/messages?maxResults=30&q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`https://gmail.googleapis.com/gmail/v1/users/${mailbox}/messages?maxResults=20&q=${encodeURIComponent(queryPJ1)}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`https://gmail.googleapis.com/gmail/v1/users/${mailbox}/messages?maxResults=20&q=${encodeURIComponent(queryPJ2)}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        [d1, d2, d3] = await Promise.all([res1.json(), res2.json(), res3.json()]);
      }
      const emailIds = new Set((d1.messages||[]).map(m=>m.id));
      const pjIds = new Set([...(d2.messages||[]).map(m=>m.id), ...(d3.messages||[]).map(m=>m.id)]);

      // Ne télécharger que les emails pas encore en base
      const existingIds = new Set(((data?.prospectEmails||{})[prospect.id]||[]).map(e=>e.id));
      const newIds = [...emailIds].filter(id => !existingIds.has(id));
      if (silent && newIds.length === 0) { setGmailLoading(false); return; } // Rien de nouveau
      const idsToFetch = silent ? newIds : [...emailIds]; // En mode silencieux, uniquement les nouveaux

      const threads = await Promise.all(
        idsToFetch.map(async id => {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/${mailbox}/messages/${id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const msg = await r.json();
          const headers = msg.payload?.headers||[];
          const get = n => headers.find(h=>h.name===n)?.value||"";
          const from=get("From"), to=get("To"), subject=get("Subject"), date=get("Date"), cc=get("Cc");
          const snippet=decodeSnippet(msg.snippet||"");
          const labelIds=msg.labelIds||[];
          const folder=labelIds.includes("SENT")?"Envoyés":labelIds.includes("DRAFT")?"Brouillons":labelIds.includes("INBOX")?"Reçus":"Autre";
          const timestamp=msg.internalDate?parseInt(msg.internalDate):0;
          const hasPJ = pjIds.has(id);
          const extractBody = (parts=[]) => {
            for (const p of parts) {
              if (p.mimeType==="text/plain" && p.body?.data) {
                try {
                  const bin = atob(p.body.data.replace(/-/g,"+").replace(/_/g,"/"));
                  const bytes = new Uint8Array(bin.length);
                  for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
                  return new TextDecoder("utf-8").decode(bytes);
                } catch(e){}
              }
              if (p.parts) { const r2=extractBody(p.parts); if(r2) return r2; }
            }
            return null;
          };
          const decodeBase64Body = (data) => {
            try {
              const bin = atob(data.replace(/-/g,"+").replace(/_/g,"/"));
              const bytes = new Uint8Array(bin.length);
              for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
              return new TextDecoder("utf-8").decode(bytes);
            } catch(e) { return null; }
          };
          const body = msg.payload?.parts ? extractBody(msg.payload.parts)
            : (msg.payload?.body?.data ? decodeBase64Body(msg.payload.body.data) : null);
          return { id, from, to, cc, subject, date, timestamp, prospectId:prospect.id, proj:prospect._proj||projId, folder, snippet, scannedBy:user, hasPJ };
        })
      );

      // Fusionner avec existants — relire Supabase en direct pour ne pas écraser les emails d'Harold
      const freshSupabase = await storage.get(KEY);
      const latestData = freshSupabase ? JSON.parse(freshSupabase.value) : data;
      const existingEmails = latestData?.prospectEmails?.[prospect.id]||[];
      const knownIds = new Set(existingEmails.map(e=>e.id));
      const fresh = threads.filter(t=>!knownIds.has(t.id));
      const allEmails = [...existingEmails, ...fresh].sort((a,b)=>b.timestamp-a.timestamp);
      const nd = {...latestData, prospectEmails:{...(latestData.prospectEmails||{}), [prospect.id]:allEmails}};
      await save(nd);

      // ── Mise à jour automatique du statut — toujours, même en silent
      {
        const hasEmailSent     = allEmails.some(e=>e.folder==="Envoyés");
        const hasEmailReceived = allEmails.some(e=>e.folder==="Reçus");
        const currentStatus    = prospect.status;
        const P_statuses       = PROJECTS[prospect._proj||projId]?.statuses||[];
        let newStatus = null;
        if (hasEmailSent && hasEmailReceived) {
          const negStatus = P_statuses.find(s=>s.match(/négociation|discussion/i));
          if (negStatus && currentStatus === "Contacté") newStatus = negStatus;
        } else if (hasEmailSent && currentStatus === "À contacter") {
          newStatus = "Contacté";
        }
        if (newStatus && newStatus !== currentStatus) {
          await updateProspect(prospect.id, { status: newStatus });
        }
      }

      // Étape 2 — PJ uniquement sur les emails qui sont dans notre liste de threads
      const threadIdsWithPJ = new Set(threads.filter(t=>t.hasPJ).map(t=>t.id));
      const existingDocs = prospect.docs||[];
      const existingNames = new Set(existingDocs.map(d=>d.name));
      let updatedDocs = [...existingDocs];

      for (const id of threadIdsWithPJ) {
        try {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/${mailbox}/messages/${id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const msg = await r.json();
          const findAtts = (parts=[]) => {
            const found = [];
            for (const part of parts) {
              if (part.filename?.length>0 && part.body?.attachmentId)
                found.push({ msgId:id, attachmentId:part.body.attachmentId, filename:part.filename, mimeType:part.mimeType||"application/octet-stream", size:part.body.size||0 });
              if (part.parts) found.push(...findAtts(part.parts));
            }
            return found;
          };
          for (const att of findAtts(msg.payload?.parts||[])) {
            if (existingNames.has(att.filename)) continue;
            const attRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${att.msgId}/attachments/${att.attachmentId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const attData = await attRes.json();
            if (!attData.data) continue;
            const binary = atob(attData.data.replace(/-/g,"+").replace(/_/g,"/"));
            const bytes = new Uint8Array(binary.length);
            for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: att.mimeType });
            const path = `${prospect.id}/${Date.now()}_${att.filename}`;
            const { error } = await supabase.storage.from("amigo-docs").upload(path, blob, { contentType: att.mimeType });
            if (error) { console.error("PJ upload:", error.message); continue; }
            updatedDocs.push({ id:"doc"+uid(), name:att.filename, path, size:att.size, date:new Date().toLocaleDateString("fr-FR"), uploadedBy:`Gmail (${user})` });
            existingNames.add(att.filename);
          }
        } catch(e) { console.error("PJ:", e.message); }
      }

      if (updatedDocs.length > existingDocs.length)
        await updateProspect(prospect.id, { docs: updatedDocs });

      const nbDocs = updatedDocs.length - existingDocs.length;
      if (!silent && fresh.length > 0) alert(`✅ ${fresh.length} email(s)${nbDocs>0?` · ${nbDocs} pièce(s) jointe(s) dans Docs`:""}`);

    } catch(e) { console.error(e); if (!silent) alert("Erreur : "+e.message); }
    setGmailLoading(false);scanningRef.current=false;
  };

  if (authLoading || (authUser && loading)) return (
    <div style={{minHeight:"100vh",background:"#080a0f",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{color:"#374151",fontSize:13}}>Chargement…</p>
    </div>
  );

  if (!authUser) return (
    <div style={{minHeight:"100vh",background:"#080a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans','Helvetica Neue',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{textAlign:"center",maxWidth:360,padding:"0 20px"}}>
        <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#2563eb,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:800,color:"white",margin:"0 auto 16px"}}>A</div>
        <p style={{fontSize:28,fontWeight:600,color:"#f1f5f9",marginBottom:6,letterSpacing:"-.3px"}}>amigo CRM</p>
        <p style={{fontSize:12,color:"#374151",marginBottom:40}}>Espace privé · Anthony & Harold</p>

        <button onClick={signInWithGoogle}
          style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,width:"100%",padding:"13px 20px",background:"white",border:"none",borderRadius:10,cursor:"pointer",fontSize:14,fontWeight:500,color:"#1f2937",boxShadow:"0 2px 12px #00000040",transition:"all .15s"}}
          onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
          onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Se connecter avec Google
        </button>

        {authError && <p style={{fontSize:11,color:"#ef4444",marginTop:12}}>{authError}</p>}
        <p style={{fontSize:10,color:"#1f2937",marginTop:20}}>Accès réservé aux membres autorisés</p>
      </div>
    </div>
  );

  const U = USERS[user];

  const effectiveProjId = projId === "vin" ? vinSubType : projId;
  const P = PROJECTS[effectiveProjId] || PROJECTS[projId] || Object.values(PROJECTS)[0];
  const accent = P?.color || "#8b5cf6";

  // Détection auto client/fournisseur vin
  const isVinClient = (p) => {
    const tel = (p.phone||"").replace(/\s/g,"");
    const email = (p.email||"").toLowerCase();
    if (tel.startsWith("+55") || tel.startsWith("55")) return true;
    if (email.endsWith(".br")) return true;
    if ((p.geo||"").includes("🇧🇷")) return true;
    return false;
  };

  // Prospects : fusionner vin + vinClients si on est sur vin
  const allVinProspects = projId === "vin" ? [
    ...(data?.vin||[]).map(p=>({...p,_proj:"vin"})),
    ...(data?.vinClients||[]).map(p=>({...p,_proj:"vinClients"})),
  ] : [];

  const prospects = projId === "vin"
    ? allVinProspects.filter(p => {
        if (vinFilter === "fournisseurs") return !isVinClient(p);
        if (vinFilter === "clients") return isVinClient(p);
        return true;
      })
    : (data?.[effectiveProjId]||[]).map(p=>({...p,_proj:effectiveProjId}));

  const sortFn = sortMode === "alpha"
    ? (a, b) => (a.name || a.prospectName || "").localeCompare(b.name || b.prospectName || "", "fr")
    : (a, b) => (b.lastEditAt || b.createdAt || 0) - (a.lastEditAt || a.createdAt || 0);

  prospects.sort(sortFn);
  const projOrders = (data?.orders||[]).filter(o=>o.proj===projId).sort(
    sortMode === "alpha"
      ? (a, b) => (a.prospectName || "").localeCompare(b.prospectName || "", "fr")
      : (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
  const activity = (data?.activity||[]).filter(a=>a.proj===projId).slice(-30).reverse();
  const $  = projId==="print3d" ? fmtBrl : fmtEur; // formatter monnaie selon projet
  const isArchived = o => ["Refusé","Expiré","Annulé","Annulée"].includes(o.status);
  const activeOrders = projOrders.filter(o => !isArchived(o));
  const archivedOrders = projOrders.filter(o => isArchived(o));
  const activeDevis = activeOrders.filter(o => o.type === "devis");
  const activeCommandes = activeOrders.filter(o => o.type !== "devis");
  const totalCA = projOrders.filter(o=>o.type!=="devis"&&["Confirmée","En production","Livré","Facturé"].includes(o.status)).reduce((s,o)=>s+o.amount*(o.qty||1),0);
  const pipeline = prospects.reduce((s,p)=>s+p.valeur,0);

  return (
    <div style={{minHeight:"100vh",background:"#080a0f",color:"#e2e8f0",fontFamily:"'DM Sans','Helvetica Neue',sans-serif",display:"flex",flexDirection:"column",filter:THEMES[theme]?.filter||"none"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#1a2030;border-radius:2px}
        .btn{transition:all .14s;cursor:pointer}.btn:hover{opacity:.82;transform:translateY(-1px)}
        .fade{animation:fi .22s ease}@keyframes fi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .pulse{animation:pl 2.5s ease infinite}@keyframes pl{0%,100%{opacity:1}50%{opacity:.4}}
        .notif{animation:nf .3s ease}@keyframes nf{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        select option{background:#0d1020}
        th{padding:8px 12px;font-size:10px;color:#3d4f6b;text-align:left;text-transform:uppercase;letter-spacing:.4px;font-weight:600;border-bottom:1px solid #0d1020}
        td{padding:8px 12px;font-size:12px;color:#9ca3af;border-bottom:1px solid #080a0f}
      `}</style>

      {notif&&(()=>{
        const isQuoteEvent = notif.by === "system";
        return (
        <div className="notif" onClick={()=>setNotif(null)} style={{position:"fixed",top:10,left:"50%",transform:"translateX(-50%)",background:isQuoteEvent?"#0f1a0f":"#0d1020",border:`1px solid ${isQuoteEvent?"#22c55e40":"#22c55e22"}`,borderRadius:10,padding:isQuoteEvent?"10px 20px":"8px 16px",zIndex:300,cursor:"pointer",display:"flex",alignItems:"center",gap:9,boxShadow:isQuoteEvent?"0 4px 24px rgba(34,197,94,.25)":"0 4px 20px #00000060"}}>
          <span style={{width:isQuoteEvent?8:6,height:isQuoteEvent?8:6,borderRadius:"50%",background:"#22c55e",display:"inline-block"}} className={isQuoteEvent?"pulse":""}/>
          <span style={{fontSize:isQuoteEvent?12:11,color:"#e2e8f0"}}><span style={{color:isQuoteEvent?"#4ade80":USERS[notif.by]?.color,fontWeight:600}}>{notif.byLabel}</span> — <span style={{color:"#f1f5f9"}}>{notif.prospectName}</span> <span style={{color:isQuoteEvent?"#86efac":"#6b7280"}}>{notif.action}</span></span>
          <span style={{fontSize:14,color:"#374151"}}>×</span>
        </div>
        );
      })()}

      {/* NAV */}
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 20px",borderBottom:"1px solid #0c0f18",background:"#080a0f",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#2563eb,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"white"}}>A</div>
          <span style={{fontSize:15,fontWeight:600,color:"#f1f5f9"}}>amigo</span>
          <span style={{width:1,height:12,background:"#1a2030",margin:"0 4px"}}/>
          <div style={{display:"flex",gap:2,background:"#0b0d16",borderRadius:7,padding:2,border:"1px solid #0f1520"}}>
            {Object.values(PROJECTS).filter(p=>p.id!=="vinClients").map(p=>(
              <button key={p.id} onClick={()=>{setProjId(p.id);setView("dashboard");}} className="btn"
                style={{padding:"4px 10px",borderRadius:5,fontSize:12,fontWeight:500,cursor:"pointer",background:projId===p.id?`${p.color}18`:"transparent",color:projId===p.id?p.color:"#94a3b8",border:projId===p.id?`1px solid ${p.color}22`:"1px solid transparent",display:"flex",alignItems:"center",gap:4}}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── BARRE DE RECHERCHE ── */}
        <div style={{position:"relative",flex:"0 0 280px"}}>
          <input
            value={searchQuery}
            onChange={e=>{setSearchQuery(e.target.value);setSearchOpen(true);}}
            onFocus={()=>setSearchOpen(true)}
            onBlur={()=>setTimeout(()=>setSearchOpen(false),180)}
            placeholder="🔍 Rechercher un prospect, fournisseur…"
            style={{width:"100%",padding:"6px 12px",borderRadius:8,fontSize:12,outline:"none",background:"#0b0d16",border:`1px solid ${searchQuery?"#3b82f6":"#0f1520"}`,color:"#e2e8f0",fontFamily:"inherit",transition:"border .15s"}}
          />
          {searchOpen && searchQuery.length>1 && (()=>{
            const q = searchQuery.toLowerCase();
            const allProspects = [
              ...(data?.makeup||[]).map(p=>({...p,_proj:"makeup"})),
              ...(data?.vin||[]).map(p=>({...p,_proj:"vin"})),
              ...(data?.print3d||[]).map(p=>({...p,_proj:"print3d"})),
            ];
            const results = allProspects.filter(p=>
              p.name?.toLowerCase().includes(q) ||
              p.contact?.toLowerCase().includes(q) ||
              p.email?.toLowerCase().includes(q) ||
              p.producteur?.toLowerCase().includes(q) ||
              p.cepage?.toLowerCase().includes(q) ||
              p.note?.toLowerCase().includes(q)
            ).slice(0,8);
            if (!results.length) return (
              <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#0b0d16",border:"1px solid #1a2035",borderRadius:9,padding:"14px",zIndex:200}}>
                <p style={{fontSize:11,color:"#4b5563",textAlign:"center"}}>Aucun résultat pour "{searchQuery}"</p>
              </div>
            );
            return (
              <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#0b0d16",border:"1px solid #1a2035",borderRadius:9,overflow:"hidden",zIndex:200,boxShadow:"0 8px 24px #00000060"}}>
                {results.map(p=>{
                  const proj = PROJECTS[p._proj] || PROJECTS["vin"] || Object.values(PROJECTS)[0];
                  return (
                    <div key={p.id} onMouseDown={()=>{
                      const pid = p._proj==="vinClients"?"vin":p._proj;
                      setProjId(pid);
                      if(p._proj==="vinClients") setVinSubType("vinClients");
                      setDetailProspect(p);setSearchQuery("");setSearchOpen(false);}}
                      style={{padding:"9px 14px",borderBottom:"1px solid #080a0f",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}
                      onMouseEnter={e=>e.currentTarget.style.background="#0f1520"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <span style={{fontSize:16,flexShrink:0}}>{proj.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</p>
                        <p style={{fontSize:10,color:"#4b5563"}}>{proj.label} · {p.status}</p>
                      </div>
                      
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        <div style={{display:"flex",gap:2,background:"#0b0d16",borderRadius:7,padding:2,border:"1px solid #0f1520"}}>
          {[["dashboard","Dashboard"],["kanban","Pipeline"],["commandes","Commandes"],["finance","Finance"],...(projId==="print3d"?[["stock","Stock"],["blender","🎨 3D Studio"]]:[]),["emails","Emails"],["agenda","Agenda"],["activite","Activité"],...(projId==="vin"?[["carte","🗺 Carte"]]:[]),["idees","💡"]]
          .map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} className="btn"
              style={{padding:"4px 11px",borderRadius:5,fontSize:12,fontWeight:500,background:view===v?`${accent}18`:"transparent",color:view===v?accent:"#94a3b8",border:view===v?`1px solid ${accent}22`:"1px solid transparent",cursor:"pointer"}}>
              {l}
            </button>
          ))}
          <div style={{width:1,height:14,background:"#1a2030",margin:"0 2px"}}/>
          <button onClick={()=>setSortMode(s=>{const n=s==="alpha"?"recent":"alpha";localStorage.setItem("amigo-sort",n);return n;})} className="btn"
            style={{padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:500,cursor:"pointer",background:"#0b0d16",color:"#94a3b8",border:"1px solid #0f1520",display:"flex",alignItems:"center",gap:4}}>
            {sortMode==="alpha"?"A→Z":"Récents"}
          </button>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8}}>

          {/* Widget Heure France */}
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:"#0b0d16",borderRadius:7,border:"1px solid #0f1520"}}>
            <span style={{fontSize:10}}>🇫🇷</span>
            <span style={{fontSize:11,fontWeight:600,color:"#f1f5f9",fontVariantNumeric:"tabular-nums"}}>{heureFrance||"--:--:--"}</span>
          </div>

          {/* Widget EUR/BRL */}
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:"#0b0d16",borderRadius:7,border:"1px solid #0f1520"}}>
            <span style={{fontSize:10}}>💱</span>
            <span style={{fontSize:10,color:"#4b5563"}}>EUR/BRL</span>
            <span style={{fontSize:11,fontWeight:700,color:eurBrl?"#4ade80":"#374151"}}>{eurBrl||"…"}</span>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:"#0b0d16",borderRadius:5,border:"1px solid #0f1520"}}>
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>
            <span style={{fontSize:10,color:"#4b5563"}}>{lastSync?ago(lastSync):"–"}</span>
          </div>
          {scanProgress&&(
            <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:"#3b82f615",borderRadius:5,border:"1px solid #3b82f628"}}>
              <span style={{fontSize:10,color:"#60a5fa"}}>{scanProgress}</span>
            </div>
          )}
          {Object.entries(USERS).map(([id,u])=>(
            <div key={id} onClick={()=>user!==id&&setUser(id)} title={u.label}
              style={{width:24,height:24,borderRadius:"50%",background:`linear-gradient(135deg,${u.color}70,${u.color})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white",border:user===id?`2px solid ${u.color}`:"2px solid transparent",cursor:user!==id?"pointer":"default",opacity:user===id?1:0.45}}>
              {u.avatar}
            </div>
          ))}
          <button onClick={signOut} className="btn" style={{fontSize:11,color:"#94a3b8",background:"#0b0d16",border:"1px solid #1a2035",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:500}} title="Se déconnecter">← Quitter</button>
          <button onClick={importSeedData} className="btn" title="Importer écoles maquillage + clients 3D Rio"
            style={{fontSize:10,color:"#4ade80",background:"#22c55e12",border:"1px solid #22c55e25",borderRadius:6,padding:"4px 8px",cursor:"pointer"}}>⬇️ Import</button>
          <div style={{display:"flex",background:"#0b0d16",borderRadius:6,padding:2,border:"1px solid #0f1520",gap:1}}>
            {Object.entries(THEMES).map(([k,v])=>(
              <button key={k} onClick={()=>switchTheme(k)} title={v.label}
                style={{padding:"3px 7px",borderRadius:4,fontSize:10,cursor:"pointer",background:theme===k?"#ffffff15":"transparent",border:"none",color:theme===k?"#f1f5f9":"#3d4f6b",fontWeight:theme===k?600:400}}>
                {v.label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* USER STRIP */}
      <div style={{padding:"5px 20px",background:`${U.color}08`,borderBottom:`1px solid ${U.color}12`,display:"flex",alignItems:"center",gap:7}}>
        <div style={{width:16,height:16,borderRadius:"50%",background:U.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"white"}}>{U.avatar}</div>
        <span style={{fontSize:11,color:U.color,fontWeight:600}}>{U.label}</span>
        <span style={{fontSize:11,color:"#2d3748"}}>· {P.icon} {P.label}</span>
        {projId==="vin"&&(
          <div style={{display:"flex",background:"#0b0d16",borderRadius:6,padding:2,border:"1px solid #0f1520",gap:1,marginLeft:8}}>
            {[["tous","🍷🥂 Tous"],["fournisseurs","🍷 Fournisseurs"],["clients","🥂 Clients Brésil"]].map(([v,l])=>(
              <button key={v} onClick={()=>setVinFilter(v)} className="btn"
                style={{padding:"2px 10px",borderRadius:4,fontSize:10,fontWeight:600,cursor:"pointer",background:vinFilter===v?"#8b5cf618":"transparent",color:vinFilter===v?"#a78bfa":"#4b5563",border:vinFilter===v?"1px solid #8b5cf628":"1px solid transparent",transition:"all .12s"}}>
                {l}
              </button>
            ))}
          </div>
        )}
        <span style={{marginLeft:"auto",fontSize:11,color:"#2d3748"}}>{P.icon} {P.label}</span>
      </div>

      <div style={{flex:1,overflow:"auto",padding:"18px 20px"}}>

        {/* ══ DASHBOARD ══ */}
        {view==="dashboard"&&(()=>{
          const allProjects = [
            {key:"makeup",label:"Carnaval Gall",icon:"💄",color:"#ec4899",prospects:data?.makeup||[]},
            {key:"vin",label:"Vin",icon:"🍷",color:"#8b5cf6",prospects:[...(data?.vin||[]),...(data?.vinClients||[])]},
            {key:"print3d",label:"Impression 3D",icon:"🧊",color:"#14b8a6",prospects:data?.print3d||[]},
          ];
          const allOrders = data?.orders||[];
          const recentActs = (data?.activity||[]).slice(-20).reverse();
          const needsFollowUp = allProjects.flatMap(pj=>pj.prospects.filter(p=>{
            const pe=(data?.prospectEmails||{})[p.id]||[];
            const sent=pe.some(e=>e.folder==="Envoyés");
            const recu=pe.some(e=>e.folder==="Reçus");
            const last=pe[0]?.timestamp;
            return sent&&!recu&&last&&(Date.now()-last)>14*86400000;
          }).map(p=>({...p,_projKey:pj.key,_projIcon:pj.icon})));

          return (
          <div className="fade">
            <div style={{marginBottom:20}}>
              <p style={{fontSize:18,fontWeight:700,color:"#f1f5f9",marginBottom:4}}>Bonjour {USERS[user]?.label} 👋</p>
              <p style={{fontSize:12,color:"#4b5563"}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
            </div>

            {/* KPIs par projet */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
              {allProjects.map(pj=>{
                const orders = allOrders.filter(o=>o.proj===pj.key);
                const active = orders.filter(o=>!["Refusé","Expiré","Annulé","Annulée"].includes(o.status));
                const nbDevis = active.filter(o=>o.type==="devis").length;
                const nbCmd = active.filter(o=>o.type!=="devis").length;
                const ca = orders.filter(o=>o.type!=="devis"&&["Confirmée","En production","Livré","Facturé"].includes(o.status)).reduce((s,o)=>s+o.amount*(o.qty||1),0);
                const pending = active.filter(o=>["En attente","Brouillon","Envoyé"].includes(o.status)).length;
                return (
                  <div key={pj.key} onClick={()=>{setProjId(pj.key);setView("kanban");}}
                    style={{background:"#0b0d16",border:`1px solid ${pj.color}22`,borderRadius:11,padding:16,cursor:"pointer",transition:"border-color .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=pj.color+"55"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=pj.color+"22"}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                      <span style={{fontSize:20}}>{pj.icon}</span>
                      <span style={{fontSize:14,fontWeight:700,color:pj.color}}>{pj.label}</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div><p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",marginBottom:2}}>Prospects</p><p style={{fontSize:16,fontWeight:700,color:"#f1f5f9"}}>{pj.prospects.length}</p></div>
                      <div><p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",marginBottom:2}}>CA confirmé</p><p style={{fontSize:16,fontWeight:700,color:"#22c55e"}}>{pj.key==="print3d"?fmtBrl(ca):fmtEur(ca)}</p></div>
                      <div><p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",marginBottom:2}}>{pj.key==="print3d"?`Devis ${nbDevis} · Cmd ${nbCmd}`:"En cours"}</p><p style={{fontSize:16,fontWeight:700,color:"#f59e0b"}}>{active.length}</p></div>
                      <div><p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",marginBottom:2}}>En attente</p><p style={{fontSize:16,fontWeight:700,color:pending>0?"#f87171":"#374151"}}>{pending}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Visites site formationcarnaval.fr */}
            {(()=>{
              const visits = data?.siteVisits||[];
              if(visits.length===0) return null;
              const now=Date.now();
              const today=visits.filter(v=>now-v.at<86400000&&v.event==="pageview");
              const week=visits.filter(v=>now-v.at<7*86400000&&v.event==="pageview");
              const bookClicks=visits.filter(v=>v.event==="click_booking");
              const emailClicks=visits.filter(v=>v.event==="click_email");
              const engaged=visits.filter(v=>v.event==="engaged");
              const fromEmail=visits.filter(v=>v.utmSource==="amigo");
              const allProspectsFlat=[...(data?.makeup||[]),...(data?.vin||[]),...(data?.vinClients||[]),...(data?.print3d||[])];
              const findProspect=id=>allProspectsFlat.find(p=>p.id===id);
              const recentVisits=visits.filter(v=>["pageview","click_booking","click_email","engaged","section_view"].includes(v.event)).slice(-20).reverse();
              const eventIcon=e=>e==="click_booking"?"📅":e==="click_email"?"✉️":e==="engaged"?"🔥":e==="section_view"?"📍":"👁";
              const eventColor=e=>e==="click_booking"?"#22c55e":e==="click_email"?"#f59e0b":e==="engaged"?"#f97316":e==="section_view"?"#8b5cf6":"#60a5fa";
              const eventLabel=e=>e==="pageview"?"Visite":e==="click_booking"?"Clic Booking":e==="click_email"?"Clic Email":e==="engaged"?"Engagé":e==="section_view"?"Section vue":e;
              return (
                <div style={{background:"#0b0d16",border:"1px solid #ec489922",borderRadius:11,padding:16,marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <span style={{fontSize:14}}>📊</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#ec4899"}}>formationcarnaval.fr</span>
                    <span style={{fontSize:10,color:"#4b5563"}}>· {visits.filter(v=>v.event==="pageview").length} visites · {fromEmail.length} depuis emails</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:12}}>
                    {[
                      {label:"Aujourd'hui",value:today.length,color:"#f1f5f9"},
                      {label:"Cette semaine",value:week.length,color:"#60a5fa"},
                      {label:"Clics booking",value:bookClicks.length,color:"#22c55e"},
                      {label:"Clics email",value:emailClicks.length,color:"#f59e0b"},
                      {label:"Engagés",value:engaged.length,color:"#f97316"},
                    ].map(k=>(
                      <div key={k.label} style={{background:"#080a0f",borderRadius:8,padding:"10px 12px",border:"1px solid #0f1520"}}>
                        <p style={{fontSize:9,color:"#4b5563",textTransform:"uppercase",marginBottom:2}}>{k.label}</p>
                        <p style={{fontSize:18,fontWeight:700,color:k.color}}>{k.value}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{maxHeight:300,overflow:"auto"}}>
                  {recentVisits.map((v,i)=>{
                    const prospect=v.prospectId?findProspect(v.prospectId):null;
                    return (
                    <div key={i} onClick={()=>{if(prospect){setProjId("makeup");setView("kanban");setDetailProspect(prospect);}}}
                      style={{display:"flex",gap:8,alignItems:"center",padding:"6px 4px",borderBottom:"1px solid #0d1020",cursor:prospect?"pointer":"default",borderRadius:4}}
                      onMouseEnter={e=>{if(prospect)e.currentTarget.style.background="#0c1020";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                      <span style={{fontSize:12,color:eventColor(v.event)}}>{eventIcon(v.event)}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          <span style={{fontSize:11,fontWeight:600,color:eventColor(v.event)}}>{eventLabel(v.event)}</span>
                          {prospect&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:4,background:"#ec489918",color:"#ec4899",fontWeight:600}}>{prospect.name}</span>}
                          {!prospect&&v.utmSource==="amigo"&&<span style={{fontSize:10,color:"#ec4899"}}>via email</span>}
                          {v.ref&&v.ref!=="direct"&&!v.utmSource&&<span style={{fontSize:10,color:"#4b5563"}}>via {v.ref.replace(/https?:\/\//,"").split("/")[0]}</span>}
                        </div>
                        <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
                          {v.city&&<span style={{fontSize:10,color:"#e2e8f0",background:"#1e1b4b",padding:"1px 6px",borderRadius:3,fontWeight:600}}>📍 {v.city}{v.country&&v.country!=="France"?", "+v.country:""}</span>}
                          {v.isp&&<span style={{fontSize:10,color:"#94a3b8",background:"#0f1520",padding:"1px 5px",borderRadius:3}}>🏢 {v.isp}</span>}
                          {v.device&&<span style={{fontSize:10,color:"#94a3b8",background:"#0f1520",padding:"1px 5px",borderRadius:3}}>💻 {v.device}</span>}
                          {v.browser&&<span style={{fontSize:10,color:"#94a3b8",background:"#0f1520",padding:"1px 5px",borderRadius:3}}>🌐 {v.browser}</span>}
                          {v.lang&&<span style={{fontSize:10,color:"#94a3b8",background:"#0f1520",padding:"1px 5px",borderRadius:3}}>🗣 {v.lang.slice(0,5)}</span>}
                          {v.screen&&<span style={{fontSize:10,color:"#94a3b8",background:"#0f1520",padding:"1px 5px",borderRadius:3}}>📐 {v.screen}</span>}
                          {v.timeOnPage>0&&<span style={{fontSize:10,color:"#60a5fa",background:"#0f1520",padding:"1px 5px",borderRadius:3}}>⏱ {v.timeOnPage}s</span>}
                          {v.scrollPct>0&&<span style={{fontSize:10,color:"#a78bfa",background:"#0f1520",padding:"1px 5px",borderRadius:3}}>📜 scroll {v.scrollPct}%</span>}
                          {v.event==="section_view"&&v.extra&&<span style={{fontSize:10,color:"#8b5cf6",background:"#0f1520",padding:"1px 5px",borderRadius:3}}>📍 {v.extra}</span>}
                          {v.extra&&typeof v.extra==="string"&&v.extra.includes("scroll")&&<span style={{fontSize:10,color:"#f97316",background:"#1f0a0a",padding:"1px 5px",borderRadius:3}}>🔥 {v.extra}</span>}
                        </div>
                      </div>
                      <span style={{fontSize:10,color:"#374151",flexShrink:0}}>{ago(v.at)}</span>
                      {prospect&&<span style={{fontSize:11,color:"#374151"}}>›</span>}
                    </div>
                    );
                  })}
                  </div>
                </div>
              );
            })()}

            {/* Relances devis en attente */}
            {(()=>{
              const pendingQuotes = allOrders.filter(o=>o.type==="devis"&&o.status==="Envoyé").map(o=>{
                const daysSince = o.createdAt ? Math.floor((Date.now()-o.createdAt)/86400000) : 0;
                const proj = PROJECTS[o.proj];
                const prospect = allProjects.flatMap(pj=>pj.prospects).find(p=>p.id===o.prospectId);
                return {...o, daysSince, projIcon:proj?.icon||"", projColor:proj?.color||"#6b7280", prospect};
              }).sort((a,b)=>b.daysSince-a.daysSince);
              const urgent = pendingQuotes.filter(q=>q.daysSince>=3);
              if (urgent.length===0 && needsFollowUp.length===0) return null;
              return (
              <div style={{background:"#0b0d16",border:"1px solid #ef444422",borderRadius:11,padding:16,marginBottom:20}}>
                <p style={{fontSize:12,fontWeight:700,color:"#f87171",marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>🔔 Relances à faire ({urgent.length + needsFollowUp.length})</p>

                {/* Devis sans réponse */}
                {urgent.length>0&&<>
                  <p style={{fontSize:10,color:"#f59e0b",fontWeight:600,marginBottom:6}}>📋 Devis envoyés sans réponse</p>
                  <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:needsFollowUp.length>0?12:0}}>
                    {urgent.map(q=>(
                      <div key={q.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:7,background:"#f59e0b08",border:"1px solid #f59e0b15"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#f59e0b12"}
                        onMouseLeave={e=>e.currentTarget.style.background="#f59e0b08"}>
                        <span style={{fontSize:12}}>{q.projIcon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:11,fontWeight:600,color:"#f1f5f9"}}>{q.prospectName} — {q.product}</p>
                          <p style={{fontSize:10,color:"#4b5563"}}>{q.proj==="print3d"?fmtBrl(q.amount*(q.qty||1)):fmtEur(q.amount*(q.qty||1))}</p>
                        </div>
                        <span style={{fontSize:10,color:q.daysSince>=7?"#ef4444":"#f59e0b",fontWeight:700,whiteSpace:"nowrap"}}>{q.daysSince}j</span>
                        <button onClick={(e)=>{e.stopPropagation();setProjId(q.proj);setView("commandes");setDetailOrder(q);}}
                          style={{padding:"4px 8px",borderRadius:4,fontSize:10,fontWeight:600,background:"#f59e0b18",border:"1px solid #f59e0b28",color:"#fbbf24",cursor:"pointer",whiteSpace:"nowrap"}}>
                          Voir
                        </button>
                        {q.prospect?.email&&<button onClick={async(e)=>{
                          e.stopPropagation();
                          const body = `Prezado(a)${q.prospect.contact?` ${q.prospect.contact.split(" ")[0]}`:""},\n\nGostaria de saber se teve a oportunidade de avaliar o orçamento que enviamos para ${q.product}.\n\nEstamos à disposição para qualquer ajuste ou esclarecimento.\n\nAtenciosamente,\nAnthony Donzel\n${EMPRESA.nome} · ${EMPRESA.tel}`;
                          const ok = await sendGmail({to:q.prospect.email, subject:`Re: Orçamento ${q.product} — ${EMPRESA.nome}`, body, from:PROJECT_EMAIL[q.proj]});
                          if(ok) setNotif({id:Date.now(),by:user,byLabel:"✓",prospectName:q.prospectName,action:"relance envoyée"});
                        }}
                          style={{padding:"4px 8px",borderRadius:4,fontSize:10,fontWeight:600,background:"#8b5cf618",border:"1px solid #8b5cf628",color:"#a78bfa",cursor:"pointer",whiteSpace:"nowrap"}}>
                          📩 Relancer
                        </button>}
                      </div>
                    ))}
                  </div>
                </>}

                {/* Prospects sans réponse email */}
                {needsFollowUp.length>0&&<>
                  <p style={{fontSize:10,color:"#ef4444",fontWeight:600,marginBottom:6}}>✉️ Prospects sans réponse email (14j+)</p>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {needsFollowUp.slice(0,6).map(p=>(
                      <div key={p.id} onClick={()=>{setProjId(p._projKey);setView("kanban");setDetailProspect(p);}}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:7,cursor:"pointer",background:"#ef444408"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#ef444415"}
                        onMouseLeave={e=>e.currentTarget.style.background="#ef444408"}>
                        <span style={{fontSize:12}}>{p._projIcon}</span>
                        <span style={{fontSize:12,fontWeight:600,color:"#f1f5f9",flex:1}}>{p.name}</span>
                        <span style={{fontSize:10,color:"#f87171"}}>Sans réponse 14j+</span>
                      </div>
                    ))}
                  </div>
                </>}
              </div>
              );
            })()}

            {/* Activité récente */}
            <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,padding:16}}>
              <p style={{fontSize:12,fontWeight:700,color:"#f1f5f9",marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>📊 Activité récente</p>
              {recentActs.length===0
                ? <p style={{fontSize:12,color:"#374151",textAlign:"center",padding:20}}>Aucune activité</p>
                : <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {recentActs.map(a=>{
                      const isSys = a.by === "system";
                      const projIcon = PROJECTS[a.proj]?.icon || "";
                      return (
                      <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:6,background:isSys?"#22c55e08":"transparent"}}>
                        <span style={{width:20,height:20,borderRadius:"50%",background:isSys?"#22c55e":USERS[a.by]?.color||"#6b7280",display:"flex",alignItems:"center",justifyContent:"center",fontSize:isSys?10:8,fontWeight:700,color:"white",flexShrink:0}}>{isSys?"📬":USERS[a.by]?.avatar||"?"}</span>
                        <span style={{fontSize:11,color:"#94a3b8",flex:1}}>{projIcon} <b style={{color:isSys?"#4ade80":USERS[a.by]?.color}}>{a.byLabel||a.by}</b> {a.action} <span style={{color:"#f1f5f9"}}>{a.prospectName}</span></span>
                        <span style={{fontSize:9,color:"#94a3b8",whiteSpace:"nowrap"}}>{new Date(a.at).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})} · {ago(a.at)}</span>
                      </div>);
                    })}
                  </div>
              }
            </div>
          </div>
          );
        })()}

        {/* ══ KANBAN ══ */}
        {view==="kanban"&&(
          <div className="fade">
            {projId==="makeup"&&(
              <div style={{background:"linear-gradient(135deg,#180a18,#0d1020)",border:"1px solid #be185d22",borderRadius:11,padding:"12px 16px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
                    <span style={{fontSize:11,fontWeight:700,color:"#ec4899",textTransform:"uppercase",letterSpacing:"1px"}}>Offre active</span>
                    <span style={{fontSize:10,background:"#22c55e12",color:"#4ade80",padding:"1px 6px",borderRadius:4,fontWeight:600}}>✓ Contrat Gall</span>
                  </div>
                  <p style={{fontSize:13,fontWeight:600,color:"#f9a8d4"}}>Package Carnaval Rio · Madame Gall · 5 jours · Hébergement Ipanema · Fév. 2026</p>
                </div>
                <div style={{textAlign:"right"}}><p style={{fontSize:20,fontWeight:700,color:"#f9a8d4"}}>3 500€</p><p style={{fontSize:10,color:"#374151"}}>/élève · 6–10 pers.</p></div>
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
              <StatCard label="Prospects" value={prospects.length} sub="au total" color="#60a5fa" icon="👥" onClick={()=>setView("kanban")}/>
              <StatCard label={projId==="print3d"?`Devis ${activeDevis.length} · Cmd ${activeCommandes.length}`:"Commandes"} value={activeOrders.length} sub={activeDevis.length>0?`${$(activeDevis.reduce((s,o)=>s+o.amount*(o.qty||1),0))} en devis`:`${$(totalCA)} CA`} color="#f59e0b" icon="📦" onClick={()=>setView("commandes")}/>
            </div>

            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button onClick={()=>setShowAddProspect(true)} className="btn"
                style={{padding:"8px 13px",background:`${accent}18`,border:`1px solid ${accent}28`,borderRadius:8,color:accent,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                + {projId==="print3d"?"Nouveau client":projId==="vin"?"Nouveau contact":"École"}
              </button>
              <button onClick={()=>setShowAddOrder(null)} className="btn"
                style={{padding:"8px 13px",background:"#22c55e15",border:"1px solid #22c55e28",borderRadius:8,color:"#4ade80",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                + {projId==="print3d"?"Devis / Commande":"Commande"}
              </button>
              {projId==="vin" && (
                <label className="btn" style={{padding:"8px 13px",background:"#f59e0b15",border:"1px solid #f59e0b28",borderRadius:8,color:"#fbbf24",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                  📥 Importer XLS
                  <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0])importXLS(e.target.files[0]);e.target.value="";}}/>
                </label>
              )}
              <button onClick={async()=>{
                // Sync statuts depuis emails sauvegardés
                const emails = data?.prospectEmails||{};
                const projs = ["makeup","vin","vinClients","print3d"];
                let nd = {...data}; let changed=false;
                projs.forEach(pk=>{
                  if(!nd[pk]) return;
                  nd[pk]=nd[pk].map(p=>{
                    const pe=emails[p.id]||[];
                    if(!pe.length) return p;
                    const sent=pe.some(e=>e.folder==="Envoyés");
                    const recu=pe.some(e=>e.folder==="Reçus");
                    const P2=PROJECTS[pk]||PROJECTS.vin;
                    let ns=p.status;
                    if(sent&&recu&&p.status==="Contacté"){const neg=P2.statuses?.find(s=>s.match(/négociation|discussion/i));if(neg)ns=neg;}
                    else if(sent&&p.status==="À contacter")ns="Contacté";
                    if(ns!==p.status){changed=true;return{...p,status:ns};}
                    return p;
                  });
                });
                if(changed){await save(nd);setNotif("✅ Statuts mis à jour !");}
                else setNotif("✓ Statuts déjà à jour");
              }} className="btn" style={{padding:"8px 13px",background:"#3b82f615",border:"1px solid #3b82f628",borderRadius:8,color:"#60a5fa",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                🔄 Sync statuts
              </button>
            </div>

            {/* KANBAN */}
            <div style={{display:"flex",gap:11,overflowX:"auto",paddingBottom:14}}>
              {(()=>{
                // Pour vin : fusionner les statuts fournisseurs + clients
                const allStatuses = projId==="vin"
                  ? [...new Set([...PROJECTS.vin.statuses, ...PROJECTS.vinClients.statuses])]
                  : P.statuses;
                const allStatusColors = projId==="vin"
                  ? {...PROJECTS.vin.statusColors, ...PROJECTS.vinClients.statusColors}
                  : P.statusColors;
                // Statuts valides par sous-projet (vin: fournisseurs vs clients)
                const vinFourStatuses = new Set(PROJECTS.vin.statuses);
                const vinClientStatuses = new Set(PROJECTS.vinClients.statuses);

                const handleDrop = (targetStatus) => (e) => {
                  e.preventDefault();
                  e.currentTarget.style.background = "";
                  const pid = e.dataTransfer.getData("prospectId");
                  const pProj = e.dataTransfer.getData("prospectProj");
                  if (!pid) return;

                  // Vin : vérifier que le statut cible est valide pour le type de prospect
                  if (projId === "vin") {
                    const isFour = pProj === "vin";
                    const isCli = pProj === "vinClients";
                    if (isFour && !vinFourStatuses.has(targetStatus)) return;
                    if (isCli && !vinClientStatuses.has(targetStatus)) return;
                  }

                  updateProspect(pid, { status: targetStatus });
                };

                return allStatuses.map(status=>{
                const cards = prospects.filter(p=>p.status===status);
                const col = allStatusColors[status]||"#6b7280";
                const colVal = cards.reduce((s,p)=>s+p.valeur,0);
                return (
                  <div key={status} style={{minWidth:215,maxWidth:235,flexShrink:0}}
                    onDragOver={e=>{e.preventDefault();e.currentTarget.style.background=`${col}08`;}}
                    onDragLeave={e=>{e.currentTarget.style.background="";}}
                    onDrop={handleDrop(status)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9,padding:"6px 10px",background:`${col}12`,borderRadius:7,border:`1px solid ${col}22`}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"inline-block"}}/>
                        <span style={{fontSize:11,fontWeight:600,color:col}}>{status}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>

                        <span style={{fontSize:10,fontWeight:700,color:"#4b5563",background:"#0b0d16",padding:"1px 6px",borderRadius:10}}>{cards.length}</span>
                      </div>
                    </div>
                    <div style={{minHeight:60,borderRadius:8,transition:"background .15s"}}>
                      {cards.map(p=>(
                        <KanbanCard key={p.id} prospect={p} accent={accent} onOpen={setDetailProspect} prospectEmails={data?.prospectEmails||{}}/>
                      ))}
                      {cards.length===0&&(
                        <div style={{padding:"20px 10px",textAlign:"center",border:"1px dashed #0f1520",borderRadius:8,color:"#2d3748",fontSize:11}}>Vide</div>
                      )}
                    </div>
                  </div>
                );
              });})()}
            </div>
          </div>
        )}
        {view==="commandes"&&(
          <div className="fade">
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,marginBottom:14}}>
              <StatCard label="Pipe devis" value={$(activeDevis.reduce((s,o)=>s+o.amount*(o.qty||1),0))} sub={`${activeDevis.length} devis en cours`} color="#f59e0b" icon="📋" onClick={()=>setView("commandes")}/>
              <StatCard label="CA confirmé" value={$(totalCA)} sub={`${activeCommandes.length} commandes`} color="#22c55e" icon="✅" onClick={()=>setView("finance")}/>
              {projId==="vin"
                ? <StatCard label="Taxes BR" value={$(projOrders.reduce((s,o)=>s+(o.taxData?.totalEur||0),0))} color="#ef4444" icon="🇧🇷" onClick={()=>setView("finance")}/>
                : <StatCard label="Marge CA" value={$(totalCA*(projId==="print3d"?0.45:0.35))} sub="est. 45%" color="#a78bfa" icon="📈" onClick={()=>setView("finance")}/>
              }
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:12}}>
              {projId==="print3d"&&(
                <button onClick={()=>setShowCalculateur(s=>!s)} className="btn"
                  style={{padding:"8px 14px",background:showCalculateur?"#14b8a618":"#14b8a60a",border:`1px solid ${showCalculateur?"#14b8a640":"#14b8a620"}`,borderRadius:8,color:"#2dd4bf",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  🧊 Calculateur
                </button>
              )}
              <button onClick={()=>setShowAddOrder(null)} className="btn"
                style={{padding:"8px 14px",background:"#22c55e15",border:"1px solid #22c55e28",borderRadius:8,color:"#4ade80",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                + {projId==="print3d"?"Devis / Commande":"Nouvelle commande"}
              </button>
            </div>
            {/* Pipeline devis drag & drop */}
            {activeDevis.length > 0 && (
              <div style={{marginBottom:16}}>
                <p style={{fontSize:11,fontWeight:700,color:"#a78bfa",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>📋 Pipeline devis</p>
                <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
                  {QUOTE_STATUSES.filter(s=>!["Annulé"].includes(s)).map(status=>{
                    const cards = activeDevis.filter(o=>o.status===status);
                    const stColor = {Brouillon:"#6b7280",Envoyé:"#3b82f6",Accepté:"#22c55e",Refusé:"#ef4444",Expiré:"#f59e0b"}[status]||"#6b7280";
                    return (
                      <div key={status} style={{minWidth:160,flex:1}}
                        onDragOver={e=>{e.preventDefault();e.currentTarget.style.background=`${stColor}08`;}}
                        onDragLeave={e=>{e.currentTarget.style.background="";}}
                        onDrop={e=>{e.preventDefault();e.currentTarget.style.background="";const oid=e.dataTransfer.getData("orderId");if(oid)updateOrder(oid,{status});}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,padding:"4px 8px",background:`${stColor}12`,borderRadius:6,border:`1px solid ${stColor}22`}}>
                          <span style={{fontSize:10,fontWeight:600,color:stColor}}>{status}</span>
                          <span style={{fontSize:9,fontWeight:700,color:"#4b5563",background:"#080a0f",padding:"1px 5px",borderRadius:8}}>{cards.length}</span>
                        </div>
                        <div style={{minHeight:50}}>
                          {cards.map(o=>(
                            <div key={o.id} draggable
                              onDragStart={e=>{e.dataTransfer.setData("orderId",o.id);e.dataTransfer.effectAllowed="move";e.currentTarget.style.opacity="0.4";}}
                              onDragEnd={e=>{e.currentTarget.style.opacity="1";}}
                              onClick={()=>setDetailOrder(o)}
                              style={{background:"#0d1120",border:`1px solid ${stColor}25`,borderLeft:`3px solid ${stColor}`,borderRadius:7,padding:"8px 10px",marginBottom:5,cursor:"grab",transition:"background .12s"}}
                              onMouseEnter={e=>e.currentTarget.style.background="#111828"}
                              onMouseLeave={e=>e.currentTarget.style.background="#0d1120"}>
                              <p style={{fontSize:11,fontWeight:600,color:"#f1f5f9",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.prospectName}</p>
                              <p style={{fontSize:10,color:"#4b5563",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.product}</p>
                              <p style={{fontSize:11,fontWeight:700,color:"#22c55e",marginTop:3}}>{$(o.amount*(o.qty||1))}</p>
                            </div>
                          ))}
                          {cards.length===0&&<div style={{padding:"14px 8px",textAlign:"center",border:"1px dashed #0f1520",borderRadius:6,color:"#2d3748",fontSize:10}}>Vide</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pipeline commandes drag & drop */}
            {activeCommandes.length > 0 && (
              <div style={{marginBottom:16}}>
                <p style={{fontSize:11,fontWeight:700,color:"#22c55e",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>📦 Pipeline commandes</p>
                <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
                  {ORDER_STATUSES.filter(s=>s!=="Annulée").map(status=>{
                    const cards = activeCommandes.filter(o=>o.status===status);
                    const stColor = {"En attente":"#6b7280","Confirmée":"#3b82f6","En production":"#f59e0b","Livré":"#8b5cf6","Facturé":"#22c55e"}[status]||"#6b7280";
                    return (
                      <div key={status} style={{minWidth:145,flex:1}}
                        onDragOver={e=>{e.preventDefault();e.currentTarget.style.background=`${stColor}08`;}}
                        onDragLeave={e=>{e.currentTarget.style.background="";}}
                        onDrop={e=>{e.preventDefault();e.currentTarget.style.background="";const oid=e.dataTransfer.getData("orderId");if(oid)updateOrder(oid,{status});}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,padding:"4px 8px",background:`${stColor}12`,borderRadius:6,border:`1px solid ${stColor}22`}}>
                          <span style={{fontSize:10,fontWeight:600,color:stColor}}>{status}</span>
                          <span style={{fontSize:9,fontWeight:700,color:"#4b5563",background:"#080a0f",padding:"1px 5px",borderRadius:8}}>{cards.length}</span>
                        </div>
                        <div style={{minHeight:40}}>
                          {cards.map(o=>(
                            <div key={o.id} draggable
                              onDragStart={e=>{e.dataTransfer.setData("orderId",o.id);e.dataTransfer.effectAllowed="move";e.currentTarget.style.opacity="0.4";}}
                              onDragEnd={e=>{e.currentTarget.style.opacity="1";}}
                              onClick={()=>setDetailOrder(o)}
                              style={{background:"#0d1120",border:`1px solid ${stColor}25`,borderLeft:`3px solid ${stColor}`,borderRadius:7,padding:"6px 10px",marginBottom:4,cursor:"grab"}}
                              onMouseEnter={e=>e.currentTarget.style.background="#111828"}
                              onMouseLeave={e=>e.currentTarget.style.background="#0d1120"}>
                              <p style={{fontSize:10,fontWeight:600,color:"#f1f5f9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.prospectName}</p>
                              <p style={{fontSize:10,fontWeight:700,color:"#22c55e"}}>{$(o.amount*(o.qty||1))}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(()=>{
              const devis = projId==="print3d" ? activeDevis : [];
              const devisArchives = projId==="print3d" ? archivedOrders.filter(o=>o.type==="devis") : [];
              const commandes = projId==="print3d" ? activeCommandes : activeOrders.filter(o=>o.type!=="devis");
              const cmdArchives = projId==="print3d" ? archivedOrders.filter(o=>o.type!=="devis") : archivedOrders.filter(o=>o.type!=="devis");
              const renderTable = (rows, isDevis) => (
                <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr>
                      <th>Client / Prospect</th><th>Produit</th>
                      <th>Qté</th><th>Montant</th>
                      {projId==="vin"&&<th>Taxes BR</th>}
                      <th>Date</th><th>Statut</th>
                      {isDevis&&<th></th>}
                    </tr></thead>
                    <tbody>{rows.map(o=>{
                      const total = o.amount * (o.qty||1);
                      return (
                      <tr key={o.id} onClick={()=>setDetailOrder(o)} style={{cursor:"pointer"}}>
                        <td style={{color:"#f1f5f9",fontWeight:500,display:"flex",alignItems:"center",gap:8}}>
                          {o.thumbnail&&<img src={o.thumbnail} alt="" style={{width:32,height:32,borderRadius:4,objectFit:"cover",border:"1px solid #1a2035"}}/>}
                          {o.prospectName||"–"}
                        </td>
                        <td>{o.product||"–"}</td>
                        <td style={{color:"#6b7280"}}>{o.qty||1}</td>
                        <td style={{color:"#22c55e",fontWeight:700}}>{$(total)}{(o.qty||1)>1&&<span style={{fontSize:9,color:"#4b5563",marginLeft:4}}>({$(o.amount)}/u)</span>}</td>
                        {projId==="vin"&&<td style={{color:"#ef4444"}}>{o.taxData?fmt(o.taxData.totalEur):"–"}</td>}
                        <td style={{color:"#6b7280"}}>{o.date||"–"}</td>
                        <td>
                          <select value={o.status} onChange={e=>updateOrder(o.id,{status:e.target.value})}
                            style={{padding:"3px 6px",borderRadius:5,fontSize:10,outline:"none",cursor:"pointer",background:"#0b0d16",border:"1px solid #1a2035",color:"#f1f5f9",fontFamily:"inherit"}}>
                            {(isDevis?QUOTE_STATUSES:ORDER_STATUSES).map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        {isDevis&&<td>
                          {o.status==="Accepté"&&(
                            <button onClick={()=>{updateOrder(o.id,{type:"commande",status:"En attente"});celebrate();}} className="btn"
                              style={{padding:"3px 8px",borderRadius:5,fontSize:10,fontWeight:600,cursor:"pointer",background:"#22c55e15",border:"1px solid #22c55e28",color:"#4ade80",whiteSpace:"nowrap"}}>
                              → Commande
                            </button>
                          )}
                        </td>}
                      </tr>
                    );})}</tbody>
                  </table>
                </div>
              );
              if (projId==="print3d") return (<>
                <div style={{marginBottom:6}}>
                  <p style={{fontSize:11,fontWeight:700,color:"#14b8a6",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>📋 Devis ({devis.length})</p>
                  {devis.length===0
                    ? <p style={{fontSize:12,color:"#374151",textAlign:"center",padding:"20px"}}>Aucun devis. Utilise le calculateur pour en créer un.</p>
                    : renderTable(devis, true)}
                </div>
                <div style={{marginTop:16}}>
                  <p style={{fontSize:11,fontWeight:700,color:"#22c55e",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>📦 Commandes ({commandes.length})</p>
                  {commandes.length===0
                    ? <p style={{fontSize:12,color:"#374151",textAlign:"center",padding:"20px"}}>Aucune commande. Passe un devis accepté en commande.</p>
                    : renderTable(commandes, false)}
                </div>
                {(devisArchives.length>0||cmdArchives.length>0)&&(
                  <details style={{marginTop:20}}>
                    <summary style={{fontSize:11,fontWeight:600,color:"#4b5563",cursor:"pointer",padding:"8px 0"}}>
                      🗄 Archives ({devisArchives.length + cmdArchives.length} terminés/annulés)
                    </summary>
                    <div style={{marginTop:8,opacity:0.6}}>
                      {devisArchives.length>0&&<><p style={{fontSize:10,color:"#4b5563",marginBottom:6}}>Devis archivés</p>{renderTable(devisArchives, true)}</>}
                      {cmdArchives.length>0&&<><p style={{fontSize:10,color:"#4b5563",marginBottom:6,marginTop:10}}>Commandes archivées</p>{renderTable(cmdArchives, false)}</>}
                    </div>
                  </details>
                )}
              </>);
              return projOrders.length===0
                ? <div style={{textAlign:"center",padding:"60px",color:"#2d3748"}}><p style={{fontSize:28,marginBottom:8}}>📦</p><p style={{fontSize:12}}>Aucune commande pour l'instant.</p></div>
                : renderTable(commandes, false);
            })()}
            {projId==="print3d"&&(
              <div style={{marginTop:18,display:showCalculateur?"block":"none"}}>
                <Print3DCalculator prospects={prospects} orders={projOrders} onSaveQuote={addOrder} onSaveWithNewClient={addProspectAndOrder} filamentStock={data?.filamentStock||[]} onUpdateStock={updateFilamentStock}/>
              </div>
            )}
          </div>
        )}

        {/* ══ FINANCE ══ */}
        {view==="finance"&&(
          <div className="fade">
            {/* ── 1. KPIs ── */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,marginBottom:16}}>
              <StatCard label="Devis en cours" value={$(activeDevis.reduce((s,o)=>s+o.amount*(o.qty||1),0))} sub={`${activeDevis.length} devis`} color="#f59e0b" icon="📋" onClick={()=>setView("commandes")}/>
              <StatCard label="CA confirmé" value={$(totalCA)} sub={`${activeCommandes.length} commandes`} color="#22c55e" icon="💶" onClick={()=>setView("commandes")}/>
              <StatCard label={projId==="vin"?"Taxes import BR":"TVA est."} value={$(projId==="vin"?projOrders.reduce((s,o)=>s+(o.taxData?.totalEur||0),0):totalCA*0.20)} color="#ef4444" icon="🏛" onClick={()=>setView("commandes")}/>
              <StatCard label="Marge nette est." value={$(totalCA*(projId==="vin"?0.30:projId==="print3d"?0.45:0.35))} sub={`~${projId==="vin"?"30":projId==="print3d"?"45":"35"}%`} color="#a78bfa" icon="📈" onClick={()=>setView("commandes")}/>
            </div>

            {/* ── 2. CA par mois (SVG bar chart) + 6. Panier moyen / délai moyen ── */}
            {(()=>{
              const MOIS=["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
              const caStatuses=["Confirmée","En production","Livré","Facturé"];
              const cmds=projOrders.filter(o=>o.type!=="devis"&&caStatuses.includes(o.status)&&o.date);
              const now=new Date();
              const months=[];
              for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({y:d.getFullYear(),m:d.getMonth(),label:MOIS[d.getMonth()]});}
              const buckets=months.map(({y,m,label})=>{
                const prefix=`${y}-${String(m+1).padStart(2,"0")}`;
                const tot=cmds.filter(o=>o.date&&o.date.startsWith(prefix)).reduce((s,o)=>s+o.amount*(o.qty||1),0);
                return{label,total:tot};
              });
              const maxVal=Math.max(...buckets.map(b=>b.total),1);
              const chartH=180,barW=48,gap=16,padL=50,padB=28,padT=24;
              const totalW=padL+buckets.length*(barW+gap);
              // Panier moyen
              const panierMoyen=cmds.length>0?cmds.reduce((s,o)=>s+o.amount*(o.qty||1),0)/cmds.length:0;
              // Délai moyen (jours entre createdAt et date de livraison pour les Livré/Facturé)
              const delivered=cmds.filter(o=>["Livré","Facturé"].includes(o.status)&&o.createdAt&&o.date);
              const avgDelai=delivered.length>0?Math.round(delivered.reduce((s,o)=>{const d1=new Date(o.createdAt);const d2=new Date(o.date);return s+Math.max(0,Math.floor((d2-d1)/(1000*60*60*24)));},0)/delivered.length):0;
              return(<>
                <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,padding:18,marginBottom:12}}>
                  <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",marginBottom:14}}>📊 CA par mois (6 derniers mois)</p>
                  {cmds.length===0
                    ? <p style={{fontSize:12,color:"#374151",textAlign:"center",padding:"30px"}}>Aucune commande confirmée avec date.</p>
                    : <svg width="100%" viewBox={`0 0 ${totalW} ${chartH+padB+padT}`} style={{overflow:"visible"}}>
                        {/* Y-axis lines */}
                        {[0,0.25,0.5,0.75,1].map(f=>{const y=padT+chartH*(1-f);return(
                          <g key={f}><line x1={padL-4} y1={y} x2={totalW} y2={y} stroke="#0f1520" strokeWidth={1}/>
                          <text x={padL-8} y={y+3} textAnchor="end" fill="#4b5563" fontSize={9}>{$(Math.round(maxVal*f))}</text></g>
                        );})}
                        {/* Bars */}
                        {buckets.map((b,i)=>{
                          const x=padL+i*(barW+gap);
                          const h=b.total>0?(b.total/maxVal)*chartH:0;
                          const y=padT+chartH-h;
                          return(<g key={i}>
                            <rect x={x} y={y} width={barW} height={h} rx={4} fill={accent} opacity={0.85}/>
                            {b.total>0&&<text x={x+barW/2} y={y-6} textAnchor="middle" fill="#e2e8f0" fontSize={10} fontWeight={600}>{$(b.total)}</text>}
                            <text x={x+barW/2} y={padT+chartH+16} textAnchor="middle" fill="#6b7280" fontSize={10}>{b.label}</text>
                          </g>);
                        })}
                      </svg>
                  }
                </div>
                {/* Panier moyen + Délai moyen */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,padding:16,textAlign:"center"}}>
                    <p style={{fontSize:10,color:"#4b5563",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Panier moyen</p>
                    <p style={{fontSize:22,fontWeight:700,color:"#f1f5f9"}}>{$(Math.round(panierMoyen))}</p>
                    <p style={{fontSize:10,color:"#4b5563",marginTop:2}}>{cmds.length} commande{cmds.length!==1?"s":""}</p>
                  </div>
                  <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,padding:16,textAlign:"center"}}>
                    <p style={{fontSize:10,color:"#4b5563",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Délai moyen</p>
                    <p style={{fontSize:22,fontWeight:700,color:"#f1f5f9"}}>{avgDelai} <span style={{fontSize:12,fontWeight:400,color:"#6b7280"}}>jours</span></p>
                    <p style={{fontSize:10,color:"#4b5563",marginTop:2}}>{delivered.length} livré{delivered.length!==1?"es":""}</p>
                  </div>
                </div>
              </>);
            })()}

            {/* ── 3. Conversion funnel ── */}
            {(()=>{
              const allDevis=projOrders.filter(o=>o.type==="devis");
              const devisEnvoyes=projOrders.filter(o=>o.type==="devis"&&["Envoyé","Accepté","Refusé","Expiré"].includes(o.status));
              const devisAcceptes=projOrders.filter(o=>o.type==="devis"&&o.status==="Accepté");
              const convertis=projOrders.filter(o=>o.type!=="devis"&&["Confirmée","En production","Livré","Facturé"].includes(o.status));
              const steps=[
                {label:"Devis créés",count:allDevis.length,color:"#6b7280"},
                {label:"Devis envoyés",count:devisEnvoyes.length,color:"#f59e0b"},
                {label:"Devis acceptés",count:devisAcceptes.length,color:"#22c55e"},
                {label:"Convertis en commandes",count:convertis.length,color:accent},
              ];
              const maxC=Math.max(...steps.map(s=>s.count),1);
              return(
                <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,padding:18,marginBottom:12}}>
                  <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",marginBottom:14}}>🔄 Funnel de conversion</p>
                  {steps.map((s,i)=>{const pct=allDevis.length>0?Math.round(s.count/allDevis.length*100):0;return(
                    <div key={i} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:11,color:"#e2e8f0",fontWeight:500}}>{s.label}</span>
                        <span style={{fontSize:11,color:"#4b5563"}}>{s.count} {i>0?`(${pct}%)`:""}</span>
                      </div>
                      <div style={{height:10,background:"#080a0f",borderRadius:5,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${maxC>0?s.count/maxC*100:0}%`,background:s.color,borderRadius:5,transition:"width .3s"}}/>
                      </div>
                    </div>
                  );})}
                </div>
              );
            })()}

            {/* ── 4. Top clients par CA ── */}
            {(()=>{
              const caStatuses=["Confirmée","En production","Livré","Facturé"];
              const cmds=projOrders.filter(o=>o.type!=="devis"&&caStatuses.includes(o.status));
              const byClient={};
              cmds.forEach(o=>{const n=o.prospectName||"Inconnu";byClient[n]=(byClient[n]||0)+o.amount*(o.qty||1);});
              const top=Object.entries(byClient).sort((a,b)=>b[1]-a[1]).slice(0,5);
              const topMax=top.length>0?top[0][1]:1;
              return top.length>0&&(
                <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,padding:18,marginBottom:12}}>
                  <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",marginBottom:14}}>🏆 Top clients par CA</p>
                  {top.map(([name,ca],i)=>(
                    <div key={name} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                        <span style={{fontSize:11,color:"#e2e8f0",fontWeight:500}}>
                          <span style={{color:accent,fontWeight:700,marginRight:6}}>#{i+1}</span>{name}
                        </span>
                        <span style={{fontSize:12,color:"#22c55e",fontWeight:700}}>{$(ca)}</span>
                      </div>
                      <div style={{height:6,background:"#080a0f",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${ca/topMax*100}%`,background:accent,borderRadius:3,opacity:1-i*0.12}}/>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── 5. Devis sans réponse — Relances proposées ── */}
            {(()=>{
              const now=Date.now();
              const threeDays=3*24*60*60*1000;
              const staleDevis=projOrders.filter(o=>o.type==="devis"&&o.status==="Envoyé"&&o.createdAt&&(now-o.createdAt)>threeDays);
              return staleDevis.length>0&&(
                <div style={{background:"#0b0d16",border:"1px solid #f59e0b18",borderRadius:11,padding:18,marginBottom:12}}>
                  <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",marginBottom:4}}>⏳ Devis sans réponse — Relances proposées</p>
                  <p style={{fontSize:10,color:"#4b5563",marginBottom:14}}>Devis envoyés depuis plus de 3 jours sans retour</p>
                  {staleDevis.map(o=>{
                    const days=Math.floor((now-o.createdAt)/(1000*60*60*24));
                    const linkedProspect=o.prospectId?["makeup","vin","vinClients","print3d"].reduce((found,k)=>found||(data?.[k]||[]).find(p=>p.id===o.prospectId),null):null;
                    return(
                      <div key={o.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:"#080a0f",borderRadius:8,border:"1px solid #0f1520",marginBottom:6}}>
                        <div style={{flex:1}}>
                          <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9"}}>{o.prospectName||"–"}</p>
                          <p style={{fontSize:10,color:"#4b5563"}}>{o.product||"–"} · {$(o.amount*(o.qty||1))} · <span style={{color:"#f59e0b"}}>{days}j depuis envoi</span></p>
                        </div>
                        <button onClick={()=>{
                          if(linkedProspect&&linkedProspect.email){
                            const contact=linkedProspect.contact||linkedProspect.name||o.prospectName||"";
                            const body=`Prezado(a) ${contact},\n\nGostaria de saber se teve a oportunidade de avaliar o orçamento que enviamos para ${o.product||"o projeto"}.\n\nEstamos à disposição para qualquer ajuste ou esclarecimento.\n\nAtenciosamente,\nAnthony Donzel`;
                            sendGmail({to:linkedProspect.email,subject:`Suivre: Orçamento ${o.product||""}`.trim(),body,from:null});
                          } else if(linkedProspect){
                            setShowEmailModal(linkedProspect);
                          } else {
                            setDetailOrder(o);
                          }
                        }} className="btn" style={{padding:"6px 14px",background:`${accent}18`,border:`1px solid ${accent}28`,borderRadius:7,color:accent,fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                          📩 Relancer
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── Wine tax simulator (vin only) ── */}
            {projId==="vin"&&(()=>{const t=calcTax(10000);return(
              <div style={{background:"#0b0d16",border:"1px solid #ef444418",borderRadius:11,padding:18,marginBottom:12}}>
                <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",marginBottom:3}}>🇧🇷 Simulateur taxes import vin — Brésil (base €10 000 FOB)</p>
                <p style={{fontSize:11,color:"#6b7280",marginBottom:14}}>II 27% + IPI 20% + PIS/COFINS 9,25% + ICMS RJ 30% · Taux effectif {t.txEffective}% du FOB</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9}}>
                  {[{l:"FOB",v:"€10 000",c:"#f1f5f9"},{l:"Taxes totales",v:fmt(t.totalEur),c:"#f87171"},{l:"Prix de revient",v:fmt(10000+t.totalEur),c:"#fbbf24"},{l:"Taux effectif",v:`${t.txEffective}%`,c:"#f87171"}].map(x=>(
                    <div key={x.l} style={{background:"#080a0f",borderRadius:8,padding:"10px 12px",border:"1px solid #0f1520"}}>
                      <p style={{fontSize:10,color:"#4b5563",marginBottom:4}}>{x.l}</p>
                      <p style={{fontSize:15,fontWeight:700,color:x.c}}>{x.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            );})()}

            {/* ── Detail table ── */}
            <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,overflow:"hidden"}}>
              <div style={{padding:"9px 14px",borderBottom:"1px solid #0d1020",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <p style={{fontSize:11,fontWeight:600,color:"#f1f5f9"}}>Détail par commande</p>
                <p style={{fontSize:10,color:"#4b5563"}}>{projOrders.length} entrée{projOrders.length!==1?"s":""}</p>
              </div>
              {projOrders.length===0
                ? <p style={{fontSize:12,color:"#374151",textAlign:"center",padding:"30px"}}>Aucune commande.</p>
                : <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:"1px solid #0f1520"}}>
                      <th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"#4b5563",fontWeight:600}}>Prospect</th>
                      <th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"#4b5563",fontWeight:600}}>Produit</th>
                      <th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"#4b5563",fontWeight:600}}>Montant</th>
                      {projId==="vin"&&<th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"#4b5563",fontWeight:600}}>Taxes</th>}
                      <th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"#4b5563",fontWeight:600}}>Marge est.</th>
                      <th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"#4b5563",fontWeight:600}}>Type</th>
                      <th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"#4b5563",fontWeight:600}}>Statut</th>
                      <th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"#4b5563",fontWeight:600}}>Date</th>
                    </tr></thead>
                    <tbody>{projOrders.map(o=>{const tot=o.amount*(o.qty||1);const mPct=projId==="vin"?0.30:projId==="print3d"?0.45:0.35;return(
                      <tr key={o.id} onClick={()=>setDetailOrder(o)} style={{cursor:"pointer",borderBottom:"1px solid #080a0f",transition:"background .12s"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#0d102040"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"8px 12px",color:"#f1f5f9",fontWeight:500,fontSize:12}}>{o.prospectName||"–"}</td>
                        <td style={{padding:"8px 12px",color:"#9ca3af",fontSize:11}}>{o.product||"–"}</td>
                        <td style={{padding:"8px 12px",color:"#22c55e",fontWeight:700,fontSize:12,textAlign:"right"}}>{$(tot)}</td>
                        {projId==="vin"&&<td style={{padding:"8px 12px",color:"#ef4444",fontSize:11,textAlign:"right"}}>{o.taxData?fmt(o.taxData.totalEur):"–"}</td>}
                        <td style={{padding:"8px 12px",color:"#a78bfa",fontSize:11,textAlign:"right"}}>{$(Math.round(tot*mPct))}</td>
                        <td style={{padding:"8px 12px",fontSize:10}}><span style={{padding:"2px 7px",borderRadius:4,background:o.type==="devis"?"#f59e0b15":"#22c55e15",color:o.type==="devis"?"#f59e0b":"#22c55e",fontWeight:600}}>{o.type==="devis"?"Devis":"Cmd"}</span></td>
                        <td style={{padding:"8px 12px",color:"#f59e0b",fontSize:11,fontWeight:500}}>{o.status}</td>
                        <td style={{padding:"8px 12px",color:"#4b5563",fontSize:10}}>{o.date||"–"}</td>
                      </tr>
                    );})}</tbody>
                  </table>
              }
            </div>
          </div>
        )}


        {/* ══ BLENDER 3D STUDIO ══ */}
        {view==="blender"&&projId==="print3d"&&(
          <BlenderStudio/>
        )}

        {/* ══ STOCK FILAMENT ══ */}
        {view==="stock"&&projId==="print3d"&&(()=>{
          const stock = data?.filamentStock||[];
          const totalRemaining = stock.reduce((s,f)=>s+(f.weightTotal-(f.weightUsed||0)),0);
          const totalUsed = stock.reduce((s,f)=>s+(f.weightUsed||0),0);
          return (
          <div className="fade">
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
              <StatCard label="Bobines" value={stock.length} sub="en stock" color="#14b8a6" icon="🧵" onClick={()=>setView("stock")}/>
              <StatCard label="Restant" value={`${Math.round(totalRemaining)}g`} sub={`${(totalRemaining/1000).toFixed(1)}kg`} color="#22c55e" icon="📦" onClick={()=>setView("stock")}/>
              <StatCard label="Utilisé" value={`${Math.round(totalUsed)}g`} sub={`${(totalUsed/1000).toFixed(1)}kg`} color="#f59e0b" icon="📊" onClick={()=>setView("stock")}/>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10,marginBottom:16}}>
              {stock.map(s=>{
                const remaining = s.weightTotal - (s.weightUsed||0);
                const pct = remaining / s.weightTotal * 100;
                const low = pct < 20;
                return (
                  <div key={s.id} style={{background:"#0b0d16",border:`1px solid ${low?"#ef444430":"#0f1520"}`,borderRadius:10,padding:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <span style={{width:24,height:24,borderRadius:"50%",background:s.hex,border:"3px solid #ffffff20",flexShrink:0}}/>
                      <div>
                        <p style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{s.color}</p>
                        <p style={{fontSize:10,color:"#4b5563"}}>{s.material} · {s.weightTotal}g</p>
                      </div>
                    </div>
                    {/* Jauge */}
                    <div style={{height:8,background:"#1a2035",borderRadius:4,overflow:"hidden",marginBottom:6}}>
                      <div style={{height:"100%",width:`${pct}%`,background:low?"#ef4444":pct<50?"#f59e0b":"#22c55e",borderRadius:4,transition:"width .3s"}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <p style={{fontSize:11,fontWeight:600,color:low?"#f87171":"#4ade80"}}>{Math.round(remaining)}g restant</p>
                      <p style={{fontSize:10,color:"#4b5563"}}>{Math.round(pct)}%</p>
                    </div>
                    {/* Modifier le poids utilisé */}
                    <div style={{marginTop:8,display:"flex",gap:4}}>
                      <input type="number" defaultValue={s.weightUsed||0} id={`stock-${s.id}`}
                        style={{flex:1,padding:"4px 6px",borderRadius:5,fontSize:11,background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit",outline:"none"}}/>
                      <button onClick={()=>{
                        const val = parseInt(document.getElementById(`stock-${s.id}`).value)||0;
                        const nd = {...data, filamentStock:stock.map(x=>x.id===s.id?{...x,weightUsed:Math.max(0,Math.min(x.weightTotal,val))}:x)};
                        setData({...nd});
                        savingRef.current=true;
                        storage.set(KEY,JSON.stringify(nd)).then(()=>{setLastSync(Date.now());storage.getTimestamp(KEY).then(ts=>{if(ts)lastRemoteTs.current=ts;});}).finally(()=>setTimeout(()=>{savingRef.current=false;},6000));
                      }} style={{padding:"4px 8px",borderRadius:5,fontSize:10,background:"#14b8a618",border:"1px solid #14b8a628",color:"#14b8a6",cursor:"pointer",fontWeight:600}}>OK</button>
                    </div>
                    {low&&<p style={{fontSize:9,color:"#f87171",marginTop:6,fontWeight:600}}>⚠ Stock bas — penser à commander</p>}
                  </div>
                );
              })}

              {/* Ajouter une bobine */}
              <div onClick={()=>{
                const color = prompt("Nom de la couleur ?");
                if (!color) return;
                const hex = prompt("Code hex couleur (ex: #ff6600) ?", "#808080");
                const weight = parseInt(prompt("Poids total en grammes ?", "1000"))||1000;
                const material = prompt("Matériau ?", "PLA")||"PLA";
                const nd = {...data, filamentStock:[...stock, {id:"fil"+uid(), color, hex:hex||"#808080", material, weightTotal:weight, weightUsed:0}]};
                setData({...nd});
                savingRef.current=true;
                storage.set(KEY,JSON.stringify(nd)).then(()=>{setLastSync(Date.now());storage.getTimestamp(KEY).then(ts=>{if(ts)lastRemoteTs.current=ts;});}).finally(()=>setTimeout(()=>{savingRef.current=false;},6000));
              }} style={{background:"#0b0d16",border:"2px dashed #1a2035",borderRadius:10,padding:14,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",minHeight:120}}>
                <div style={{textAlign:"center"}}>
                  <p style={{fontSize:24,marginBottom:4}}>+</p>
                  <p style={{fontSize:11,color:"#4b5563",fontWeight:600}}>Nouvelle bobine</p>
                </div>
              </div>
            </div>
          </div>
          );
        })()}

        {/* ══ AGENDA ══ */}
        {view==="agenda"&&(()=>{
          const todayStr = today();
          const nowDate = new Date();
          const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
          const firstDay = (new Date(calYear, calMonth, 1).getDay()+6)%7;
          const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
          const PROJ_COLORS = {"makeup":"#ec4899","vin":"#8b5cf6","print3d":"#14b8a6","perso":"#f59e0b","autre":"#6b7280"};

          const isPrivate = ev => ev.visibility === "private" || ev.visibility === "confidential";
          const publicEvents = calEvents.filter(ev => !isPrivate(ev));
          const getEventsForDay = (dateStr) => publicEvents.filter(ev => {
            const start = ev.start?.date || ev.start?.dateTime?.slice(0,10);
            return start === dateStr;
          });

          const formatTime = ev => {
            if (ev.start?.date) return "";
            const t = new Date(ev.start?.dateTime);
            return `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`;
          };

          const todayEvents = getEventsForDay(todayStr);

          return (
            <div className="fade">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <button onClick={()=>{if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1);}} className="btn"
                    style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:6,color:"#6b7280",fontSize:16,padding:"3px 11px",cursor:"pointer"}}>‹</button>
                  <p style={{fontSize:16,fontWeight:600,color:"#f1f5f9",minWidth:170,textAlign:"center"}}>{MONTH_NAMES[calMonth]} {calYear}</p>
                  <button onClick={()=>{if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1);}} className="btn"
                    style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:6,color:"#6b7280",fontSize:16,padding:"3px 11px",cursor:"pointer"}}>›</button>
                  <button onClick={()=>{setCalMonth(nowDate.getMonth());setCalYear(nowDate.getFullYear());}} className="btn"
                    style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:6,color:"#4b5563",fontSize:11,padding:"4px 9px",cursor:"pointer"}}>Aujourd'hui</button>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {todayEvents.length>0&&<span style={{fontSize:11,background:"#ef444420",color:"#f87171",padding:"3px 9px",borderRadius:5,fontWeight:600}}>🔔 {todayEvents.length} aujourd'hui</span>}
                  {calLoading&&<span style={{fontSize:10,color:"#4b5563"}}>Sync…</span>}
                  <button onClick={()=>setShowAddEvent("new")} className="btn"
                    style={{padding:"7px 13px",background:"#3b82f618",border:"1px solid #3b82f628",borderRadius:7,color:"#60a5fa",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Événement</button>
                </div>
              </div>

              {/* Grid */}
              <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,overflow:"hidden",marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid #0d1020"}}>
                  {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d=>(
                    <div key={d} style={{padding:"8px 0",textAlign:"center",fontSize:10,color:"#3d4f6b",fontWeight:600,letterSpacing:".4px"}}>{d}</div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                  {Array.from({length:firstDay}).map((_,i)=>(
                    <div key={"e"+i} style={{minHeight:86,borderRight:"1px solid #080a0f",borderBottom:"1px solid #080a0f",background:"#08080808"}}/>
                  ))}
                  {Array.from({length:daysInMonth}).map((_,i)=>{
                    const day=i+1;
                    const dateStr=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                    const dayEvs=getEventsForDay(dateStr);
                    const isToday=dateStr===todayStr;
                    const isPast=dateStr<todayStr;
                    return (
                      <div key={day} onClick={()=>setShowAddEvent(dateStr)}
                        style={{minHeight:86,borderRight:"1px solid #080a0f",borderBottom:"1px solid #080a0f",padding:"6px 6px",cursor:"pointer",background:isToday?"#1a203580":"transparent",transition:"background .12s"}}
                        onMouseEnter={e=>!isToday&&(e.currentTarget.style.background="#0b0d1690")}
                        onMouseLeave={e=>!isToday&&(e.currentTarget.style.background="transparent")}>
                        <span style={{fontSize:11,fontWeight:isToday?700:400,color:isToday?"#60a5fa":isPast?"#2d3748":"#9ca3af",width:22,height:22,borderRadius:"50%",background:isToday?"#3b82f625":"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:3}}>{day}</span>
                        {dayEvs.slice(0,3).map(ev=>{
                          const priv=isPrivate(ev);
                          const time=formatTime(ev);
                          return (
                            <div key={ev.id} onClick={e=>e.stopPropagation()}
                              style={{fontSize:9,padding:"2px 5px",borderRadius:3,background:priv?"#1a2035":"#3b82f620",color:priv?"#4b5563":"#93c5fd",fontWeight:600,marginBottom:2,lineHeight:1.3,borderLeft:`2px solid ${priv?"#2d3748":"#3b82f6"}`,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                              {priv?"🔒 Occupé":`${time?time+" ":""}${ev.summary||"Sans titre"}`}
                            </div>
                          );
                        })}
                        {dayEvs.length>3&&<p style={{fontSize:9,color:"#4b5563"}}>+{dayEvs.length-3}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Event list */}
              <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,overflow:"hidden"}}>
                <div style={{padding:"9px 14px",borderBottom:"1px solid #0d1020",display:"flex",justifyContent:"space-between"}}>
                  <p style={{fontSize:11,fontWeight:600,color:"#f1f5f9"}}>Événements — {MONTH_NAMES[calMonth]}</p>
                  <p style={{fontSize:10,color:"#4b5563"}}>{publicEvents.length} événement{publicEvents.length!==1?"s":""}</p>
                </div>
                {publicEvents.length===0&&!calLoading
                  ? <p style={{fontSize:12,color:"#2d3748",textAlign:"center",padding:"24px"}}>Aucun événement ce mois-ci.</p>
                  : [...publicEvents].sort((a,b)=>(a.start?.date||a.start?.dateTime||"").localeCompare(b.start?.date||b.start?.dateTime||"")).map(ev=>{
                    const priv=isPrivate(ev);
                    const start=ev.start?.date||ev.start?.dateTime?.slice(0,10);
                    const time=formatTime(ev);
                    const isToday=start===todayStr;
                    return (
                      <div key={ev.id} style={{padding:"9px 14px",borderBottom:"1px solid #080a0f",display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:3,height:36,borderRadius:2,background:priv?"#2d3748":"#3b82f6",flexShrink:0}}/>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                            <p style={{fontSize:12,fontWeight:600,color:priv?"#4b5563":"#f1f5f9"}}>{priv?"🔒 Occupé":ev.summary||"Sans titre"}</p>
                            {isToday&&<span style={{fontSize:9,background:"#ef444420",color:"#f87171",padding:"1px 5px",borderRadius:3,fontWeight:600}}>AUJOURD'HUI</span>}
                          </div>
                          <span style={{fontSize:10,color:"#4b5563"}}>{start}{time?` · ${time}`:""}</span>
                          {!priv&&ev.description&&<span style={{fontSize:10,color:"#374151",marginLeft:8}}>— {ev.description}</span>}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          );
        })()}

        {/* ══ EMAILS ══ */}
        {view==="emails"&&(
          <div className="fade">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <p style={{fontSize:15,fontWeight:600,color:"#f1f5f9"}}>✉️ Emails — {P.icon} {P.label}</p>
                <p style={{fontSize:11,color:"#4b5563",marginTop:2}}>Expéditeur · destinataire · objet · contenu analysés</p>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{display:"flex",background:"#0b0d16",borderRadius:7,padding:2,border:"1px solid #0f1520"}}>
                  {[["projets","🎯 Ce projet"],["tous","📬 Tous"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setGmailFilter(v)} className="btn"
                      style={{padding:"4px 11px",borderRadius:5,fontSize:11,fontWeight:500,background:gmailFilter===v?`${accent}18`:"transparent",color:gmailFilter===v?accent:"#3d4f6b",border:gmailFilter===v?`1px solid ${accent}28`:"1px solid transparent",cursor:"pointer"}}>
                      {l}
                    </button>
                  ))}
                </div>
                {PROJECT_EMAIL[projId]&&(
                  <span style={{fontSize:10,color:"#4ade80",padding:"4px 8px",background:"#22c55e10",borderRadius:5,border:"1px solid #22c55e20"}}>
                    ✉ {PROJECT_EMAIL[projId]}
                  </span>
                )}
                <button onClick={()=>scanGmail(gmailFilter)} disabled={gmailLoading} className="btn"
                  style={{padding:"8px 14px",background:"#3b82f618",border:"1px solid #3b82f628",borderRadius:7,color:"#60a5fa",fontSize:12,fontWeight:600,cursor:"pointer",opacity:gmailLoading?0.6:1}}>
                  {gmailLoading?"⏳ Scan…":"🔍 Scanner"}
                </button>
                <button onClick={clearAllEmails} className="btn"
                  style={{padding:"8px 14px",background:"#ef444415",border:"1px solid #ef444428",borderRadius:7,color:"#f87171",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  🗑 Vider tout
                </button>
              </div>
            </div>

            {gmailThreads.length===0&&!gmailLoading&&(
              <div style={{textAlign:"center",padding:"50px 20px",color:"#2d3748"}}>
                <p style={{fontSize:32,marginBottom:12}}>📭</p>
                <p style={{fontSize:13,color:"#4b5563",marginBottom:6}}>Clique sur "Scanner" pour détecter</p>
                <p style={{fontSize:11,color:"#2d3748"}}>les emails liés à {P.icon} {P.label}.</p>
              </div>
            )}

            {gmailThreads.length>0&&(()=>{
              const projEmails = gmailFilter==="projets"
                ? gmailThreads.filter(t => {
                    if (!t.prospect) return false; // Pas de prospect matché → pas dans "Ce projet"
                    const tp = t.prospect._proj || t.proj;
                    if (projId === "vin") return tp === "vin" || tp === "vinClients";
                    return tp === projId;
                  })
                : gmailThreads;

              const PROJ_COLORS = {"makeup":"#ec4899","vin":"#8b5cf6","print3d":"#14b8a6"};
              const FOLDER_COLORS = {"Reçus":"#60a5fa","Envoyés":"#4ade80","Brouillons":"#fbbf24","Autre":"#6b7280"};
              const folders = ["Reçus","Envoyés","Brouillons","Autre"];

              if (projEmails.length===0) return (
                <div style={{textAlign:"center",padding:"40px 20px"}}>
                  <p style={{fontSize:13,color:"#4b5563"}}>Aucun email trouvé pour {P.icon} {P.label}.</p>
                  <p style={{fontSize:11,color:"#2d3748",marginTop:6}}>Essaie le filtre "Tous" ou rescanne.</p>
                </div>
              );

              return folders.map(folder => {
                const items = projEmails.filter(t=>t.folder===folder);
                if (items.length===0) return null;
                const fc = FOLDER_COLORS[folder]||"#6b7280";
                return (
                  <div key={folder} style={{marginBottom:14,background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,overflow:"hidden"}}>
                    <div style={{padding:"9px 14px",borderBottom:"1px solid #0d1020",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <p style={{fontSize:11,fontWeight:600,color:fc}}>{folder}</p>
                      <p style={{fontSize:10,color:"#4b5563"}}>{items.length} email{items.length>1?"s":""}</p>
                    </div>
                    {items.map(t=>{
                      const c = PROJ_COLORS[t.proj]||"#6b7280";
                      const isExp = expandedGlobalEmail===t.id;
                      return (
                        <div key={t.id}>
                          <div onClick={()=>setExpandedGlobalEmail(isExp?null:t.id)}
                            style={{padding:"10px 14px",borderBottom:"1px solid #080a0f",display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer"}}
                            onMouseEnter={e=>e.currentTarget.style.background="#0f1520"}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <div style={{width:3,minHeight:40,borderRadius:2,background:c,flexShrink:0,marginTop:2}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                                <span style={{fontSize:12,fontWeight:600,color:"#f1f5f9",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.subject||"(sans objet)"}</span>
                                {t.prospect&&<span onClick={e=>{e.stopPropagation();setDetailProspect(t.prospect);}} style={{fontSize:10,background:"#22c55e15",color:"#4ade80",padding:"1px 6px",borderRadius:3,fontWeight:600,flexShrink:0,cursor:"pointer"}}>✓ {t.prospect.name}</span>}
                                {gmailFilter==="tous"&&t.proj&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:`${c}15`,color:c,fontWeight:600,flexShrink:0}}>{t.proj==="makeup"?"💄":t.proj==="vin"?"🍷":"🧊"}</span>}
                              </div>
                              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                                <span style={{fontSize:10,color:"#4b5563",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{folder==="Envoyés"?`→ ${t.to}`:`← ${t.from}`}</span>
                              </div>
                              {!isExp&&<p style={{fontSize:11,color:"#374151",lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.snippet}</p>}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginTop:2}}>
                              <span style={{fontSize:10,color:"#2d3748",whiteSpace:"nowrap"}}>
                                {t.timestamp ? new Date(t.timestamp).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}) : ""}
                              </span>
                              <span style={{fontSize:11,color:"#374151",transform:isExp?"rotate(180deg)":"none",transition:"transform .15s",display:"inline-block"}}>▾</span>
                            </div>
                          </div>
                          {isExp&&(
                            <div style={{padding:"14px 20px 14px 30px",background:"#080a0f",borderBottom:"1px solid #0f1520",maxHeight:400,overflowY:"auto"}}>
                              <p style={{fontSize:12,color:"#cbd5e1",lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"inherit"}}>{t.body||t.snippet||"Contenu non disponible — rescanne pour charger."}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ══ CARTE VIN ══ */}
        {view==="carte"&&projId==="vin"&&<CarteVin prospects={prospects} onOpenProspect={setDetailProspect} onAddProspect={()=>setShowAddProspect(true)}/>}

        {/* ══ ACTIVITÉ ══ */}
        {view==="activite"&&<ActivityLog data={data} projId={projId} effectiveProjId={effectiveProjId} user={user} prospects={prospects} projOrders={projOrders} P={P} accent={accent}/>}
        {view==="idees"&&<IdeasBox data={data} user={user} save={save}/>}
      </div>

      {/* ══ MODALS ══ */}
      {showAddProspect&&<AddProspectModal projId={effectiveProjId} onAdd={addProspect} onClose={()=>setShowAddProspect(false)} allProspects={["makeup","vin","vinClients","print3d"].flatMap(k=>(data?.[k]||[]).map(p=>({...p,_projKey:k})))}/>}
      {showAddOrder!==undefined&&<AddOrderModal projId={projId} prospects={prospects} preselect={showAddOrder} onAdd={addOrder} onClose={()=>setShowAddOrder(undefined)}/>}
      {detailOrder&&<OrderDetailModal key={detailOrder.id} o={detailOrder} data={data} projId={projId} $={$} updateOrder={updateOrder} setDetailOrder={setDetailOrder} setDetailProspect={setDetailProspect} sendGmail={sendGmail} celebrate={celebrate}/>}
      {detailProspect&&<ProspectModal prospect={detailProspect} projId={effectiveProjId} onClose={()=>setDetailProspect(null)} onUpdate={updateProspect} onDelete={deleteProspect} orders={projOrders} onAddOrder={p=>{setDetailProspect(null);setShowAddOrder(p);}} onEmail={p=>{setDetailProspect(null);setShowEmailModal(p);}} onViewOrder={o=>{setDetailProspect(null);setDetailOrder(o);}} onSendGroupQuote={async(pid,token)=>{if(!data)return;updateProspect(pid,{groupQuoteToken:token});}} gmailThreads={gmailThreads} prospectEmails={data?.prospectEmails||{}} onSendEmail={sendGmail} onScanForProspect={scanForProspect} onClearEmails={clearProspectEmails} gmailLoading={gmailLoading}/>}
      {showAddEvent&&<AddEventModal onAdd={createCalEvent} onClose={()=>setShowAddEvent(null)} preDate={showAddEvent==="new"?null:showAddEvent} currentUser={user}/>}
      {showEmailModal&&<EmailModal prospect={showEmailModal} projId={effectiveProjId} onClose={()=>setShowEmailModal(null)} onSend={sendGmail} onUpdateStatus={updateProspect}/>}
    </div>
  );
}
