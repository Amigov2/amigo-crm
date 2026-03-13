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
  async set(key, value) {
    const { error } = await supabase.from("amigo_data").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { key, value };
  },
};

const USERS = {
  anthony: { label: "Anthony", color: "#3b82f6", avatar: "A" },
  harold:  { label: "Harold",  color: "#22c55e", avatar: "H" },
};

const PROJECTS = {
  makeup: {
    id: "makeup", label: "Carnaval Gall", icon: "💄", color: "#ec4899",
    statuses: ["À contacter","Contacté","En discussion","Qualifié","Relance urgente","Prospect froid"],
    statusColors: { "À contacter":"#3b82f6","Contacté":"#f59e0b","En discussion":"#22c55e","Qualifié":"#8b5cf6","Relance urgente":"#ef4444","Prospect froid":"#4b5563" },
  },
  vin: {
    id: "vin", label: "Import Vin", icon: "🍷", color: "#8b5cf6",
    statuses: ["À contacter","Contacté","En négociation","Commande passée","Livraison en cours","Partenaire actif"],
    statusColors: { "À contacter":"#3b82f6","Contacté":"#f59e0b","En négociation":"#22c55e","Commande passée":"#8b5cf6","Livraison en cours":"#f97316","Partenaire actif":"#14b8a6" },
  },
  print3d: {
    id: "print3d", label: "Impression 3D", icon: "🖨️", color: "#14b8a6",
    statuses: ["Prospect","Devis envoyé","Devis accepté","En production","Livré","Facturé"],
    statusColors: { "Prospect":"#3b82f6","Devis envoyé":"#f59e0b","Devis accepté":"#22c55e","En production":"#f97316","Livré":"#8b5cf6","Facturé":"#14b8a6" },
  },
};

const ORDER_STATUSES = ["En attente","Confirmée","En production","Livré","Facturé","Annulée"];
const QUOTE_STATUSES = ["Brouillon","Envoyé","Accepté","Refusé","Expiré"];

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
};

const uid = () => Math.random().toString(36).slice(2, 8);
const fmt = n => !n ? "€0" : n >= 1000000 ? `€${(n/1000000).toFixed(1)}M` : n >= 1000 ? `€${Math.round(n/1000)}k` : `€${Math.round(n)}`;
const ago = ts => { if(!ts) return "–"; const m=Math.floor((Date.now()-ts)/60000); if(m<1) return "maintenant"; if(m<60) return `${m}min`; const h=Math.floor(m/60); if(h<24) return `${h}h`; return `${Math.floor(h/24)}j`; };
const today = () => new Date().toISOString().slice(0,10);

const calcTax = (fob, eurBrl=5.40) => {
  const fobBrl=fob*eurBrl, frete=fobBrl*0.10, cif=fobBrl+frete;
  const ii=cif*0.27, ipi=(cif+ii)*0.20, pisCof=(cif+ii+ipi)*0.0925;
  const icms=(cif+ii+ipi+pisCof)/(1-0.30)*0.30;
  const total=ii+ipi+pisCof+icms;
  return { totalEur: total/eurBrl, txEffective: (total/fobBrl*100).toFixed(1) };
};

// ─── COMPONENTS (defined outside App to fix the typing bug) ──────────────────

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:10,padding:"11px 14px"}}>
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

