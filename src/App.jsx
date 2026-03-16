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
  jade:    { label: "Jade",    color: "#f59e0b", avatar: "J" },
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
    id: "print3d", label: "Impression 3D", icon: "🧊", color: "#14b8a6",
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
  prospectEmails: {}, // { prospectId: [{id, from, to, subject, date, timestamp, folder, snippet}] }
};

const uid = () => Math.random().toString(36).slice(2, 8);
const decodeSnippet = s => {
  if (!s) return "";
  return s
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g," ")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n))
    .replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCharCode(parseInt(h,16)));
};
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

function ProspectModal({ prospect, projId, onClose, onUpdate, orders, onAddOrder, onEmail, gmailThreads, prospectEmails, onSendEmail, onScanForProspect, onClearEmails, gmailLoading }) {
  const P = PROJECTS[projId];
  const isVin = projId === "vin";
  const [status,    setStatus]    = useState(prospect.status);
  const [assigned,  setAssigned]  = useState(prospect.assignedTo||"");
  const [expandedEmail, setExpandedEmail] = useState(null);
  const [emailBodies, setEmailBodies] = useState({});
  const [loadingBody, setLoadingBody] = useState(null);
  const [note,      setNote]      = useState(prospect.note||"");
  const [editNote,  setEditNote]  = useState(false);
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
      // Rescanner pour récupérer le mail envoyé et les réponses
      setTimeout(()=>onScanForProspect&&onScanForProspect(prospect, true), 3000);
    }
  };

  const TABS = [["infos","📋 Infos"],["emails",`✉️ Emails${myEmails.length>0?` (${myEmails.length})`:""}`],["docs","📎 Docs"],["commandes",`📦 Commandes${myOrders.length>0?` (${myOrders.length})`:""}`]];

  return (
    <ModalWrap title={prospect.name} onClose={onClose} wide>
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
            <p style={{fontSize:10,color:"#4b5563",textTransform:"uppercase",fontWeight:600,marginBottom:6}}>Contact</p>
            {prospect.contact && <p style={{fontSize:12,fontWeight:600,color:"#e2e8f0",marginBottom:2}}>{prospect.contact}</p>}
            {prospect.email && <p style={{fontSize:11,color:"#3b82f6",marginBottom:1,cursor:"pointer"}} onClick={()=>onEmail&&onEmail(prospect)}>{prospect.email} ✉️</p>}
            {prospect.phone   && <p style={{fontSize:11,color:"#6b7280",marginBottom:4}}>{prospect.phone}</p>}
            {prospect.geo     && <p style={{fontSize:11,color:"#4b5563"}}>{prospect.geo} {prospect.sub}</p>}
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
      </>}

      {/* ── EMAILS ── */}
      {tab==="emails"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>onScanForProspect&&onScanForProspect(prospect)}
              disabled={gmailLoading}
              style={{padding:"6px 12px",background:"#3b82f618",border:"1px solid #3b82f628",borderRadius:6,color:"#60a5fa",fontSize:11,fontWeight:600,cursor:gmailLoading?"default":"pointer",opacity:gmailLoading?0.6:1,display:"flex",alignItems:"center",gap:6}}>
              {gmailLoading
                ? <><span style={{display:"inline-block",width:10,height:10,border:"2px solid #60a5fa",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Scan en cours…</>
                : "🔍 Scanner mes emails"
              }
            </button>
            <button onClick={()=>onClearEmails&&onClearEmails(prospect)}
              disabled={gmailLoading}
              style={{padding:"6px 10px",background:"#ef444415",border:"1px solid #ef444425",borderRadius:6,color:"#f87171",fontSize:11,fontWeight:500,cursor:"pointer"}}>
              🗑 Vider
            </button>
            {!gmailLoading&&myEmails.length>0&&<span style={{fontSize:10,color:"#4b5563"}}>{myEmails.length} email{myEmails.length>1?"s":""}</span>}
          </div>
          <button onClick={()=>onEmail&&onEmail(prospect)} style={{padding:"6px 12px",background:`${P.color}18`,border:`1px solid ${P.color}28`,borderRadius:6,color:P.color,fontSize:11,fontWeight:600,cursor:"pointer"}}>✉️ Nouvel email</button>
        </div>

        {myEmails.length===0&&(
          <div style={{textAlign:"center",padding:"30px 20px",color:"#2d3748"}}>
            <p style={{fontSize:28,marginBottom:8}}>📭</p>
            <p style={{fontSize:12,color:"#4b5563"}}>Aucun email trouvé pour ce contact.</p>
            <p style={{fontSize:11,color:"#2d3748",marginTop:4}}>Clique sur "Scanner mes emails" pour charger les échanges avec {prospect.name}.</p>
          </div>
        )}

        {myEmails.map(email=>{
          const isOut = email.folder==="Envoyés";
          const isReply = replyTo?.id===email.id;
          const isExpanded = expandedEmail===email.id;
          return (
            <div key={email.id} style={{marginBottom:10,borderRadius:9,border:`1px solid ${isExpanded?(isOut?"#22c55e55":"#3b82f655"):(isOut?"#22c55e22":"#1a2035")}`,overflow:"hidden",transition:"border .15s"}}>
              {/* Header email — clic pour ouvrir */}
              <div onClick={()=>{const next=isExpanded?null:email.id;setExpandedEmail(next);if(next)loadEmailBody(email);}}
                style={{padding:"10px 12px",background:isOut?"#22c55e08":"#0b0d16",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background=isOut?"#22c55e12":"#0f1520"}
                onMouseLeave={e=>e.currentTarget.style.background=isOut?"#22c55e08":"#0b0d16"}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{email.subject||"(sans objet)"}</p>
                  <p style={{fontSize:10,color:"#4b5563"}}>{isOut?`→ ${email.to}`:`← ${email.from}`}</p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:8}}>
                  <span style={{fontSize:10,color:"#4b5563"}}>{email.timestamp?new Date(email.timestamp).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}):""}</span>
                  <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:isOut?"#22c55e15":"#3b82f615",color:isOut?"#4ade80":"#60a5fa",fontWeight:600}}>{email.folder}</span>
                  <span style={{fontSize:12,color:"#4b5563",transition:"transform .15s",display:"inline-block",transform:isExpanded?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
                </div>
              </div>
              {/* Contenu expandé */}
              {isExpanded&&<>
                <div style={{padding:"12px 14px",background:"#06080d",borderTop:"1px solid #0d1020",maxHeight:320,overflowY:"auto"}}>
                  {loadingBody===email.id
                    ? <p style={{fontSize:11,color:"#4b5563"}}>⏳ Chargement du message…</p>
                    : <p style={{fontSize:12,color:"#cbd5e1",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{emailBodies[email.id]||email.snippet||"(contenu vide)"}</p>
                  }
                  <a href={`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(email.subject||"")}`} target="_blank" rel="noopener noreferrer"
                    style={{fontSize:10,color:"#3b82f6",display:"inline-block",marginTop:8}}>
                    📧 Ouvrir dans Gmail →
                  </a>
                </div>
                {/* Zone réponse */}
                <div style={{padding:"10px 12px",background:"#0b0d16",borderTop:"1px solid #0d1020",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  {!isReply
                    ? <button onClick={e=>{e.stopPropagation();setReplyTo(email);setReplyBody("");}}
                        style={{padding:"6px 14px",background:`${P.color}18`,border:`1px solid ${P.color}28`,borderRadius:6,color:P.color,fontSize:11,fontWeight:600,cursor:"pointer"}}>↩ Répondre</button>
                    : <div style={{width:"100%"}}>
                        <p style={{fontSize:10,color:"#4b5563",marginBottom:6,fontWeight:600}}>↩ Répondre à {email.from}</p>
                        <textarea value={replyBody} onChange={e=>setReplyBody(e.target.value)}
                          placeholder="Votre réponse..."
                          style={{width:"100%",padding:"8px",borderRadius:6,fontSize:11,resize:"none",height:90,outline:"none",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit",lineHeight:1.6,marginBottom:8}}/>
                        {sent&&<p style={{fontSize:11,color:"#4ade80",marginBottom:6}}>✅ Réponse envoyée !</p>}
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={handleReply} disabled={sending||!replyBody.trim()}
                            style={{padding:"6px 14px",background:`linear-gradient(135deg,${P.color},${P.color}aa)`,border:"none",borderRadius:6,color:"white",fontSize:11,fontWeight:600,cursor:"pointer",opacity:sending?0.6:1}}>
                            {sending?"Envoi…":"📤 Envoyer"}
                          </button>
                          <button onClick={()=>setReplyTo(null)} style={{padding:"6px 10px",background:"#0b0d16",border:"1px solid #0f1520",borderRadius:6,color:"#6b7280",fontSize:11,cursor:"pointer"}}>Annuler</button>
                        </div>
                      </div>
                  }
                </div>
              </>}
            </div>
          );
        })}
      </>}

      {/* ── COMMANDES ── */}
      {tab==="docs"&&<DocsTab key={prospect.id} prospect={prospect} onUpdate={onUpdate} projId={projId}/>}

      {tab==="commandes"&&<>
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
      </>}
    </ModalWrap>
  );
}

// Emails autorisés — seuls ceux-là peuvent entrer
const ALLOWED_EMAILS = [
  "anthony.donzel@gmail.com",
  "harold.grenouilleau@gmail.com",
  "jade.investissement@gmail.com",
];

const emailToUser = email => {
  if (!email) return null;
  const lower = email.toLowerCase();
  if (lower === "anthony.donzel@gmail.com")       return "anthony";
  if (lower === "harold.grenouilleau@gmail.com")  return "harold";
  if (lower === "jade.investissement@gmail.com")  return "jade";
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

function EmailModal({ prospect, projId, onClose, onSend }) {
  const P = PROJECTS[projId];
  const [to,      setTo]      = useState(prospect.email||"");
  const [subject, setSubject] = useState(projId==="makeup"?"Package Formation Carnaval Rio 2026 — Partenariat":"Partenariat import vins — Rio de Janeiro");
  const [body,    setBody]    = useState(
    projId==="makeup"
    ? `Bonjour,\n\nJe me permets de vous contacter au sujet d'un partenariat exclusif pour votre école de maquillage.\n\nNous proposons un package immersif "Carnaval Rio" développé avec Madame Gall — 5 jours de formation terrain à Rio de Janeiro en février, hébergement Ipanema inclus.\n\nTarif : 3 500€/élève · Groupes 6-10 personnes.\n\nSeriez-vous disponible pour en discuter ?\n\nCordialement,\nAnthony`
    : `Bonjour,\n\nJe suis importateur de vins basé à Rio de Janeiro et je développe un réseau de distribution premium au Brésil.\n\nJe serais ravi de discuter d'un partenariat avec ${prospect.name}.\n\nCordialement,\nAnthony`
  );
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSend = async () => {
    if (!to) return;
    setSending(true);
    const ok = await onSend({ to, subject, body });
    setSending(false);
    if (ok) setSent(true);
  };

  if (sent) return (
    <ModalWrap title="✅ Email envoyé" onClose={onClose}>
      <p style={{fontSize:12,color:"#4ade80",textAlign:"center",padding:"20px 0"}}>Email envoyé à {to} avec succès !</p>
      <p style={{fontSize:11,color:"#4b5563",textAlign:"center",marginBottom:16}}>Il apparaît dans ton dossier "Envoyés" Gmail.</p>
      <button onClick={onClose} style={{width:"100%",padding:"9px",background:"#22c55e15",border:"1px solid #22c55e28",borderRadius:7,color:"#4ade80",fontSize:13,fontWeight:600,cursor:"pointer"}}>Fermer</button>
    </ModalWrap>
  );

  return (
    <ModalWrap title={`✉️ Email — ${prospect.name}`} onClose={onClose} wide>
      <Field label="À" value={to} onChange={setTo} placeholder="email@domaine.com"/>
      <Field label="Objet" value={subject} onChange={setSubject} placeholder="Objet..."/>
      <div style={{marginBottom:12}}>
        <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".4px"}}>Message</p>
        <textarea value={body} onChange={e=>setBody(e.target.value)}
          style={{width:"100%",padding:"9px",borderRadius:7,fontSize:12,resize:"vertical",height:200,outline:"none",background:"#080a0f",border:"1px solid #1a2035",color:"#e2e8f0",fontFamily:"inherit",lineHeight:1.7}}/>
      </div>
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

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function AmigoCRM() {
  const [authUser, setAuthUser] = useState(null); // session Google
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError]   = useState("");
  const [user,    setUser]    = useState(null);
  const [projId,  setProjId]  = useState("makeup");
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSync,setLastSync]= useState(null);
  const [notif,   setNotif]   = useState(null);
  const [view,    setView]    = useState("kanban");
  const [theme,   setTheme]   = useState(()=>localStorage.getItem("amigo-theme")||"dark");

  const THEMES = {
    dark:  { label:"🌑 Dark",  filter:"none" },
    dim:   { label:"🌓 Dim",   filter:"brightness(1.15) contrast(0.92)" },
    warm:  { label:"🌅 Warm",  filter:"sepia(0.25) brightness(1.08) contrast(0.95)" },
    light: { label:"☀️ Light", filter:"invert(1) hue-rotate(180deg)" },
  };

  const switchTheme = (t) => { setTheme(t); localStorage.setItem("amigo-theme",t); };

  const [showAddProspect, setShowAddProspect] = useState(false);
  const [showAddOrder,    setShowAddOrder]    = useState(undefined);
  const [detailProspect,  setDetailProspect]  = useState(null);
  const [showAddEvent,    setShowAddEvent]    = useState(null);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [searchOpen,      setSearchOpen]      = useState(false);

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

  // ── Google API helpers ────────────────────────────────────────────────────
  const getGToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.provider_token || null;
  };

  const [calEvents,    setCalEvents]    = useState([]);
  const [calLoading,   setCalLoading]   = useState(false);
  const [calMonth,     setCalMonth]     = useState(new Date().getMonth());
  const [calYear,      setCalYear]      = useState(new Date().getFullYear());
  const [showEmailModal, setShowEmailModal] = useState(null); // prospect

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
      };
      await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadCalendar(calMonth, calYear);
    } catch(e) { console.error(e); }
  };

  const sendGmail = async ({ to, subject, body }) => {
    try {
      const token = await getGToken();
      if (!token) return false;
      const toB64 = str => {
        const bytes = new TextEncoder().encode(str);
        let bin = "";
        bytes.forEach(b => bin += String.fromCharCode(b));
        return btoa(bin);
      };
      const raw = [
        `To: ${to}`,
        `Subject: =?UTF-8?B?${toB64(subject)}?=`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        toB64(body)
      ].join("\r\n");
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

  const matchEmailToProspect = (from, to, subject, snippet, allProspects) => {
    const haystack = `${from} ${to} ${subject} ${snippet}`.toLowerCase();
    for (const p of allProspects) {
      if (p.email) {
        const domain = p.email.split("@")[1]?.toLowerCase();
        if (domain && haystack.includes(domain)) return p;
      }
    }
    for (const p of allProspects) {
      const names = [p.name, p.producteur, p.contact].filter(Boolean).map(n=>n.toLowerCase().trim());
      for (const n of names) {
        if (n.length > 4 && haystack.includes(n)) return p;
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

  const scanGmail = async (filter) => {
    const f = filter || gmailFilter;
    setGmailLoading(true);
    try {
      const token = await getGToken();
      if (!token) { setGmailLoading(false); return; }

      const allProspects = [...(data?.makeup||[]), ...(data?.vin||[]), ...(data?.print3d||[])];

      let query;
      if (f === "tous") {
        query = "in:anywhere";
      } else {
        const domains = allProspects
          .map(p => p.email?.split("@")[1]?.toLowerCase())
          .filter(Boolean)
          .map(d => `from:${d} OR to:${d}`);
        const keywords = [
          "carnaval","gall","maquillage",
          "vin","wine","domaine","château","chateau","bodega","import",
          "impression 3d","print 3d","maquette","prototype"
        ].map(k=>`"${k}"`);
        query = [...domains, ...keywords].join(" OR ");
      }

      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=200&q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = await res.json();
      if (!d.messages) { setGmailThreads([]); setGmailLoading(false); return; }

      const threads = await Promise.all(
        d.messages.map(async m => {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const msg = await r.json();
          const headers = msg.payload?.headers||[];
          const get = name => headers.find(h=>h.name===name)?.value||"";
          const from = get("From"), to = get("To"), subject = get("Subject"), date = get("Date");
          const snippet = decodeSnippet(msg.snippet);
          const prospect = matchEmailToProspect(from, to, subject, snippet, allProspects);
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
    } catch(e) { console.error(e); }
    setGmailLoading(false);
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

  const load = useCallback(async () => {
    try {
      const r = await storage.get(KEY);
      const d = r ? JSON.parse(r.value) : {...INIT_DATA};
      if (!d.print3d)       d.print3d       = [];
      if (!d.prospectEmails) d.prospectEmails = {};
      if (!d.orders)        d.orders        = [];
      if (!d.activity)      d.activity      = [];
      // Sync emails à chaque poll — capte les scans d'Harold
      const allSavedEmails = Object.values(d.prospectEmails).flat();
      // Ne mettre à jour que si on a plus d'emails ou si c'est le premier chargement
      setGmailThreads(prev => {
        if (allSavedEmails.length >= prev.length || prev.length === 0)
          return allSavedEmails.sort((a,b)=>b.timestamp-a.timestamp);
        // Fusionner — garder ce qu'on avait + ce qui est nouveau
        const prevIds = new Set(prev.map(e=>e.id));
        const newOnes = allSavedEmails.filter(e=>!prevIds.has(e.id));
        return [...prev, ...newOnes].sort((a,b)=>b.timestamp-a.timestamp);
      });
      setData(d);
      setLastSync(Date.now());
    } catch { setData({...INIT_DATA}); }
    finally { setLoading(false); }
  }, []);

  const save = useCallback(async d => {
    try { await storage.set(KEY, JSON.stringify(d)); setData({...d}); setLastSync(Date.now()); } catch(e){console.error(e);}
  }, []);

  useEffect(() => { load(); pollRef.current=setInterval(load,8000); return()=>clearInterval(pollRef.current); }, [load]);

  // Auto-scan à la connexion — tourne en arrière-plan
  useEffect(() => {
    if (!authUser || !data) return;
    const allProspects = [
      ...(data.makeup||[]).map(p=>({...p,_proj:"makeup"})),
      ...(data.vin||[]).map(p=>({...p,_proj:"vin"})),
      ...(data.print3d||[]).map(p=>({...p,_proj:"print3d"})),
    ].filter(p=>p.email);
    if (!allProspects.length) return;
    // Scan séquentiel silencieux — 1 prospect toutes les 2s pour ne pas surcharger
    let i = 0;
    const next = async () => {
      if (i >= allProspects.length) return;
      try { await scanForProspect(allProspects[i], true); } catch(e) {}
      i++;
      setTimeout(next, 2000);
    };
    setTimeout(next, 3000); // Attendre 3s que l'interface soit chargée
  }, [authUser?.uid, data?.vin?.length]);

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
    const freshSupabase = await storage.get(KEY);
    const latestData = freshSupabase ? JSON.parse(freshSupabase.value) : data;
    const nd = {...latestData, prospectEmails:{...(latestData.prospectEmails||{}), [prospect.id]:[]}};
    await save(nd);
  };

  const scanForProspect = async (prospect, silent=false) => {
    setGmailLoading(true);
    try {
      const token = await getGToken();
      if (!token) { setGmailLoading(false); return; }
      const domain = prospect.email?.split("@")[1]?.toLowerCase();
      if (!domain) { setGmailLoading(false); return; }

      // Si domaine générique (orange, gmail, hotmail...) → utiliser l'adresse complète
      const GENERIC_DOMAINS = ["gmail.com","orange.fr","hotmail.com","hotmail.fr","yahoo.com","yahoo.fr","outlook.com","outlook.fr","free.fr","sfr.fr","laposte.net","wanadoo.fr","icloud.com","live.fr","live.com","bbox.fr","numericable.fr"];
      const emailAddr = prospect.email.toLowerCase();
      const useFullEmail = GENERIC_DOMAINS.includes(domain);
      const query = useFullEmail
        ? `from:${emailAddr} OR to:${emailAddr}`
        : `from:${domain} OR to:${domain}`;
      const queryPJ1 = useFullEmail ? `has:attachment from:${emailAddr}` : `has:attachment from:${domain}`;
      const queryPJ2 = useFullEmail ? `has:attachment to:${emailAddr}` : `has:attachment to:${domain}`;

      const [res1, res2, res3] = await Promise.all([
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(queryPJ1)}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(queryPJ2)}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [d1, d2, d3] = await Promise.all([res1.json(), res2.json(), res3.json()]);
      const emailIds = new Set((d1.messages||[]).map(m=>m.id));
      const pjIds = new Set([...(d2.messages||[]).map(m=>m.id), ...(d3.messages||[]).map(m=>m.id)]);

      const threads = await Promise.all(
        [...emailIds].map(async id => {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const msg = await r.json();
          const headers = msg.payload?.headers||[];
          const get = n => headers.find(h=>h.name===n)?.value||"";
          const from=get("From"), to=get("To"), subject=get("Subject"), date=get("Date");
          const snippet=decodeSnippet(msg.snippet);
          const labelIds=msg.labelIds||[];
          const folder=labelIds.includes("SENT")?"Envoyés":labelIds.includes("DRAFT")?"Brouillons":labelIds.includes("INBOX")?"Reçus":"Autre";
          const timestamp=msg.internalDate?parseInt(msg.internalDate):0;
          // PJ uniquement si l'email est dans notre liste ET dans la liste PJ Gmail
          const hasPJ = pjIds.has(id);
          return { id, from, to, subject, date, timestamp, prospectId:prospect.id, proj:prospect._proj||projId, folder, snippet, scannedBy:user, hasPJ };
        })
      );

      // Fusionner avec existants — relire Supabase en direct pour ne pas écraser les emails d'Harold
      const freshSupabase = await storage.get(KEY);
      const latestData = freshSupabase ? JSON.parse(freshSupabase.value) : data;
      const existingEmails = latestData?.prospectEmails?.[prospect.id]||[];
      const existingIds = new Set(existingEmails.map(e=>e.id));
      const fresh = threads.filter(t=>!existingIds.has(t.id));
      const allEmails = [...existingEmails, ...fresh].sort((a,b)=>b.timestamp-a.timestamp);
      const nd = {...latestData, prospectEmails:{...(latestData.prospectEmails||{}), [prospect.id]:allEmails}};
      await save(nd);

      // Étape 2 — PJ uniquement sur les emails qui sont dans notre liste de threads
      const threadIdsWithPJ = new Set(threads.filter(t=>t.hasPJ).map(t=>t.id));
      const existingDocs = prospect.docs||[];
      const existingNames = new Set(existingDocs.map(d=>d.name));
      let updatedDocs = [...existingDocs];

      for (const id of threadIdsWithPJ) {
        try {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
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
      if (!silent) alert(`✅ ${fresh.length} email(s)${nbDocs>0?` · ${nbDocs} pièce(s) jointe(s) dans Docs`:""}`);

    } catch(e) { console.error(e); alert("Erreur : "+e.message); }
    setGmailLoading(false);
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
                  const proj = PROJECTS[p._proj];
                  return (
                    <div key={p.id} onMouseDown={()=>{setProjId(p._proj);setDetailProspect(p);setSearchQuery("");setSearchOpen(false);}}
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
          {[["kanban","Kanban"],["commandes","Commandes"],["finance","Finance"],["agenda","Agenda"],["activite","Activité"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} className="btn"
              style={{padding:"4px 11px",borderRadius:5,fontSize:12,fontWeight:500,background:view===v?`${accent}18`:"transparent",color:view===v?accent:"#94a3b8",border:view===v?`1px solid ${accent}22`:"1px solid transparent",cursor:"pointer"}}>
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
          <button onClick={signOut} className="btn" style={{fontSize:11,color:"#94a3b8",background:"#0b0d16",border:"1px solid #1a2035",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:500}} title="Se déconnecter">← Quitter</button>
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
        <span style={{marginLeft:"auto",fontSize:11,color:"#2d3748"}}>{P.icon} {P.label}</span>
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

            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
              <StatCard label="Prospects" value={prospects.length} sub="au total" color="#60a5fa" icon="👥"/>
              <StatCard label="Commandes" value={projOrders.length} sub={`${projOrders.length>0?fmt(projOrders.reduce((s,o)=>s+o.amount,0)):"-"} total`} color="#f59e0b" icon="📦"/>
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
              {projId==="vin" && (
                <label className="btn" style={{padding:"8px 13px",background:"#f59e0b15",border:"1px solid #f59e0b28",borderRadius:8,color:"#fbbf24",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                  📥 Importer XLS
                  <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0])importXLS(e.target.files[0]);e.target.value="";}}/>
                </label>
              )}
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
              <StatCard label="Commandes" value={projOrders.length} sub="au total" color="#f59e0b" icon="📦"/>
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

        {/* ══ AGENDA ══ */}
        {view==="agenda"&&(()=>{
          const todayStr = today();
          const nowDate = new Date();
          const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
          const firstDay = (new Date(calYear, calMonth, 1).getDay()+6)%7;
          const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
          const PROJ_COLORS = {"makeup":"#ec4899","vin":"#8b5cf6","print3d":"#14b8a6","perso":"#f59e0b","autre":"#6b7280"};

          const getEventsForDay = (dateStr) => calEvents.filter(ev => {
            const start = ev.start?.date || ev.start?.dateTime?.slice(0,10);
            return start === dateStr;
          });

          const formatTime = ev => {
            if (ev.start?.date) return "";
            const t = new Date(ev.start?.dateTime);
            return `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`;
          };

          const isPrivate = ev => ev.visibility === "private" || ev.summary === undefined;
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
                  <p style={{fontSize:10,color:"#4b5563"}}>{calEvents.length} événement{calEvents.length!==1?"s":""}</p>
                </div>
                {calEvents.length===0&&!calLoading
                  ? <p style={{fontSize:12,color:"#2d3748",textAlign:"center",padding:"24px"}}>Aucun événement ce mois-ci.</p>
                  : [...calEvents].sort((a,b)=>(a.start?.date||a.start?.dateTime||"").localeCompare(b.start?.date||b.start?.dateTime||"")).map(ev=>{
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
                <button onClick={()=>scanGmail(gmailFilter)} disabled={gmailLoading} className="btn"
                  style={{padding:"8px 14px",background:"#3b82f618",border:"1px solid #3b82f628",borderRadius:7,color:"#60a5fa",fontSize:12,fontWeight:600,cursor:"pointer",opacity:gmailLoading?0.6:1}}>
                  {gmailLoading?"⏳ Scan…":"🔍 Scanner"}
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
                ? gmailThreads.filter(t => t.proj === projId)
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
                      return (
                        <div key={t.id} style={{padding:"10px 14px",borderBottom:"1px solid #080a0f",display:"flex",alignItems:"flex-start",gap:10}}>
                          <div style={{width:3,minHeight:40,borderRadius:2,background:c,flexShrink:0,marginTop:2}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                              <span style={{fontSize:12,fontWeight:600,color:"#f1f5f9",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.subject||"(sans objet)"}</span>
                              {t.prospect&&<span style={{fontSize:10,background:"#22c55e15",color:"#4ade80",padding:"1px 6px",borderRadius:3,fontWeight:600,flexShrink:0}}>✓ {t.prospect.name}</span>}
                              {gmailFilter==="tous"&&t.proj&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:`${c}15`,color:c,fontWeight:600,flexShrink:0}}>{t.proj==="makeup"?"💄":t.proj==="vin"?"🍷":"🧊"}</span>}
                            </div>
                            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                              <span style={{fontSize:10,color:"#4b5563",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{folder==="Envoyés"?`→ ${t.to}`:`← ${t.from}`}</span>
                            </div>
                            <p style={{fontSize:11,color:"#374151",lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.snippet}</p>
                          </div>
                          <span style={{fontSize:10,color:"#2d3748",flexShrink:0,whiteSpace:"nowrap",marginTop:2}}>
                            {t.timestamp ? new Date(t.timestamp).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}) : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
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
      {detailProspect&&<ProspectModal prospect={detailProspect} projId={projId} onClose={()=>setDetailProspect(null)} onUpdate={updateProspect} orders={projOrders} onAddOrder={p=>{setDetailProspect(null);setShowAddOrder(p);}} onEmail={p=>{setDetailProspect(null);setShowEmailModal(p);}} gmailThreads={gmailThreads} prospectEmails={data?.prospectEmails||{}} onSendEmail={sendGmail} onScanForProspect={scanForProspect} onClearEmails={clearProspectEmails} gmailLoading={gmailLoading}/>}
      {showAddEvent&&<AddEventModal onAdd={createCalEvent} onClose={()=>setShowAddEvent(null)} preDate={showAddEvent==="new"?null:showAddEvent} currentUser={user}/>}
      {showEmailModal&&<EmailModal prospect={showEmailModal} projId={projId} onClose={()=>setShowEmailModal(null)} onSend={sendGmail}/>}
    </div>
  );
}