function KanbanCard({ prospect, accent, onOpen }) {
  const P = PROJECTS[prospect._proj] || Object.values(PROJECTS)[0];
  const col = P.statusColors[prospect.status] || "#6b7280";
  const au = prospect.assignedTo ? USERS[prospect.assignedTo] : null;
  return (
    <div onClick={() => onOpen(prospect)}
      style={{background:"#0d1120",border:`1px solid ${col}25`,borderLeft:`3px solid ${col}`,borderRadius:9,padding:"10px 12px",marginBottom:7,cursor:"pointer",transition:"background .12s"}}
      onMouseEnter={e=>e.currentTarget.style.background="#111828"}
      onMouseLeave={e=>e.currentTarget.style.background="#0d1120"}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
        <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",lineHeight:1.3,flex:1,marginRight:6}}>{prospect.name}</p>
        <p style={{fontSize:12,fontWeight:700,color:accent,flexShrink:0}}>{fmt(prospect.valeur)}</p>
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
  return (
    <div style={{position:"fixed",inset:0,background:"#000000c0",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#0d1020",border:"1px solid #1a2035",borderRadius:14,padding:22,width:wide?660:500,maxWidth:"94vw",maxHeight:"90vh",overflow:"auto",animation:"fi .2s ease"}}
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

function AddProspectModal({ projId, onAdd, onClose }) {
  const P = PROJECTS[projId];
  const isVin = projId === "vin";
  const [name,             setName]             = useState("");
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

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ id: projId.slice(0,2)+uid(), name, geo, sub, contact, email, phone,
      valeur: parseInt(valeur)||0, note, tags:[tag1,tag2].filter(Boolean),
      status: P.statuses[0], assignedTo:null, lastEditBy:null, lastEditAt:null,
      ...(isVin && { type, producteur, cepage, appellation, millesime, certificat, alcool, bio,
        incoterm, prixProducteur, prixMagasinFr, prixVenteBresil, prixMercadoLivre, minCommande }) });
  };

  return (
    <ModalWrap title={`➕ Nouveau — ${P.label}`} onClose={onClose} wide={isVin}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
        <div style={{gridColumn:"span 2"}}><Field label="Nom domaine / château *" value={name} onChange={setName} placeholder={isVin?"Château Pichon Baron...":projId==="print3d"?"Studio Durand Architecture...":"Académie du Maquillage..."}/></div>
        <Field label="Pays / Région" value={geo} onChange={setGeo} placeholder="France 🇫🇷"/>
        <Field label={isVin?"Sous-région / Appellation zone":"Secteur / Détail"} value={sub} onChange={setSub} placeholder={isVin?"Bordeaux, Bourgogne...":"8ème arr."}/>

        {isVin && <>
          <Field label="Type" value={type} onChange={setType} options={["Rouge","Blanc","Rosé","Pétillant","Mousseux","Orange"]}/>
          <Field label="Nom producteur" value={producteur} onChange={setProducteur} placeholder="Famille Martin..."/>
          <Field label="Cépage(s)" value={cepage} onChange={setCepage} placeholder="Cabernet Sauvignon, Merlot..."/>
          <Field label="Appellation officielle" value={appellation} onChange={setAppellation} placeholder="Saint-Émilion Grand Cru AOC"/>
          <Field label="Millésime" value={millesime} onChange={setMillesime} placeholder="2021"/>
          <Field label="Certificat" value={certificat} onChange={setCertificat} placeholder="AOC, DOC, DOCG, DO..."/>
          <Field label="Alcool (%)" value={alcool} onChange={setAlcool} placeholder="13.5"/>

          <div style={{gridColumn:"span 2",margin:"4px 0 10px"}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
              <div onClick={()=>setBio(!bio)} style={{width:36,height:20,borderRadius:10,background:bio?"#22c55e":"#1a2035",position:"relative",cursor:"pointer",transition:"background .2s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:bio?18:2,width:16,height:16,borderRadius:"50%",background:"white",transition:"left .2s"}}/>
              </div>
              <span style={{fontSize:11,color:bio?"#4ade80":"#6b7280",fontWeight:600}}>🌿 Certification Bio / Biodynamique</span>
            </label>
          </div>

          <div style={{gridColumn:"span 2",marginBottom:10,padding:"10px 12px",background:"#080a0f",border:"1px solid #0f1520",borderRadius:8}}>
            <p style={{fontSize:10,color:"#8b5cf6",fontWeight:600,textTransform:"uppercase",letterSpacing:".4px",marginBottom:10}}>💰 Tarifs & Logistique</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}>
              <Field label="Incoterm" value={incoterm} onChange={setIncoterm} options={["FOB","CIF","DDP","EXW","DAP"]}/>
              <Field label="Min. commande (caisses)" value={minCommande} onChange={setMinCommande} placeholder="6"/>
              <Field label="Prix producteur (€/caisse)" value={prixProducteur} onChange={setPrixProducteur} placeholder="180"/>
              <Field label="Prix magasin France (€/btl)" value={prixMagasinFr} onChange={setPrixMagasinFr} placeholder="45"/>
              <Field label="Prix vente Brésil (R$/btl)" value={prixVenteBresil} onChange={setPrixVenteBresil} placeholder="350"/>
              <Field label="Prix Mercado Livre (R$/btl)" value={prixMercadoLivre} onChange={setPrixMercadoLivre} placeholder="320"/>
            </div>
          </div>

          <Field label="Tag 1" value={tag1} onChange={setTag1} placeholder="Bio"/>
          <Field label="Tag 2" value={tag2} onChange={setTag2} placeholder="Volume"/>
        </>}

        {!isVin && <>
          <Field label="Contact" value={contact} onChange={setContact} placeholder="Prénom Nom"/>
          <Field label="Email" value={email} onChange={setEmail} placeholder="contact@..."/>
          <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="+33 1 ..."/>
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

function ProspectModal({ prospect, projId, onClose, onUpdate, orders, onAddOrder }) {
  const P = PROJECTS[projId];
  const isVin = projId === "vin";
  const [status,    setStatus]    = useState(prospect.status);
  const [assigned,  setAssigned]  = useState(prospect.assignedTo||"");
  const [note,      setNote]      = useState(prospect.note||"");
  const [editNote,  setEditNote]  = useState(false);

  const save = (field, val) => {
    if (field==="status") setStatus(val);
    if (field==="assignedTo") setAssigned(val);
    onUpdate(prospect.id, { [field]: val||null });
  };

  const myOrders = orders.filter(o=>o.prospectId===prospect.id);
  const col = P.statusColors[status]||"#6b7280";

  return (
    <ModalWrap title={prospect.name} onClose={onClose} wide>
      {/* Infos produit vin */}
      {isVin && prospect.cepage && (
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,padding:"8px 10px",background:"#0b0d16",borderRadius:8,border:"1px solid #8b5cf620"}}>
          {[
            {ic:"🍇",v:prospect.type},
            {ic:"🌿",v:prospect.cepage},
            {ic:"📍",v:prospect.appellation},
            {ic:"📅",v:prospect.millesime},
            {ic:"🏷",v:prospect.certificat},
            {ic:"🧪",v:prospect.alcool?`${prospect.alcool}°`:""},
            {ic:"🚚",v:prospect.incoterm},
            {ic:"📦",v:prospect.minCommande?`Min. ${prospect.minCommande} cs`:""},
            ...(prospect.bio?[{ic:"🌱",v:"Bio"}]:[]),
          ].filter(x=>x.v).map(x=>(
            <span key={x.v} style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"#8b5cf615",color:"#a78bfa",fontWeight:600,display:"flex",alignItems:"center",gap:3}}>
              {x.ic} {x.v}
            </span>
          ))}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div>
          <p style={{fontSize:10,color:"#4b5563",textTransform:"uppercase",fontWeight:600,marginBottom:6}}>Contact</p>
          {prospect.contact && <p style={{fontSize:12,fontWeight:600,color:"#e2e8f0",marginBottom:2}}>{prospect.contact}</p>}
          {prospect.email   && <p style={{fontSize:11,color:"#3b82f6",marginBottom:1}}>{prospect.email}</p>}
          {prospect.phone   && <p style={{fontSize:11,color:"#6b7280",marginBottom:4}}>{prospect.phone}</p>}
          {prospect.geo     && <p style={{fontSize:11,color:"#4b5563"}}>{prospect.geo} {prospect.sub}</p>}
          {isVin && prospect.prixMagasinFr && <p style={{fontSize:10,color:"#4b5563",marginTop:5}}>Prix magasin France : <strong style={{color:"#f1f5f9"}}>€{prospect.prixMagasinFr}/btl</strong></p>}
          <div style={{marginTop:7}}>{(prospect.tags||[]).map(t=>(
            <span key={t} style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:`${P.color}15`,color:P.color,border:`1px solid ${P.color}22`,marginRight:4,fontWeight:600}}>{t}</span>
          ))}</div>
        </div>
        <div>
          <Field label="Statut" value={status} onChange={v=>save("status",v)} options={P.statuses}/>
          <Field label="Assigné à" value={assigned} onChange={v=>save("assignedTo",v)}
            options={["", ...Object.keys(USERS)]}/>
          <div style={{marginTop:6,padding:"7px 10px",background:`${col}10`,borderRadius:6,border:`1px solid ${col}20`,display:"inline-flex",alignItems:"center",gap:5}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"inline-block"}}/>
            <span style={{fontSize:11,fontWeight:600,color:col}}>{status}</span>
          </div>
        </div>
      </div>

      {/* Panneau financier vin */}
      {isVin && <WineFinancePanel prospect={prospect}/>}

      <div style={{padding:"10px 12px",background:"#080a0f",borderRadius:8,border:"1px solid #0d1020",marginBottom:12}}>
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

      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <p style={{fontSize:10,color:"#4b5563",textTransform:"uppercase",fontWeight:600}}>📦 Commandes ({myOrders.length})</p>
          <button onClick={()=>onAddOrder(prospect)} style={{fontSize:10,color:"#22c55e",background:"#22c55e10",border:"1px solid #22c55e22",padding:"3px 9px",borderRadius:5,cursor:"pointer",fontWeight:600}}>+ Ajouter</button>
        </div>
        {myOrders.length===0
          ? <p style={{fontSize:11,color:"#2d3748",fontStyle:"italic"}}>Aucune commande.</p>
          : myOrders.map(o=>(
            <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:"#080a0f",borderRadius:6,marginBottom:4,border:"1px solid #0f1520"}}>
              <div>
                <p style={{fontSize:11,fontWeight:600,color:"#e2e8f0"}}>{o.product||"–"}</p>
                <p style={{fontSize:10,color:"#4b5563"}}>{o.type||"commande"} · {o.date}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:12,fontWeight:700,color:"#22c55e"}}>{fmt(o.amount)}</p>
                <span style={{fontSize:10,color:"#f59e0b"}}>{o.status}</span>
              </div>
            </div>
          ))
        }
      </div>
    </ModalWrap>
  );
}

// Emails autorisés — seuls ceux-là peuvent entrer
const ALLOWED_EMAILS = [
  "anthony.donzel@gmail.com",
  "harold.grenouilleau@gmail.com",
];

const emailToUser = email => {
  if (!email) return null;
  const lower = email.toLowerCase();
  if (lower === "anthony.donzel@gmail.com")     return "anthony";
  if (lower === "harold.grenouilleau@gmail.com") return "harold";
  return null;
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function AmigoCRM() {
  const [authUser, setAuthUser] = useState(null); // session Google
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError]   = useState("");
  const [user,    setUser]    = useState(null);   // "anthony" | "harold"
  const [projId,  setProjId]  = useState("makeup");
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSync,setLastSync]= useState(null);
  const [notif,   setNotif]   = useState(null);
  const [view,    setView]    = useState("kanban");

  const [showAddProspect, setShowAddProspect] = useState(false);
  const [showAddOrder,    setShowAddOrder]    = useState(undefined);
  const [detailProspect,  setDetailProspect]  = useState(null);

  const KEY = "amigo-v9";
  const pollRef  = useRef(null);
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
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setUser(null);
  };

  const load = useCallback(async () => {
    try {
      const r = await storage.get(KEY);
      const d = r ? JSON.parse(r.value) : {...INIT_DATA};
      if (!d.print3d)  d.print3d  = [];
      if (!d.orders)   d.orders   = [];
      if (!d.activity) d.activity = [];
      setData(d);
      setLastSync(Date.now());
    } catch { setData({...INIT_DATA}); }
    finally { setLoading(false); }
  }, []);

  const save = useCallback(async d => {
    try { await storage.set(KEY, JSON.stringify(d)); setData({...d}); setLastSync(Date.now()); } catch(e){console.error(e);}
  }, []);

  useEffect(() => { load(); pollRef.current=setInterval(load,8000); return()=>clearInterval(pollRef.current); }, [load]);

  useEffect(() => {
    if (!data||!user) return;
    const acts=data.activity||[];
    if (prevLen.current>0&&acts.length>prevLen.current) {
      const l=acts[acts.length-1];
      if (l.by!==user){setNotif(l);setTimeout(()=>setNotif(null),5000);}
    }
    prevLen.current=acts.length;
  }, [data, user]);

  const addAct = (d, by, name, action) => ({...d, activity:[...(d.activity||[]).slice(-29),{id:Date.now(),by,byLabel:USERS[by]?.label,prospectName:name,action,at:Date.now(),proj:projId}]});

  const updateProspect = async (pid, fields) => {
    if (!data||!user) return;
    const p = data[projId].find(x=>x.id===pid);
    const upd = {...fields, lastEditBy:user, lastEditAt:Date.now()};
    let nd = {...data, [projId]:data[projId].map(x=>x.id===pid?{...x,...upd}:x)};
    nd = addAct(nd, user, p?.name, fields.status?`→ ${fields.status}`:"modifié");
    setDetailProspect(s=>s?.id===pid?{...s,...upd}:s);
    await save(nd);
  };

  const addProspect = async p => {
    if (!data||!user) return;
    p.lastEditBy=user; p.lastEditAt=Date.now(); p._proj=projId;
    let nd = {...data, [projId]:[...data[projId], p]};
    nd = addAct(nd, user, p.name, "ajouté");
    setShowAddProspect(false);
    await save(nd);
  };

  const addOrder = async o => {
    if (!data||!user) return;
    o.createdBy=user; o.createdAt=Date.now();
    let nd = {...data, orders:[...(data.orders||[]), o]};
    nd = addAct(nd, user, o.prospectName, `${o.type||"commande"} ${fmt(o.amount)}`);
    setShowAddOrder(undefined);
    await save(nd);
  };

  const updateOrder = async (oid, fields) => {
    if (!data) return;
    await save({...data, orders:data.orders.map(o=>o.id===oid?{...o,...fields}:o)});
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
  const P = PROJECTS[projId];
  const accent = P.color;
  const prospects = (data?.[projId]||[]).map(p=>({...p,_proj:projId}));
  const projOrders = (data?.orders||[]).filter(o=>o.proj===projId);
  const activity = (data?.activity||[]).filter(a=>a.proj===projId).slice(-12).reverse();
  const totalCA = projOrders.filter(o=>["Confirmée","En production","Livré","Facturé","Accepté"].includes(o.status)).reduce((s,o)=>s+o.amount,0);
  const pipeline = prospects.reduce((s,p)=>s+p.valeur,0);

  return (
    <div style={{minHeight:"100vh",background:"#080a0f",color:"#e2e8f0",fontFamily:"'DM Sans','Helvetica Neue',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#1a2030;border-radius:2px}
        .btn{transition:all .14s;cursor:pointer}.btn:hover{opacity:.82;transform:translateY(-1px)}
        .fade{animation:fi .22s ease}@keyframes fi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .pulse{animation:pl 2.5s ease infinite}@keyframes pl{0%,100%{opacity:1}50%{opacity:.4}}
        .notif{animation:nf .3s ease}@keyframes nf{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        select option{background:#0d1020}
        th{padding:8px 12px;font-size:10px;color:#3d4f6b;text-align:left;text-transform:uppercase;letter-spacing:.4px;font-weight:600;border-bottom:1px solid #0d1020}
        td{padding:8px 12px;font-size:12px;color:#9ca3af;border-bottom:1px solid #080a0f}
      `}</style>

      {notif&&(
        <div className="notif" onClick={()=>setNotif(null)} style={{position:"fixed",top:10,left:"50%",transform:"translateX(-50%)",background:"#0d1020",border:"1px solid #22c55e22",borderRadius:10,padding:"8px 16px",zIndex:300,cursor:"pointer",display:"flex",alignItems:"center",gap:9,boxShadow:"0 4px 20px #00000060"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>
          <span style={{fontSize:11,color:"#e2e8f0"}}><span style={{color:USERS[notif.by]?.color,fontWeight:600}}>{notif.byLabel}</span> — <span style={{color:"#f1f5f9"}}>{notif.prospectName}</span> <span style={{color:"#6b7280"}}>{notif.action}</span></span>
          <span style={{fontSize:14,color:"#374151"}}>×</span>
        </div>
      )}

      {/* NAV */}
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 20px",borderBottom:"1px solid #0c0f18",background:"#080a0f",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#2563eb,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"white"}}>A</div>
          <span style={{fontSize:15,fontWeight:600,color:"#f1f5f9"}}>amigo</span>
          <span style={{width:1,height:12,background:"#1a2030",margin:"0 4px"}}/>
          <div style={{display:"flex",gap:2,background:"#0b0d16",borderRadius:7,padding:2,border:"1px solid #0f1520"}}>
            {Object.values(PROJECTS).map(p=>(
              <button key={p.id} onClick={()=>{setProjId(p.id);setView("kanban");}} className="btn"
                style={{padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:500,cursor:"pointer",background:projId===p.id?`${p.color}18`:"transparent",color:projId===p.id?p.color:"#3d4f6b",border:projId===p.id?`1px solid ${p.color}22`:"1px solid transparent",display:"flex",alignItems:"center",gap:4}}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{display:"flex",gap:2,background:"#0b0d16",borderRadius:7,padding:2,border:"1px solid #0f1520"}}>
          {[["kanban","Kanban"],["commandes","Commandes"],["finance","Finance"],["activite","Activité"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} className="btn"
              style={{padding:"4px 11px",borderRadius:5,fontSize:11,fontWeight:500,background:view===v?`${accent}18`:"transparent",color:view===v?accent:"#3d4f6b",border:view===v?`1px solid ${accent}22`:"1px solid transparent",cursor:"pointer"}}>
              {l}
            </button>
          ))}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:"#0b0d16",borderRadius:5,border:"1px solid #0f1520"}}>
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>
            <span style={{fontSize:10,color:"#4b5563"}}>{lastSync?ago(lastSync):"–"}</span>
          </div>
          {Object.entries(USERS).map(([id,u])=>(
            <div key={id} onClick={()=>user!==id&&setUser(id)} title={u.label}
              style={{width:24,height:24,borderRadius:"50%",background:`linear-gradient(135deg,${u.color}70,${u.color})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white",border:user===id?`2px solid ${u.color}`:"2px solid transparent",cursor:user!==id?"pointer":"default",opacity:user===id?1:0.45}}>
              {u.avatar}
            </div>
          ))}
          <button onClick={signOut} className="btn" style={{fontSize:10,color:"#2d3748",background:"none",border:"none",cursor:"pointer"}} title="Se déconnecter">← Quitter</button>
        </div>
      </nav>

      {/* USER STRIP */}
      <div style={{padding:"5px 20px",background:`${U.color}08`,borderBottom:`1px solid ${U.color}12`,display:"flex",alignItems:"center",gap:7}}>
        <div style={{width:16,height:16,borderRadius:"50%",background:U.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"white"}}>{U.avatar}</div>
        <span style={{fontSize:11,color:U.color,fontWeight:600}}>{U.label}</span>
        <span style={{fontSize:11,color:"#2d3748"}}>· {P.icon} {P.label}</span>
        <span style={{marginLeft:"auto",fontSize:11,color:"#22c55e",fontWeight:600}}>CA confirmé : {fmt(totalCA)}</span>
      </div>

      <div style={{flex:1,overflow:"auto",padding:"18px 20px"}}>

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

            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
              <StatCard label="Pipeline total" value={fmt(pipeline)} sub={`${prospects.length} prospects`} color="#60a5fa" icon="💼"/>
              <StatCard label="En cours" value={prospects.filter(p=>!["À contacter","Prospect","Prospect froid"].includes(p.status)).length} sub="actifs" color={accent} icon="🔄"/>
              <StatCard label="CA confirmé" value={fmt(totalCA)} color="#22c55e" icon="✅"/>
              <StatCard label="Commandes" value={projOrders.length} sub={`${fmt(projOrders.reduce((s,o)=>s+o.amount,0))} total`} color="#f59e0b" icon="📦"/>
            </div>

            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button onClick={()=>setShowAddProspect(true)} className="btn"
                style={{padding:"8px 13px",background:`${accent}18`,border:`1px solid ${accent}28`,borderRadius:8,color:accent,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                + {projId==="print3d"?"Nouveau client":projId==="vin"?"Fournisseur":"École"}
              </button>
              <button onClick={()=>setShowAddOrder(null)} className="btn"
                style={{padding:"8px 13px",background:"#22c55e15",border:"1px solid #22c55e28",borderRadius:8,color:"#4ade80",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                + {projId==="print3d"?"Devis / Commande":"Commande"}
              </button>
            </div>

            {/* KANBAN */}
            <div style={{display:"flex",gap:11,overflowX:"auto",paddingBottom:14}}>
              {P.statuses.map(status=>{
                const cards = prospects.filter(p=>p.status===status);
                const col = P.statusColors[status]||"#6b7280";
                const colVal = cards.reduce((s,p)=>s+p.valeur,0);
                return (
                  <div key={status} style={{minWidth:215,maxWidth:235,flexShrink:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9,padding:"6px 10px",background:`${col}12`,borderRadius:7,border:`1px solid ${col}22`}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"inline-block"}}/>
                        <span style={{fontSize:11,fontWeight:600,color:col}}>{status}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        {colVal>0&&<span style={{fontSize:10,color:"#4b5563"}}>{fmt(colVal)}</span>}
                        <span style={{fontSize:10,fontWeight:700,color:"#4b5563",background:"#0b0d16",padding:"1px 6px",borderRadius:10}}>{cards.length}</span>
                      </div>
                    </div>
                    <div style={{minHeight:60}}>
                      {cards.map(p=>(
                        <KanbanCard key={p.id} prospect={p} accent={accent} onOpen={setDetailProspect}/>
                      ))}
                      {cards.length===0&&(
                        <div style={{padding:"20px 10px",textAlign:"center",border:"1px dashed #0f1520",borderRadius:8,color:"#2d3748",fontSize:11}}>Vide</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ COMMANDES ══ */}
        {view==="commandes"&&(
          <div className="fade">
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
              <StatCard label="Total" value={fmt(projOrders.reduce((s,o)=>s+o.amount,0))} sub={`${projOrders.length} éléments`} color="#f1f5f9" icon="📊"/>
              <StatCard label="CA confirmé" value={fmt(totalCA)} color="#22c55e" icon="✅"/>
              <StatCard label="En attente" value={fmt(projOrders.filter(o=>["En attente","Brouillon"].includes(o.status)).reduce((s,o)=>s+o.amount,0))} color="#f59e0b" icon="⏳"/>
              {projId==="vin"
                ? <StatCard label="Taxes BR" value={fmt(projOrders.reduce((s,o)=>s+(o.taxData?.totalEur||0),0))} color="#ef4444" icon="🇧🇷"/>
                : <StatCard label="Marge est." value={fmt(totalCA*(projId==="print3d"?0.45:0.35))} color="#a78bfa" icon="📈"/>
              }
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
              <button onClick={()=>setShowAddOrder(null)} className="btn"
                style={{padding:"8px 14px",background:"#22c55e15",border:"1px solid #22c55e28",borderRadius:8,color:"#4ade80",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                + {projId==="print3d"?"Devis / Commande":"Nouvelle commande"}
              </button>
            </div>
            {projOrders.length===0
              ? <div style={{textAlign:"center",padding:"60px",color:"#2d3748"}}><p style={{fontSize:28,marginBottom:8}}>📦</p><p style={{fontSize:12}}>Aucune commande pour l'instant.</p></div>
              : <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr>
                      <th>Client / Prospect</th><th>Produit</th>
                      {projId==="print3d"&&<th>Type</th>}
                      <th>Montant</th>
                      {projId==="vin"&&<th>Taxes BR</th>}
                      <th>Date</th><th>Statut</th>
                    </tr></thead>
                    <tbody>{projOrders.map(o=>(
                      <tr key={o.id}>
                        <td style={{color:"#f1f5f9",fontWeight:500}}>{o.prospectName||"–"}</td>
                        <td>{o.product||"–"}</td>
                        {projId==="print3d"&&<td><span style={{fontSize:10,padding:"2px 6px",borderRadius:3,background:`${accent}15`,color:accent,fontWeight:600}}>{o.type||"–"}</span></td>}
                        <td style={{color:"#22c55e",fontWeight:700}}>{fmt(o.amount)}</td>
                        {projId==="vin"&&<td style={{color:"#ef4444"}}>{o.taxData?fmt(o.taxData.totalEur):"–"}</td>}
                        <td style={{color:"#6b7280"}}>{o.date||"–"}</td>
                        <td>
                          <select value={o.status} onChange={e=>updateOrder(o.id,{status:e.target.value})}
                            style={{padding:"3px 6px",borderRadius:5,fontSize:10,outline:"none",cursor:"pointer",background:"#0b0d16",border:"1px solid #1a2035",color:"#f1f5f9",fontFamily:"inherit"}}>
                            {(projId==="print3d"?QUOTE_STATUSES:ORDER_STATUSES).map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
            }
          </div>
        )}

        {/* ══ FINANCE ══ */}
        {view==="finance"&&(
          <div className="fade">
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
              <StatCard label="CA pipeline" value={fmt(pipeline)} sub="valeur prospects" color="#60a5fa" icon="📊"/>
              <StatCard label="CA confirmé" value={fmt(totalCA)} sub="hors taxes" color="#22c55e" icon="💶"/>
              <StatCard label={projId==="vin"?"Taxes import BR":"TVA est."} value={fmt(projId==="vin"?projOrders.reduce((s,o)=>s+(o.taxData?.totalEur||0),0):totalCA*0.20)} color="#ef4444" icon="🏛"/>
              <StatCard label="Marge nette est." value={fmt(totalCA*(projId==="vin"?0.30:projId==="print3d"?0.45:0.35))} sub={`~${projId==="vin"?"30":projId==="print3d"?"45":"35"}%`} color="#a78bfa" icon="📈"/>
            </div>
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
            <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,overflow:"hidden"}}>
              <div style={{padding:"9px 14px",borderBottom:"1px solid #0d1020"}}><p style={{fontSize:11,fontWeight:600,color:"#f1f5f9"}}>Détail par commande</p></div>
              {projOrders.length===0
                ? <p style={{fontSize:12,color:"#374151",textAlign:"center",padding:"30px"}}>Aucune commande.</p>
                : <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr><th>Prospect</th><th>Montant</th>{projId==="vin"&&<th>Taxes</th>}<th>Marge est.</th><th>Statut</th></tr></thead>
                    <tbody>{projOrders.map(o=>(
                      <tr key={o.id}>
                        <td style={{color:"#f1f5f9",fontWeight:500}}>{o.prospectName}</td>
                        <td style={{color:"#22c55e",fontWeight:700}}>{fmt(o.amount)}</td>
                        {projId==="vin"&&<td style={{color:"#ef4444"}}>{o.taxData?fmt(o.taxData.totalEur):"–"}</td>}
                        <td style={{color:"#a78bfa"}}>{fmt(o.amount*(projId==="vin"?0.30:projId==="print3d"?0.45:0.35))}</td>
                        <td style={{color:"#f59e0b"}}>{o.status}</td>
                      </tr>
                    ))}</tbody>
                  </table>
              }
            </div>
          </div>
        )}

        {/* ══ ACTIVITÉ ══ */}
        {view==="activite"&&(
          <div className="fade">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
              {Object.entries(USERS).map(([uid,u])=>(
                <div key={uid} style={{background:"#0b0d16",border:`1px solid ${u.color}15`,borderRadius:10,padding:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${u.color}70,${u.color})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"white"}}>{u.avatar}</div>
                    <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9"}}>{u.label} {user===uid&&<span style={{fontSize:10,color:"#4b5563"}}>(vous)</span>}</p>
                  </div>
                  {[{l:"Assignés",v:prospects.filter(p=>p.assignedTo===uid).length,c:u.color},{l:"Modifiés",v:prospects.filter(p=>p.lastEditBy===uid).length,c:"#f1f5f9"},{l:"Commandes",v:projOrders.filter(o=>o.createdBy===uid).length,c:"#22c55e"}].map(r=>(
                    <div key={r.l} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:11,color:"#4b5563"}}>{r.l}</span>
                      <span style={{fontSize:12,fontWeight:700,color:r.c}}>{r.v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"9px 14px",borderBottom:"1px solid #0d1020",display:"flex",alignItems:"center",gap:7}}>
                <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>
                <p style={{fontSize:11,color:"#6b7280",fontWeight:600}}>Fil d'activité — {P.label}</p>
              </div>
              {activity.length===0
                ? <div style={{padding:"30px",textAlign:"center",color:"#2d3748"}}><p style={{fontSize:12}}>Aucune activité encore.</p></div>
                : activity.map((a,i)=>{const u=USERS[a.by];return(
                  <div key={a.id||i} style={{padding:"8px 14px",borderBottom:"1px solid #080a0f",display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:`linear-gradient(135deg,${u?.color||"#6b7280"}70,${u?.color||"#6b7280"})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white",flexShrink:0}}>{u?.avatar}</div>
                    <div style={{flex:1,fontSize:12}}>
                      <span style={{color:u?.color,fontWeight:600}}>{a.byLabel}</span>
                      <span style={{color:"#6b7280"}}> · </span>
                      <span style={{color:"#e2e8f0",fontWeight:500}}>{a.prospectName}</span>
                      <span style={{color:"#4b5563"}}> {a.action}</span>
                    </div>
                    <span style={{fontSize:10,color:"#2d3748",flexShrink:0}}>{ago(a.at)}</span>
                  </div>
                );})}
            </div>
          </div>
        )}
      </div>

      {/* ══ MODALS ══ */}
      {showAddProspect&&<AddProspectModal projId={projId} onAdd={addProspect} onClose={()=>setShowAddProspect(false)}/>}
      {showAddOrder!==undefined&&<AddOrderModal projId={projId} prospects={prospects} preselect={showAddOrder} onAdd={addOrder} onClose={()=>setShowAddOrder(undefined)}/>}
      {detailProspect&&<ProspectModal prospect={detailProspect} projId={projId} onClose={()=>setDetailProspect(null)} onUpdate={updateProspect} orders={projOrders} onAddOrder={p=>{setDetailProspect(null);setShowAddOrder(p);}}/>}
    </div>
  );
}
