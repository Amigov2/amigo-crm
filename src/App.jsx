import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://huidlqrhqsxechtaqojx.supabase.co",
  "sb_publishable_2JtGar-T9KEPceRGqia3iA_B34O7CKD"
);

const storage = {
  async get(key) {
    const { data, error } = await supabase
      .from("amigo_data")
      .select("value")
      .eq("key", key)
      .single();
    if (error || !data) return null;
    return { value: data.value };
  },
  async set(key, value) {
    const { error } = await supabase
      .from("amigo_data")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { key, value };
  },
};


// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const USERS = {
  anthony: { label:"Anthony", color:"#3b82f6", avatar:"A" },
  harold:  { label:"Harold",  color:"#22c55e", avatar:"H" },
};

// Taxes import vin Brésil (cascade réelle)
const calcTaxesBresil = (fobEur, eurBrl = 5.40) => {
  const fobBrl  = fobEur * eurBrl;
  const frete   = fobBrl * 0.10;                          // fret estimé 10%
  const cif     = fobBrl + frete;
  const ii      = cif * 0.27;                             // Imposto de Importação 27%
  const ipi     = (cif + ii) * 0.20;                      // IPI 20%
  const pisCof  = (cif + ii + ipi) * 0.0925;             // PIS+COFINS 9.25%
  const baseIcms= cif + ii + ipi + pisCof;
  const icms    = baseIcms / (1 - 0.30) * 0.30;           // ICMS RJ 30% (por dentro)
  const total   = ii + ipi + pisCof + icms;
  const totalEur= total / eurBrl;
  return { fobBrl, cif, ii, ipi, pisCof, icms, total, totalEur, txEffective: (total/fobBrl*100).toFixed(1), eurBrl };
};

const STATUS_LIST = ["À contacter","Contacté","En discussion","Qualifié","Relance urgente","Prospect froid"];
const ORDER_STATUS = ["En attente","Confirmée","En transit","Livrée","Annulée"];
const EVENT_TYPES  = ["Appel","RDV","Relance","Livraison","Paiement","Démo","Autre"];

const SS = {
  "À contacter":    { bg:"#0f1e35", text:"#60a5fa", dot:"#3b82f6"  },
  "En discussion":  { bg:"#0a1f0a", text:"#4ade80", dot:"#22c55e"  },
  "Relance urgente":{ bg:"#1f0a0a", text:"#f87171", dot:"#ef4444"  },
  "Qualifié":       { bg:"#130f2a", text:"#a78bfa", dot:"#8b5cf6"  },
  "Prospect froid": { bg:"#0f0f0f", text:"#6b7280", dot:"#4b5563"  },
  "Contacté":       { bg:"#1a1500", text:"#fbbf24", dot:"#f59e0b"  },
};
const OS = {
  "En attente":{ bg:"#1a1500", text:"#fbbf24", dot:"#f59e0b" },
  "Confirmée": { bg:"#0a1f0a", text:"#4ade80", dot:"#22c55e" },
  "En transit":{ bg:"#0f1e35", text:"#60a5fa", dot:"#3b82f6" },
  "Livrée":    { bg:"#130f2a", text:"#a78bfa", dot:"#8b5cf6" },
  "Annulée":   { bg:"#1f0a0a", text:"#f87171", dot:"#ef4444" },
};

const AV = [["#1d4ed8","#3b82f6"],["#7c3aed","#a78bfa"],["#be185d","#ec4899"],["#0f766e","#14b8a6"],["#c2410c","#f97316"],["#15803d","#22c55e"],["#b45309","#f59e0b"],["#0e7490","#22d3ee"]];
const fmt  = (n,c="€") => `${c}${n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?Math.round(n/1000)+"k":Math.round(n)}`;
const fmtR = n => `R$${n>=1000?Math.round(n/1000)+"k":Math.round(n)}`;
const uid  = () => Math.random().toString(36).slice(2,8);
const ago  = ts => { if(!ts)return"–"; const m=Math.floor((Date.now()-ts)/60000); if(m<1)return"maintenant"; if(m<60)return`${m}min`; const h=Math.floor(m/60); if(h<24)return`${h}h`; return`${Math.floor(h/24)}j`; };
const toISO = d => { const p=d.split("/"); return p.length===3?`${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`:d; };
const fromISO = d => { if(!d)return""; const p=d.split("-"); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:d; };
const today = () => new Date().toISOString().slice(0,10);

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────

const INIT = {
  makeup: [
    { id:"m1",name:"Académie du Maquillage Paris",geo:"Paris 🇫🇷",sub:"8ème arr.",type:"École privée",   score:96,contact:"Sophie Renard",  email:"s.renard@academie-maquillage.fr",phone:"+33 1 42 65 32 01",valeur:28000,marge:"8 élèves", tags:["Artistique","Scénique"],status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"École de référence. Profil idéal Carnaval." },
    { id:"m2",name:"EFMM – École Française Maquillage",geo:"Paris 🇫🇷",sub:"11ème arr.",type:"École pro",score:89,contact:"Luc Bertrand",   email:"contact@efmm.fr",               phone:"+33 1 43 67 08 09",valeur:24000,marge:"6 élèves", tags:["SFX","Certifiée"],     status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"Spécialité SFX — parfaite pour Carnaval." },
    { id:"m3",name:"Make Up For Ever Academy",     geo:"Paris 🇫🇷",sub:"Le Marais", type:"École marque", score:84,contact:"Julie Marchand",email:"academy@makeupforever.com",    phone:"+33 1 49 26 06 06",valeur:35000,marge:"10 élèves",tags:["Prestige","International"],status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"La plus prestigieuse. Dossier premium requis." },
    { id:"m4",name:"École Mod's Hair Lyon",        geo:"Lyon 🇫🇷",  sub:"Presqu'île",type:"Groupe école",score:81,contact:"Amélie Fontaine",email:"a.fontaine@modshair.fr",       phone:"+33 4 72 41 56 20",valeur:22000,marge:"6 élèves", tags:["Réseau 12 villes"],   status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"Réseau 12 villes. Un accord = effet cascade." },
    { id:"m5",name:"Institut ISMA Bordeaux",       geo:"Bordeaux 🇫🇷",sub:"Centre", type:"École privée", score:74,contact:"Carole Dupuis",  email:"carole.dupuis@isma-bordeaux.fr",phone:"+33 5 56 44 71 90",valeur:18000,marge:"5 élèves", tags:["OPCO","Mode"],         status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"Financement OPCO possible — argument décisif." },
    { id:"m6",name:"CFA Beauté Nantes",            geo:"Nantes 🇫🇷",sub:"Centre",   type:"CFA public",   score:55,contact:"Thierry Morel",  email:"t.morel@cfa-beaute-nantes.fr",  phone:"+33 2 40 48 62 10",valeur:12000,marge:"4 élèves", tags:["Public","Budget serré"],status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"Budget limité. Priorité basse." },
  ],
  vin: [
    { id:"v1",name:"Domaine Leflaive",  geo:"France 🇫🇷",    sub:"Bourgogne",     type:"Producteur",  score:94,contact:"Marie Leflaive",  email:"m.leflaive@domaine-leflaive.fr",phone:"+33 3 80 21 30 74",valeur:85000, marge:"38%",tags:["Bio","Chardonnay"], status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"Leader Puligny-Montrachet. Ouverture RJ." },
    { id:"v2",name:"Bodegas Torres",    geo:"Espagne 🇪🇸",   sub:"Penedès",       type:"Négociant",   score:88,contact:"Carlos Torres",   email:"c.torres@torres.es",            phone:"+34 93 817 74 00",valeur:120000,marge:"42%",tags:["Volume","Tempranillo"],status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"Très réactif. Déjà actif au Brésil." },
    { id:"v3",name:"Antinori Marchesi", geo:"Italie 🇮🇹",    sub:"Toscane",       type:"Producteur",  score:91,contact:"Piero Antinori",  email:"p.antinori@antinori.it",        phone:"+39 055 23595",   valeur:200000,marge:"45%",tags:["Barolo","Prestige"],  status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"Fort potentiel prestige RJ." },
    { id:"v4",name:"Concha y Toro",     geo:"Chili 🇨🇱",     sub:"Valle Central", type:"Coopérative", score:76,contact:"Sofia Morales",   email:"s.morales@conchaytoro.cl",      phone:"+56 2 2476 5000", valeur:60000, marge:"52%",tags:["Rapport Q/P"],        status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"Excellent Q/P. Déjà au Brésil." },
    { id:"v5",name:"Penfolds Estate",   geo:"Australie 🇦🇺", sub:"Barossa Valley",type:"Producteur",  score:82,contact:"James Halliday",  email:"j.halliday@penfolds.com",       phone:"+61 8 8568 9408", valeur:95000, marge:"41%",tags:["Shiraz","Grange"],    status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"Aucun distributeur RJ — fenêtre ouverte." },
    { id:"v6",name:"Château Margaux",   geo:"France 🇫🇷",    sub:"Bordeaux",      type:"Producteur",  score:68,contact:"Albéric Bichot",  email:"contact@chateau-margaux.com",   phone:"+33 5 57 88 83 83",valeur:350000,marge:"35%",tags:["Grand Cru"],          status:"À contacter",assignedTo:null,lastEditBy:null,lastEditAt:null,note:"Via allocations. Introduction requise." },
  ],
  orders: [],   // { id, proj, prospectId, prospectName, product, qty, unitPrice, currency, orderDate, deliveryDate, status, notes, taxData }
  events: [],   // { id, proj, title, date, type, prospectId, prospectName, notes, done }
  stock:  [],   // { id, supplierId, supplierName, product, casesOrdered, casesDelivered, pricePerCase, entryDate }
  activity: [],
};

// ─── MINI COMPONENTS ─────────────────────────────────────────────────────────

const Ring = ({score,accent}) => {
  const c=score>=90?"#22c55e":score>=75?accent:"#ef4444";
  return (
    <div style={{position:"relative",width:32,height:32,flexShrink:0}}>
      <svg width="32" height="32" style={{transform:"rotate(-90deg)"}}>
        <circle cx="16" cy="16" r="11" fill="none" stroke="#1a1f2e" strokeWidth="3"/>
        <circle cx="16" cy="16" r="11" fill="none" stroke={c} strokeWidth="3"
          strokeDasharray={`${score/100*69.1} 69.1`} strokeLinecap="round"/>
      </svg>
      <span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:c}}>{score}</span>
    </div>
  );
};

const Badge = ({s,map}) => { const sc=map[s]||{bg:"#111",text:"#6b7280",dot:"#4b5563"};
  return <span style={{padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:600,background:sc.bg,color:sc.text,display:"inline-flex",alignItems:"center",gap:3}}>
    <span style={{width:4,height:4,borderRadius:"50%",background:sc.dot,display:"inline-block"}}/>{s}
  </span>;
};

const Card = ({label,value,sub,color,icon,accent}) => (
  <div style={{background:"#0b0d16",border:`1px solid ${accent||"#0f1520"}18`,borderRadius:10,padding:"11px 14px"}}>
    <div style={{display:"flex",justifyContent:"space-between"}}>
      <div>
        <p style={{fontSize:10,color:"#3d4f6b",marginBottom:4,letterSpacing:"0.4px",textTransform:"uppercase",fontWeight:600}}>{label}</p>
        <p style={{fontSize:18,fontWeight:700,color:color||"#f1f5f9",fontFamily:"'Playfair Display',serif"}}>{value}</p>
        {sub&&<p style={{fontSize:10,color:"#4b5563",marginTop:2}}>{sub}</p>}
      </div>
      <span style={{fontSize:15,opacity:0.4}}>{icon}</span>
    </div>
  </div>
);

// ─── MAIN ────────────────────────────────────────────────────────────────────

export default function AmigoCRM() {
  const [user,    setUser]    = useState(null);
  const [proj,    setProj]    = useState("makeup");
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState("pipeline");
  const [lastSync,setLastSync]= useState(null);
  const [notif,   setNotif]   = useState(null);

  // Panels
  const [selected,    setSelected]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [filterStatus,setFilterStatus]= useState("Tous");
  const [sortBy,      setSortBy]      = useState("score");
  const [editNote,    setEditNote]    = useState(null);
  const [noteText,    setNoteText]    = useState("");

  // Modals
  const [showAddProspect, setShowAddProspect] = useState(false);
  const [showAddOrder,    setShowAddOrder]    = useState(false);
  const [showAddEvent,    setShowAddEvent]    = useState(false);
  const [showAddStock,    setShowAddStock]    = useState(false);
  const [showTaxDetail,   setShowTaxDetail]   = useState(null); // order object
  const [showDraft,       setShowDraft]       = useState(false);

  // Forms
  const [pForm, setPForm] = useState({name:"",geo:"France 🇫🇷",sub:"",type:"",contact:"",email:"",phone:"",valeur:"",note:"",tag1:"",tag2:""});
  const [oForm, setOForm] = useState({prospectId:"",product:"",qty:"",unitPrice:"",currency:"EUR",orderDate:today(),deliveryDate:"",status:"En attente",notes:""});
  const [eForm, setEForm] = useState({title:"",date:today(),type:"Appel",prospectId:"",notes:""});
  const [sForm, setSForm] = useState({supplierId:"",product:"",casesOrdered:"",pricePerCase:"",entryDate:today()});

  const KEY = "amigo-v3";
  const pollRef = useRef(null);
  const prevLen = useRef(0);

  const load = useCallback(async () => {
    try { const r=await storage.get(KEY); const d=r?JSON.parse(r.value):{...INIT,orders:[],events:[],stock:[],activity:[]}; setData(d); setLastSync(Date.now()); }
    catch { setData({...INIT,orders:[],events:[],stock:[],activity:[]}); }
    finally { setLoading(false); }
  },[]);

  const save = useCallback(async d => {
    try { await storage.set(KEY,JSON.stringify(d)); setData(d); setLastSync(Date.now()); } catch(e){console.error(e);}
  },[]);

  useEffect(()=>{ load(); pollRef.current=setInterval(load,8000); return()=>clearInterval(pollRef.current); },[load]);

  useEffect(()=>{
    if(!data)return;
    const acts=data.activity||[];
    if(prevLen.current>0&&acts.length>prevLen.current){
      const l=acts[acts.length-1]; if(l.by!==user){setNotif(l);setTimeout(()=>setNotif(null),5000);}
    }
    prevLen.current=acts.length;
  },[data,user]);

  const addActivity = (d,by,name,action,p) => ({...d, activity:[...(d.activity||[]).slice(-29),{id:Date.now(),by,byLabel:USERS[by]?.label,prospectName:name,action,at:Date.now(),proj:p}]});

  const updateProspectField = async (pid,fields) => {
    if(!data||!user)return;
    const p=data[proj].find(x=>x.id===pid);
    const upd={...fields,lastEditBy:user,lastEditAt:Date.now()};
    const label=fields.status?`→ ${fields.status}`:fields.assignedTo!==undefined?`assigné à ${USERS[fields.assignedTo]?.label||"—"}`:"modifié";
    let nd={...data,[proj]:data[proj].map(x=>x.id===pid?{...x,...upd}:x)};
    nd=addActivity(nd,user,p?.name,label,proj);
    setSelected(s=>s?.id===pid?{...s,...upd}:s);
    await save(nd);
  };

  const saveNote = async pid => { await updateProspectField(pid,{note:noteText}); setEditNote(null); };

  const addProspect = async () => {
    if(!pForm.name.trim())return;
    const p={id:(proj==="makeup"?"m":"v")+uid(),name:pForm.name,geo:pForm.geo||"France 🇫🇷",sub:pForm.sub,type:pForm.type||(proj==="makeup"?"École privée":"Producteur"),contact:pForm.contact,email:pForm.email,phone:pForm.phone,valeur:parseInt(pForm.valeur)||0,marge:proj==="makeup"?"? élèves":"?%",note:pForm.note,tags:[pForm.tag1,pForm.tag2].filter(Boolean),score:70,status:"À contacter",assignedTo:null,lastEditBy:user,lastEditAt:Date.now()};
    let nd={...data,[proj]:[...data[proj],p]};
    nd=addActivity(nd,user,p.name,"ajouté",proj);
    await save(nd); setShowAddProspect(false); setPForm({name:"",geo:"France 🇫🇷",sub:"",type:"",contact:"",email:"",phone:"",valeur:"",note:"",tag1:"",tag2:""});
  };

  const addOrder = async () => {
    const prospect=data[proj].find(x=>x.id===oForm.prospectId)||{name:oForm.prospectId};
    const fob=parseFloat(oForm.unitPrice)*parseFloat(oForm.qty||1);
    const taxData=proj==="vin"?calcTaxesBresil(fob):null;
    const o={id:"ord"+uid(),proj,prospectId:oForm.prospectId,prospectName:prospect.name,product:oForm.product,qty:parseFloat(oForm.qty)||1,unitPrice:parseFloat(oForm.unitPrice)||0,currency:oForm.currency,totalEur:fob,orderDate:oForm.orderDate,deliveryDate:oForm.deliveryDate,status:oForm.status,notes:oForm.notes,taxData,createdBy:user,createdAt:Date.now()};
    let nd={...data,orders:[...(data.orders||[]),o]};
    nd=addActivity(nd,user,prospect.name,`commande ${fmt(fob)} ajoutée`,proj);
    await save(nd); setShowAddOrder(false); setOForm({prospectId:"",product:"",qty:"",unitPrice:"",currency:"EUR",orderDate:today(),deliveryDate:"",status:"En attente",notes:""});
  };

  const addEvent = async () => {
    if(!eForm.title.trim())return;
    const prospect=data[proj].find(x=>x.id===eForm.prospectId);
    const e={id:"evt"+uid(),proj,title:eForm.title,date:eForm.date,type:eForm.type,prospectId:eForm.prospectId,prospectName:prospect?.name||"",notes:eForm.notes,done:false,createdBy:user,createdAt:Date.now()};
    let nd={...data,events:[...(data.events||[]),e]};
    await save(nd); setShowAddEvent(false); setEForm({title:"",date:today(),type:"Appel",prospectId:"",notes:""});
  };

  const addStock = async () => {
    const supplier=data.vin.find(x=>x.id===sForm.supplierId)||{name:sForm.supplierId};
    const s={id:"stk"+uid(),supplierId:sForm.supplierId,supplierName:supplier.name,product:sForm.product,casesOrdered:parseInt(sForm.casesOrdered)||0,casesDelivered:0,pricePerCase:parseFloat(sForm.pricePerCase)||0,totalValue:(parseInt(sForm.casesOrdered)||0)*(parseFloat(sForm.pricePerCase)||0),entryDate:sForm.entryDate,createdBy:user};
    let nd={...data,stock:[...(data.stock||[]),s]};
    await save(nd); setShowAddStock(false); setSForm({supplierId:"",product:"",casesOrdered:"",pricePerCase:"",entryDate:today()});
  };

  const toggleEvent = async (eid) => {
    const nd={...data,events:data.events.map(e=>e.id===eid?{...e,done:!e.done}:e)};
    await save(nd);
  };

  const updateOrderStatus = async (oid,status) => {
    const nd={...data,orders:data.orders.map(o=>o.id===oid?{...o,status}:o)};
    await save(nd);
  };

  const updateStockDelivered = async (sid,val) => {
    const nd={...data,stock:data.stock.map(s=>s.id===sid?{...s,casesDelivered:parseInt(val)||0}:s)};
    await save(nd);
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const accent = proj==="makeup"?"#ec4899":"#8b5cf6";
  const isMakeup = proj==="makeup";
  const prospects = data?.[proj]||[];
  const orders = (data?.orders||[]).filter(o=>o.proj===proj);
  const events = (data?.events||[]).filter(e=>e.proj===proj).sort((a,b)=>a.date.localeCompare(b.date));
  const stock  = proj==="vin"?(data?.stock||[]):[];
  const activity=(data?.activity||[]).filter(a=>a.proj===proj).slice(-12).reverse();

  const caConfirme = orders.filter(o=>["Confirmée","En transit","Livrée"].includes(o.status)).reduce((s,o)=>s+o.totalEur,0);
  const caPipeline = prospects.reduce((s,p)=>s+p.valeur,0);
  const totalTaxes = orders.filter(o=>o.taxData).reduce((s,o)=>s+(o.taxData?.totalEur||0),0);
  const todayEvents = events.filter(e=>!e.done&&e.date===today()).length;
  const stockValeur = stock.reduce((s,x)=>s+x.totalValue,0);

  const filtered = prospects.filter(p=>{
    const q=search.toLowerCase();
    return (!q||[p.name,p.geo,p.sub,p.contact,...(p.tags||[])].some(x=>x.toLowerCase().includes(q)))
      &&(filterStatus==="Tous"||p.status===filterStatus);
  }).sort((a,b)=>sortBy==="score"?b.score-a.score:b.valeur-a.valeur);

  // ── Login ────────────────────────────────────────────────────────────────
  if(loading) return <div style={{minHeight:"100vh",background:"#080a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"sans-serif"}}><p style={{color:"#374151"}}>Chargement…</p></div>;

  if(!user) return (
    <div style={{minHeight:"100vh",background:"#080a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:wght@500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0}.b{transition:all .15s;cursor:pointer}.b:hover{transform:translateY(-3px);border-color:#3b82f640!important}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#2563eb,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:800,color:"white",margin:"0 auto 14px"}}>A</div>
        <p style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:500,color:"#f1f5f9",marginBottom:6}}>amigo CRM</p>
        <p style={{fontSize:12,color:"#4b5563",marginBottom:36}}>Espace de travail partagé · Anthony & Harold</p>
        <div style={{display:"flex",gap:14,justifyContent:"center"}}>
          {Object.entries(USERS).map(([id,u])=>(
            <button key={id} onClick={()=>setUser(id)} className="b" style={{padding:"22px 30px",background:"#0b0d16",border:`1px solid ${u.color}25`,borderRadius:14,cursor:"pointer",minWidth:140}}>
              <div style={{width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${u.color}70,${u.color})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"white",margin:"0 auto 10px"}}>{u.avatar}</div>
              <p style={{fontSize:14,fontWeight:600,color:"#f1f5f9"}}>{u.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const U = USERS[user];
  const VIEWS = isMakeup
    ? [["pipeline","Pipeline"],["orders","Commandes"],["finance","Finance"],["agenda","Agenda"],["activity","Activité"]]
    : [["pipeline","Pipeline"],["orders","Commandes"],["finance","Finance"],["stock","Stock"],["agenda","Agenda"],["activity","Activité"]];

  // ── Modal helper ─────────────────────────────────────────────────────────
  const Modal = ({title,onClose,children,wide}) => (
    <div style={{position:"fixed",inset:0,background:"#000000c0",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="fade" style={{background:"#0d1020",border:"1px solid #1a2035",borderRadius:14,padding:22,width:wide?640:500,maxWidth:"94vw",maxHeight:"88vh",overflow:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <p style={{fontSize:14,fontWeight:600,color:"#f1f5f9",fontFamily:"'Playfair Display',serif"}}>{title}</p>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer",fontSize:19,lineHeight:1}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );

  const F = ({label,value,onChange,type="text",options,placeholder,half}) => (
    <div style={{marginBottom:10,gridColumn:half?"span 1":"span 2"}}>
      <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>{label}</p>
      {options
        ?<select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none",cursor:"pointer"}}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>
        :<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none"}}/>
      }
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#080a0f",color:"#e2e8f0",fontFamily:"'DM Sans','Helvetica Neue',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a2030;border-radius:2px}
        .hov{transition:background .15s;cursor:pointer}.hov:hover{background:#0c1020!important}
        .btn{transition:all .14s;cursor:pointer}.btn:hover{opacity:.82;transform:translateY(-1px)}
        .tag-v{display:inline-flex;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;background:#0d1828;color:#60a5fa;border:1px solid #1d4ed818;margin:2px}
        .tag-m{display:inline-flex;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;background:#1a0d1a;color:#f9a8d4;border:1px solid #be185d20;margin:2px}
        .fade{animation:fi .22s ease}@keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        .pulse{animation:pl 2.5s ease infinite}@keyframes pl{0%,100%{opacity:1}50%{opacity:.4}}
        .row{animation:re .24s ease both}@keyframes re{from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:translateX(0)}}
        .gf:focus{outline:none;border-color:#3b82f640!important;box-shadow:0 0 0 3px #3b82f610!important}
        input,textarea,select{background:#080a0f;border:1px solid #0f1520;color:#e2e8f0;font-family:'DM Sans',sans-serif}
        input::placeholder,textarea::placeholder{color:#374151}
        select option{background:#0d1020}
        .notif{animation:nf .3s ease}@keyframes nf{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        table{width:100%;border-collapse:collapse}
        th{padding:8px 12px;font-size:10px;color:#3d4f6b;text-align:left;text-transform:uppercase;letter-spacing:.4px;font-weight:600;border-bottom:1px solid #0d1020}
        td{padding:8px 12px;font-size:12px;color:#9ca3af;border-bottom:1px solid #080a0f}
        tr:hover td{background:#0b0d16}
      `}</style>

      {/* NOTIFICATION */}
      {notif&&<div className="notif" onClick={()=>setNotif(null)} style={{position:"fixed",top:10,left:"50%",transform:"translateX(-50%)",background:"#0d1020",border:"1px solid #22c55e25",borderRadius:10,padding:"8px 15px",zIndex:300,cursor:"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 20px #00000060"}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>
        <span style={{fontSize:11,color:"#e2e8f0"}}><span style={{color:USERS[notif.by]?.color,fontWeight:600}}>{notif.byLabel}</span> — <span style={{color:"#f1f5f9",fontWeight:500}}>{notif.prospectName}</span> <span style={{color:"#6b7280"}}>{notif.action}</span></span>
        <span style={{fontSize:14,color:"#374151"}}>×</span>
      </div>}

      {/* NAV */}
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 20px",borderBottom:"1px solid #0c0f18",background:"#080a0f",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <div style={{width:27,height:27,borderRadius:7,background:"linear-gradient(135deg,#2563eb,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"white"}}>A</div>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:500,color:"#f1f5f9"}}>amigo</span>
          <span style={{width:1,height:11,background:"#1a2030",margin:"0 2px"}}/>
          {[["makeup","💄","Maquillage"],["vin","🍷","Vin"]].map(([id,ic,lb])=>(
            <button key={id} onClick={()=>{setProj(id);setSelected(null);setSearch("");setFilterStatus("Tous");setView("pipeline");}} className="btn"
              style={{padding:"3px 9px",borderRadius:5,fontSize:11,fontWeight:500,cursor:"pointer",background:proj===id?`${id==="makeup"?"#ec4899":"#8b5cf6"}18`:"transparent",color:proj===id?(id==="makeup"?"#ec4899":"#a78bfa"):"#3d4f6b",border:proj===id?`1px solid ${id==="makeup"?"#ec489922":"#8b5cf622"}`:"1px solid transparent",display:"flex",alignItems:"center",gap:3}}>
              {ic} {lb}
            </button>
          ))}
        </div>

        <div style={{display:"flex",gap:2,background:"#0b0d16",borderRadius:7,padding:2,border:"1px solid #0f1520"}}>
          {VIEWS.map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} className="btn" style={{padding:"4px 10px",borderRadius:5,fontSize:11,fontWeight:500,background:view===v?`${accent}18`:"transparent",color:view===v?accent:"#3d4f6b",border:view===v?`1px solid ${accent}22`:"1px solid transparent",cursor:"pointer",position:"relative"}}>
              {l}
              {v==="agenda"&&todayEvents>0&&<span style={{position:"absolute",top:-3,right:-3,background:"#ef4444",color:"white",borderRadius:"50%",width:13,height:13,fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>{todayEvents}</span>}
            </button>
          ))}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 7px",background:"#0b0d16",borderRadius:5,border:"1px solid #0f1520"}}>
            <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>
            <span style={{fontSize:10,color:"#4b5563"}}>{lastSync?ago(lastSync):"–"}</span>
          </div>
          {Object.entries(USERS).map(([id,u])=>(
            <div key={id} onClick={()=>user!==id&&setUser(id)} title={u.label}
              style={{width:24,height:24,borderRadius:"50%",background:`linear-gradient(135deg,${u.color}70,${u.color})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white",border:user===id?`2px solid ${u.color}`:"2px solid transparent",cursor:user!==id?"pointer":"default",opacity:user===id?1:0.45}}>
              {u.avatar}
            </div>
          ))}
          <button onClick={()=>setUser(null)} className="btn" style={{fontSize:10,color:"#2d3748",background:"none",border:"none",cursor:"pointer"}}>←</button>
        </div>
      </nav>

      {/* USER STRIP */}
      <div style={{padding:"5px 20px",background:`${U.color}08`,borderBottom:`1px solid ${U.color}12`,display:"flex",alignItems:"center",gap:7}}>
        <div style={{width:16,height:16,borderRadius:"50%",background:U.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"white"}}>{U.avatar}</div>
        <span style={{fontSize:11,color:U.color,fontWeight:600}}>{U.label}</span>
        <span style={{fontSize:11,color:"#2d3748"}}>· synchronisé avec {user==="anthony"?"Harold":"Anthony"} en temps réel</span>
        {todayEvents>0&&<span style={{marginLeft:8,fontSize:11,color:"#f59e0b"}}>⚡ {todayEvents} événement{todayEvents>1?"s":""} aujourd'hui</span>}
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden",height:"calc(100vh - 85px)"}}>
        <div style={{flex:1,overflow:"auto",padding:"16px 20px"}}>

          {/* ══ PIPELINE ══ */}
          {view==="pipeline"&&(<>
            {isMakeup&&<div style={{background:"linear-gradient(135deg,#180a18,#0d1020)",border:"1px solid #be185d22",borderRadius:11,padding:"12px 16px",marginBottom:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}><span style={{fontSize:11,fontWeight:700,color:"#ec4899",textTransform:"uppercase",letterSpacing:"1px"}}>Offre active</span><span style={{fontSize:10,background:"#22c55e12",color:"#4ade80",padding:"1px 6px",borderRadius:4,fontWeight:600}}>✓ Contrat Gall</span></div>
                <p style={{fontSize:14,fontWeight:600,color:"#f9a8d4",fontFamily:"'Playfair Display',serif"}}>Package Carnaval Rio · Madame Gall</p>
                <p style={{fontSize:11,color:"#6b7280"}}>5 jours · Ateliers terrain · Hébergement Ipanema · Fév. 2026</p>
              </div>
              <div style={{textAlign:"right"}}><p style={{fontSize:20,fontWeight:700,color:"#f9a8d4",fontFamily:"'Playfair Display',serif"}}>3 500€</p><p style={{fontSize:10,color:"#374151"}}>/élève · 6–10 pers.</p></div>
            </div>}

            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
              <Card label="Pipeline"      value={fmt(caPipeline)}   sub={`${prospects.length} prospects`}                                color="#f1f5f9" icon="💼" accent={accent}/>
              <Card label="CA confirmé"   value={fmt(caConfirme)}   sub={`${orders.filter(o=>o.status!=="Annulée").length} commandes`} color="#22c55e" icon="✅" accent={accent}/>
              <Card label="Agenda auj."   value={todayEvents}       sub="événements aujourd'hui"                                       color="#f59e0b" icon="📅" accent={accent}/>
              <Card label="Vos assignés"  value={prospects.filter(p=>p.assignedTo===user).length} sub="prospects" color={U.color} icon="👤" accent={accent}/>
            </div>

            <div style={{display:"flex",gap:8,marginBottom:9}}>
              <div style={{position:"relative",flex:1,maxWidth:380}}>
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#2d3748"}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…" className="gf" style={{width:"100%",padding:"8px 10px 8px 28px",borderRadius:8,fontSize:12}}/>
                {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#4b5563",cursor:"pointer"}}>×</button>}
              </div>
              <button onClick={()=>setShowAddProspect(true)} className="btn" style={{padding:"8px 13px",background:`${accent}18`,border:`1px solid ${accent}28`,borderRadius:8,color:accent,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                + {isMakeup?"École":"Fournisseur"}
              </button>
              <button onClick={()=>setShowAddOrder(true)} className="btn" style={{padding:"8px 13px",background:"#22c55e15",border:"1px solid #22c55e28",borderRadius:8,color:"#4ade80",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                + Commande
              </button>
              <button onClick={()=>setShowAddEvent(true)} className="btn" style={{padding:"8px 13px",background:"#f59e0b15",border:"1px solid #f59e0b28",borderRadius:8,color:"#fbbf24",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                + Agenda
              </button>
            </div>

            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:12}}>
              {["Tous",...STATUS_LIST].map(s=>{const sc=SS[s]||{};const a=filterStatus===s;
                return <button key={s} onClick={()=>setFilterStatus(s)} className="btn" style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:600,border:`1px solid ${a?(sc.dot||accent):"#0f1520"}`,background:a?(sc.bg||"#0f172a"):"transparent",color:a?(sc.text||accent):"#3d4f6b",cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>
                  {s!=="Tous"&&<span style={{width:4,height:4,borderRadius:"50%",background:a?sc.dot:"#2d3748",display:"inline-block"}}/>}{s}
                </button>;})}
              <div style={{marginLeft:"auto",display:"flex",gap:3}}>
                {[["score","Score"],["valeur","Valeur"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setSortBy(v)} className="btn" style={{padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600,background:sortBy===v?`${accent}18`:"transparent",border:`1px solid ${sortBy===v?accent+"22":"#0f1520"}`,color:sortBy===v?accent:"#3d4f6b",cursor:"pointer"}}>{l}</button>
                ))}
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {filtered.map((p,i)=>{
                const sc=SS[p.status]||SS["À contacter"];const isOpen=selected?.id===p.id;
                const [c1,c2]=AV[Math.abs((p.id||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0))%AV.length];
                const au=p.assignedTo?USERS[p.assignedTo]:null;const eu=p.lastEditBy?USERS[p.lastEditBy]:null;
                const myOrders=orders.filter(o=>o.prospectId===p.id);
                return (
                  <div key={p.id} className="row" style={{background:isOpen?"#0b1525":"#0b0d16",border:`1px solid ${isOpen?accent+"22":"#0f1520"}`,borderRadius:10,padding:"11px 14px",animationDelay:`${i*.03}s`,transition:"background .15s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setSelected(isOpen?null:{...p})}>
                      <div style={{width:31,height:31,borderRadius:8,flexShrink:0,background:`linear-gradient(135deg,${c1},${c2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"white"}}>{p.name[0]}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,flexWrap:"wrap"}}>
                          <span style={{fontSize:12,fontWeight:600,color:"#f1f5f9"}}>{p.name}</span>
                          {p.geo&&<span style={{fontSize:11,color:"#374151"}}>{p.geo}</span>}
                          {au&&<span style={{fontSize:10,padding:"1px 5px",borderRadius:3,background:`${au.color}18`,color:au.color,fontWeight:600}}>→ {au.label}</span>}
                          {myOrders.length>0&&<span style={{fontSize:10,padding:"1px 5px",borderRadius:3,background:"#22c55e15",color:"#4ade80",fontWeight:600}}>📦 {myOrders.length} cmd</span>}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <Badge s={p.status} map={SS}/>
                          {eu&&p.lastEditAt&&<span style={{fontSize:10,color:"#374151"}}>{eu.label} · {ago(p.lastEditAt)}</span>}
                        </div>
                      </div>
                      <Ring score={p.score} accent={accent}/>
                      <div style={{textAlign:"right",minWidth:65}}>
                        <p style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>{fmt(p.valeur)}</p>
                        <p style={{fontSize:10,color:accent,marginTop:1}}>{p.marge}</p>
                      </div>
                      <span style={{color:"#2d3748",fontSize:13,transition:"transform .2s",transform:isOpen?"rotate(90deg)":"none"}}>›</span>
                    </div>
                    {isOpen&&(
                      <div className="fade" style={{marginTop:12,paddingTop:12,borderTop:"1px solid #0d1020"}}>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:10}}>
                          <div>
                            <p style={{fontSize:10,color:"#3d4f6b",textTransform:"uppercase",marginBottom:4,fontWeight:600}}>Contact</p>
                            {p.contact&&<p style={{fontSize:11,fontWeight:600,color:"#e2e8f0",marginBottom:1}}>{p.contact}</p>}
                            {p.email&&<p style={{fontSize:10,color:"#3b82f6",marginBottom:1}}>{p.email}</p>}
                            {p.phone&&<p style={{fontSize:10,color:"#374151"}}>{p.phone}</p>}
                          </div>
                          <div>
                            <p style={{fontSize:10,color:"#3d4f6b",textTransform:"uppercase",marginBottom:4,fontWeight:600}}>Statut</p>
                            <select value={p.status} onChange={e=>updateProspectField(p.id,{status:e.target.value})} style={{width:"100%",padding:"5px 7px",borderRadius:6,fontSize:11,outline:"none",cursor:"pointer",marginBottom:6}}>
                              {STATUS_LIST.map(s=><option key={s} value={s}>{s}</option>)}
                            </select>
                            <select value={p.assignedTo||""} onChange={e=>updateProspectField(p.id,{assignedTo:e.target.value||null})} style={{width:"100%",padding:"5px 7px",borderRadius:6,fontSize:11,outline:"none",cursor:"pointer"}}>
                              <option value="">— Non assigné</option>
                              {Object.entries(USERS).map(([id,u])=><option key={id} value={id}>{u.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <p style={{fontSize:10,color:"#3d4f6b",textTransform:"uppercase",marginBottom:4,fontWeight:600}}>Tags</p>
                            <div>{(p.tags||[]).map(t=><span key={t} className={isMakeup?"tag-m":"tag-v"}>{t}</span>)}</div>
                            {myOrders.length>0&&<><p style={{fontSize:10,color:"#3d4f6b",textTransform:"uppercase",marginTop:8,marginBottom:3,fontWeight:600}}>Commandes</p>
                            {myOrders.map(o=><p key={o.id} style={{fontSize:10,color:"#4ade80",marginBottom:1}}>{fmt(o.totalEur)} · {o.status}</p>)}</>}
                          </div>
                        </div>
                        <div style={{padding:"8px 10px",background:"#080a0f",borderRadius:8,border:"1px solid #0d1020",marginBottom:9}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                            <p style={{fontSize:10,color:"#3d4f6b"}}>📝 Note</p>
                            {editNote!==p.id?<button onClick={()=>{setEditNote(p.id);setNoteText(p.note||"");}} className="btn" style={{fontSize:10,color:accent,background:"none",border:"none",cursor:"pointer"}}>Modifier</button>
                              :<div style={{display:"flex",gap:7}}><button onClick={()=>saveNote(p.id)} className="btn" style={{fontSize:10,color:"#4ade80",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>✓ OK</button><button onClick={()=>setEditNote(null)} className="btn" style={{fontSize:10,color:"#4b5563",background:"none",border:"none",cursor:"pointer"}}>Annuler</button></div>}
                          </div>
                          {editNote===p.id?<textarea value={noteText} onChange={e=>setNoteText(e.target.value)} style={{width:"100%",padding:"6px",borderRadius:6,fontSize:11,resize:"none",height:60,lineHeight:1.6,outline:"none"}}/>
                            :<p style={{fontSize:11,color:"#6b7280",lineHeight:1.5}}>{p.note||"Aucune note."}</p>}
                        </div>
                        <div style={{display:"flex",gap:5}}>
                          <button onClick={()=>{setOForm(f=>({...f,prospectId:p.id}));setShowAddOrder(true);}} className="btn" style={{padding:"5px 10px",borderRadius:6,fontSize:11,background:"#22c55e12",border:"1px solid #22c55e22",color:"#4ade80",cursor:"pointer"}}>📦 Commande</button>
                          <button onClick={()=>{setEForm(f=>({...f,prospectId:p.id,title:`Appel — ${p.name}`}));setShowAddEvent(true);}} className="btn" style={{padding:"5px 10px",borderRadius:6,fontSize:11,background:"#f59e0b12",border:"1px solid #f59e0b22",color:"#fbbf24",cursor:"pointer"}}>📅 Agenda</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!filtered.length&&<div style={{textAlign:"center",padding:"40px",color:"#2d3748"}}><p style={{fontSize:20,marginBottom:8}}>{isMakeup?"🎓":"🍷"}</p><p style={{fontSize:12}}>Aucun prospect</p></div>}
            </div>
          </>)}

          {/* ══ COMMANDES ══ */}
          {view==="orders"&&(<div className="fade">
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
              <Card label="Total commandes" value={fmt(orders.reduce((s,o)=>s+o.totalEur,0))} sub={`${orders.length} commandes`} color="#f1f5f9" icon="📦" accent={accent}/>
              <Card label="CA confirmé"     value={fmt(caConfirme)} sub="confirmé/transit/livré" color="#22c55e" icon="✅" accent={accent}/>
              <Card label="En attente"      value={fmt(orders.filter(o=>o.status==="En attente").reduce((s,o)=>s+o.totalEur,0))} sub="à confirmer" color="#f59e0b" icon="⏳" accent={accent}/>
              {!isMakeup&&<Card label="Taxes import" value={fmt(totalTaxes)} sub="estimé Brésil total" color="#ef4444" icon="🇧🇷" accent={accent}/>}
              {isMakeup&&<Card label="Élèves potentiels" value={orders.reduce((s,o)=>s+(o.qty||0),0)} sub="élèves confirmés" color="#ec4899" icon="🎓" accent={accent}/>}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
              <button onClick={()=>setShowAddOrder(true)} className="btn" style={{padding:"8px 14px",background:"#22c55e15",border:"1px solid #22c55e28",borderRadius:8,color:"#4ade80",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Nouvelle commande</button>
            </div>
            {orders.length===0?<div style={{textAlign:"center",padding:"50px",color:"#2d3748"}}><p style={{fontSize:22,marginBottom:8}}>📦</p><p style={{fontSize:12}}>Aucune commande.<br/>Ajoutez votre première commande !</p></div>
            :<table>
              <thead><tr>
                <th>Prospect</th><th>Produit</th><th>Qté</th><th>Montant HT</th>
                {!isMakeup&&<th>Taxes BR</th>}{!isMakeup&&<th>Total BR</th>}
                <th>Date cmd</th><th>Livraison</th><th>Statut</th><th></th>
              </tr></thead>
              <tbody>{orders.map(o=>{
                const os=OS[o.status]||{};
                return <tr key={o.id}>
                  <td style={{color:"#f1f5f9",fontWeight:500}}>{o.prospectName}</td>
                  <td>{o.product}</td>
                  <td>{o.qty} {isMakeup?"élèves":"caisses"}</td>
                  <td style={{color:"#f1f5f9",fontWeight:600}}>{fmt(o.totalEur)}</td>
                  {!isMakeup&&<td><button onClick={()=>setShowTaxDetail(o)} style={{fontSize:10,color:"#ef4444",background:"#1f0a0a",border:"1px solid #ef444420",padding:"2px 7px",borderRadius:4,cursor:"pointer",fontWeight:600}}>{o.taxData?fmt(o.taxData.totalEur)+" ⓘ":"–"}</button></td>}
                  {!isMakeup&&<td style={{color:"#fbbf24",fontWeight:600}}>{o.taxData?`R$ ${Math.round(o.taxData.cif+o.taxData.total).toLocaleString("fr")}`:"-"}</td>}
                  <td>{fromISO(o.orderDate)}</td>
                  <td style={{color:o.deliveryDate?"#f1f5f9":"#374151"}}>{o.deliveryDate?fromISO(o.deliveryDate):"–"}</td>
                  <td><Badge s={o.status} map={OS}/></td>
                  <td>
                    <select value={o.status} onChange={e=>updateOrderStatus(o.id,e.target.value)} style={{padding:"3px 6px",borderRadius:5,fontSize:10,outline:"none",cursor:"pointer",background:"#0b0d16"}}>
                      {ORDER_STATUS.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>;
              })}</tbody>
            </table>}
          </div>)}

          {/* ══ FINANCE ══ */}
          {view==="finance"&&(<div className="fade">
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
              <Card label="CA pipeline"  value={fmt(caPipeline)}  sub="valeur potentielle" color="#60a5fa" icon="📊" accent={accent}/>
              <Card label="CA confirmé"  value={fmt(caConfirme)}  sub="hors taxes"         color="#22c55e" icon="💶" accent={accent}/>
              <Card label="Taxes totales" value={fmt(totalTaxes)} sub={isMakeup?"TVA/charges":"import Brésil estimé"} color="#ef4444" icon="🏛" accent={accent}/>
              <Card label="Marge nette est." value={fmt(caConfirme*0.35)} sub="~35% après taxes" color="#a78bfa" icon="📈" accent={accent}/>
            </div>

            {!isMakeup&&<>
              <div style={{background:"#0b0d16",border:"1px solid #ef444418",borderRadius:11,padding:18,marginBottom:12}}>
                <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9",marginBottom:4}}>🇧🇷 Taxes import vin — Brésil (simulation sur €10 000 FOB)</p>
                <p style={{fontSize:11,color:"#6b7280",marginBottom:14}}>Calcul en cascade · Taux en vigueur Rio de Janeiro · 1€ = R$5,40</p>
                {(()=>{const t=calcTaxesBresil(10000);return(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                    {[
                      {label:"FOB (valeur achat)",     val:`€${t.fobBrl/5.4|0}`,   brl:fmtR(t.fobBrl),   color:"#f1f5f9", note:"Base de calcul"},
                      {label:"CIF (FOB + fret 10%)",   val:fmtR(t.cif),             brl:"",               color:"#f1f5f9", note:"Fret estimé 10%"},
                      {label:"II — Imposto Importação",val:fmtR(t.ii),              brl:"27% du CIF",     color:"#f87171", note:"Taxe douanière fédérale"},
                      {label:"IPI — Imposto Produtos",  val:fmtR(t.ipi),            brl:"20% (CIF+II)",   color:"#f87171", note:"Taxe fédérale produit"},
                      {label:"PIS + COFINS",            val:fmtR(t.pisCof),         brl:"9,25%",          color:"#fbbf24", note:"Contribuições federais"},
                      {label:"ICMS — Rio de Janeiro",   val:fmtR(t.icms),           brl:"30% por dentro", color:"#fb923c", note:"Taxe état RJ"},
                    ].map(x=>(
                      <div key={x.label} style={{background:"#080a0f",borderRadius:8,padding:"10px 12px",border:"1px solid #0f1520"}}>
                        <p style={{fontSize:10,color:"#4b5563",marginBottom:4}}>{x.label}</p>
                        <p style={{fontSize:15,fontWeight:700,color:x.color,fontFamily:"'Playfair Display',serif"}}>{x.val}</p>
                        {x.brl&&<p style={{fontSize:10,color:"#374151",marginTop:2}}>{x.brl}</p>}
                        <p style={{fontSize:10,color:"#2d3748",marginTop:2}}>{x.note}</p>
                      </div>
                    ))}
                  </div>
                );})()}
                <div style={{marginTop:14,padding:"12px 14px",background:"#1f0a0a",borderRadius:8,border:"1px solid #ef444420",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><p style={{fontSize:11,color:"#6b7280"}}>Total taxes sur €10 000 FOB</p><p style={{fontSize:11,color:"#f87171",marginTop:2}}>Taux effectif = {calcTaxesBresil(10000).txEffective}% du FOB</p></div>
                  <div style={{textAlign:"right"}}>
                    <p style={{fontSize:22,fontWeight:700,color:"#f87171",fontFamily:"'Playfair Display',serif"}}>{fmtR(calcTaxesBresil(10000).total)}</p>
                    <p style={{fontSize:11,color:"#ef4444"}}>≈ {fmt(calcTaxesBresil(10000).totalEur)}</p>
                  </div>
                </div>
              </div>
            </>}

            <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:11,padding:16}}>
              <p style={{fontSize:11,fontWeight:600,color:"#f1f5f9",marginBottom:12}}>Détail par commande</p>
              {orders.length===0?<p style={{fontSize:12,color:"#374151",textAlign:"center",padding:"20px"}}>Aucune commande enregistrée</p>
              :<table>
                <thead><tr><th>Prospect</th><th>Produit</th><th>CA HT</th>{!isMakeup&&<th>Taxes</th>}<th>Marge est.</th><th>Statut</th></tr></thead>
                <tbody>{orders.map(o=>(
                  <tr key={o.id}>
                    <td style={{color:"#f1f5f9",fontWeight:500}}>{o.prospectName}</td>
                    <td>{o.product||"–"}</td>
                    <td style={{color:"#22c55e",fontWeight:600}}>{fmt(o.totalEur)}</td>
                    {!isMakeup&&<td style={{color:"#ef4444"}}>{o.taxData?fmt(o.taxData.totalEur):"–"}</td>}
                    <td style={{color:"#a78bfa"}}>{fmt(o.totalEur*0.35)}</td>
                    <td><Badge s={o.status} map={OS}/></td>
                  </tr>
                ))}</tbody>
              </table>}
            </div>
          </div>)}

          {/* ══ STOCK (vin seulement) ══ */}
          {view==="stock"&&!isMakeup&&(<div className="fade">
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
              <Card label="Valeur stock"   value={fmt(stockValeur)}                                         sub="total fournisseurs"    color="#f1f5f9" icon="🏪" accent={accent}/>
              <Card label="Caisses cmd."   value={stock.reduce((s,x)=>s+x.casesOrdered,0)}                  sub="commandées"            color="#60a5fa" icon="📦" accent={accent}/>
              <Card label="Livrées"        value={stock.reduce((s,x)=>s+x.casesDelivered,0)}                sub="caisses reçues"         color="#22c55e" icon="✅" accent={accent}/>
              <Card label="En attente"     value={stock.reduce((s,x)=>s+(x.casesOrdered-x.casesDelivered),0)} sub="caisses en transit"  color="#f59e0b" icon="🚢" accent={accent}/>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
              <button onClick={()=>setShowAddStock(true)} className="btn" style={{padding:"8px 13px",background:"#8b5cf618",border:"1px solid #8b5cf628",borderRadius:8,color:"#a78bfa",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Entrée stock</button>
            </div>
            {stock.length===0?<div style={{textAlign:"center",padding:"50px",color:"#2d3748"}}><p style={{fontSize:22,marginBottom:8}}>🍾</p><p style={{fontSize:12}}>Aucun stock.<br/>Ajoutez une entrée de stock !</p></div>
            :<table>
              <thead><tr><th>Fournisseur</th><th>Produit</th><th>Commandées</th><th>Livrées</th><th>Restantes</th><th>Prix/caisse</th><th>Valeur</th><th>Date</th></tr></thead>
              <tbody>{stock.map(s=>{
                const reste=s.casesOrdered-s.casesDelivered;
                return <tr key={s.id}>
                  <td style={{color:"#f1f5f9",fontWeight:500}}>{s.supplierName}</td>
                  <td>{s.product}</td>
                  <td style={{color:"#60a5fa"}}>{s.casesOrdered}</td>
                  <td><input type="number" value={s.casesDelivered} onChange={e=>updateStockDelivered(s.id,e.target.value)} style={{width:55,padding:"2px 5px",borderRadius:4,fontSize:11,outline:"none",textAlign:"center"}}/></td>
                  <td style={{color:reste>0?"#f59e0b":"#22c55e",fontWeight:600}}>{reste}</td>
                  <td>{fmt(s.pricePerCase)}</td>
                  <td style={{color:"#f1f5f9",fontWeight:600}}>{fmt(s.totalValue)}</td>
                  <td style={{color:"#4b5563"}}>{fromISO(s.entryDate)}</td>
                </tr>;
              })}</tbody>
            </table>}
          </div>)}

          {/* ══ AGENDA ══ */}
          {view==="agenda"&&(<div className="fade">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{display:"flex",gap:8}}>
                <Card label="Aujourd'hui" value={events.filter(e=>!e.done&&e.date===today()).length}  sub="à faire"    color="#f59e0b" icon="📅" accent={accent}/>
                <Card label="Cette semaine" value={events.filter(e=>!e.done&&e.date>=today()).length}  sub="à venir"   color="#60a5fa" icon="📆" accent={accent}/>
                <Card label="Terminés" value={events.filter(e=>e.done).length}                         sub="complétés" color="#4ade80" icon="✅" accent={accent}/>
              </div>
              <button onClick={()=>setShowAddEvent(true)} className="btn" style={{padding:"8px 13px",background:"#f59e0b15",border:"1px solid #f59e0b28",borderRadius:8,color:"#fbbf24",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Événement</button>
            </div>

            {events.length===0?<div style={{textAlign:"center",padding:"50px",color:"#2d3748"}}><p style={{fontSize:22,marginBottom:8}}>📅</p><p style={{fontSize:12}}>Aucun événement.<br/>Planifiez votre premier RDV !</p></div>
            :<div style={{display:"flex",flexDirection:"column",gap:6}}>
              {events.map(e=>{
                const isToday=e.date===today();const isPast=e.date<today()&&!e.done;
                const typeColors={Appel:"#3b82f6",RDV:"#8b5cf6",Relance:"#f59e0b",Livraison:"#22c55e",Paiement:"#ec4899",Démo:"#14b8a6",Autre:"#6b7280"};
                const tc=typeColors[e.type]||"#6b7280";
                return (
                  <div key={e.id} style={{background:e.done?"#080a0f":"#0b0d16",border:`1px solid ${isToday?"#f59e0b22":isPast?"#ef444420":"#0f1520"}`,borderRadius:9,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,opacity:e.done?0.5:1}}>
                    <button onClick={()=>toggleEvent(e.id)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${e.done?"#22c55e":"#1f2937"}`,background:e.done?"#22c55e15":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {e.done&&<span style={{fontSize:10,color:"#22c55e"}}>✓</span>}
                    </button>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                        <span style={{fontSize:12,fontWeight:600,color:e.done?"#6b7280":"#f1f5f9",textDecoration:e.done?"line-through":"none"}}>{e.title}</span>
                        <span style={{fontSize:10,padding:"1px 6px",borderRadius:4,background:`${tc}15`,color:tc,fontWeight:600}}>{e.type}</span>
                        {e.prospectName&&<span style={{fontSize:10,color:"#4b5563"}}>· {e.prospectName}</span>}
                      </div>
                      {e.notes&&<p style={{fontSize:11,color:"#4b5563"}}>{e.notes}</p>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <p style={{fontSize:12,fontWeight:600,color:isToday?"#f59e0b":isPast?"#ef4444":"#9ca3af"}}>{fromISO(e.date)}</p>
                      {isToday&&<p style={{fontSize:10,color:"#f59e0b"}}>Aujourd'hui</p>}
                      {isPast&&!e.done&&<p style={{fontSize:10,color:"#ef4444"}}>En retard</p>}
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>)}

          {/* ══ ACTIVITÉ ══ */}
          {view==="activity"&&(<div className="fade">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
              {Object.entries(USERS).map(([uid,u])=>{
                const mine=prospects.filter(p=>p.assignedTo===uid);
                return <div key={uid} style={{background:"#0b0d16",border:`1px solid ${u.color}15`,borderRadius:10,padding:14}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${u.color}70,${u.color})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"white"}}>{u.avatar}</div>
                    <p style={{fontSize:12,fontWeight:600,color:"#f1f5f9"}}>{u.label} {user===uid&&<span style={{fontSize:10,color:"#4b5563"}}>(vous)</span>}</p>
                  </div>
                  {[{l:"Assignés",v:mine.length,c:u.color},{l:"Modifiés",v:prospects.filter(p=>p.lastEditBy===uid).length,c:"#f1f5f9"},{l:"Commandes",v:orders.filter(o=>o.createdBy===uid).length,c:"#22c55e"}].map(r=>(
                    <div key={r.l} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:11,color:"#4b5563"}}>{r.l}</span><span style={{fontSize:12,fontWeight:700,color:r.c}}>{r.v}</span>
                    </div>
                  ))}
                </div>;
              })}
            </div>
            <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:10,overflow:"hidden"}}>
              <div style={{padding:"9px 14px",borderBottom:"1px solid #0d1020",display:"flex",alignItems:"center",gap:7}}>
                <span className="pulse" style={{width:5,height:5,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>
                <p style={{fontSize:11,color:"#6b7280",fontWeight:600}}>Fil d'activité</p>
              </div>
              {activity.length===0?<div style={{padding:"30px",textAlign:"center",color:"#2d3748"}}><p style={{fontSize:12}}>Aucune activité encore.</p></div>
              :activity.map((a,i)=>{const u=USERS[a.by]; return(
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
          </div>)}
        </div>

        {/* IA PANEL */}
        <div style={{width:220,flexShrink:0,borderLeft:"1px solid #0c0f18",padding:"14px 12px",overflow:"auto",background:"#06080c",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span className="pulse" style={{fontSize:11,color:accent}}>✦</span>
            <span style={{fontSize:11,fontWeight:600,color:"#e2e8f0"}}>Copilote</span>
          </div>
          {[
            {icon:"🚀",color:accent,title:isMakeup?"Lancer 3 premiers contacts":"Prioriser les prospects",body:isMakeup?"Académie, EFMM, Make Up For Ever — envoyez les propositions cette semaine.":"Antinori (91), Leflaive (94) et Torres (88) — contactez-les en premier.",draft:isMakeup},
            {icon:"📅",color:"#f59e0b",title:"Planifier dans l'agenda",body:`${todayEvents} événement${todayEvents>1?"s":""} prévu${todayEvents>1?"s":""} aujourd'hui. Vérifiez l'onglet Agenda.`},
            {icon:"💰",color:"#22c55e",title:"Suivre le CA",body:`Pipeline actuel : ${fmt(caPipeline)}. CA confirmé : ${fmt(caConfirme)}. Consultez l'onglet Finance.`},
          ].map((s,i)=>(
            <div key={i} className="hov" style={{background:"#0b0d16",border:`1px solid ${s.color}18`,borderRadius:9,padding:"9px 10px",borderLeft:`3px solid ${s.color}`}}>
              <div style={{display:"flex",gap:7}}>
                <span style={{fontSize:12,flexShrink:0}}>{s.icon}</span>
                <div>
                  <p style={{fontSize:11,fontWeight:600,color:"#f1f5f9",marginBottom:2}}>{s.title}</p>
                  <p style={{fontSize:10,color:"#4b5563",lineHeight:1.4}}>{s.body}</p>
                  {s.draft&&<button onClick={()=>setShowDraft(true)} className="btn" style={{marginTop:7,width:"100%",padding:"4px 7px",background:`${s.color}10`,border:`1px solid ${s.color}20`,borderRadius:5,color:"#f9a8d4",fontSize:10,fontWeight:600,cursor:"pointer"}}>Brouillon →</button>}
                </div>
              </div>
            </div>
          ))}
          <div style={{background:"#0b0d16",border:"1px solid #0f1520",borderRadius:9,padding:10}}>
            <p style={{fontSize:10,color:"#2d3748",fontWeight:600,marginBottom:6}}>✦ Demander à Amigo</p>
            <textarea placeholder={isMakeup?"Rédige une prop EFMM...\nCalcule les taxes...":"Calcule marge Torres...\nRédige email Antinori..."} style={{width:"100%",padding:"6px 8px",borderRadius:6,fontSize:11,resize:"none",height:55,lineHeight:1.6,outline:"none"}}/>
            <button className="btn" style={{width:"100%",marginTop:6,padding:"5px",background:`${accent}10`,border:`1px solid ${accent}18`,borderRadius:6,color:accent,fontSize:11,fontWeight:600,cursor:"pointer"}}>Envoyer →</button>
          </div>
        </div>
      </div>

      {/* ══ MODALS ══ */}

      {/* ADD PROSPECT */}
      {showAddProspect&&<Modal title={`➕ ${isMakeup?"Ajouter une école":"Ajouter un fournisseur"}`} onClose={()=>setShowAddProspect(false)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
          {[
            {label:"Nom *",k:"name",placeholder:isMakeup?"École Nationale...":"Domaine Dupont..."},
            {label:"Ville/Pays",k:"geo",placeholder:"Paris 🇫🇷"},
            {label:"Quartier/Région",k:"sub",placeholder:isMakeup?"Rive Gauche":"Bourgogne"},
            {label:"Type",k:"type",placeholder:isMakeup?"École privée, CFA...":"Producteur..."},
            {label:"Contact",k:"contact",placeholder:"Prénom Nom"},
            {label:"Email",k:"email",placeholder:"contact@ecole.fr"},
            {label:"Téléphone",k:"phone",placeholder:"+33 1 ..."},
            {label:isMakeup?"Valeur pack (€)":"Valeur estimée (€)",k:"valeur",placeholder:"15000"},
            {label:"Tag 1",k:"tag1",placeholder:isMakeup?"Artistique":"Bio"},
            {label:"Tag 2",k:"tag2",placeholder:isMakeup?"Scénique":"Volume"},
          ].map(x=><div key={x.k} style={{marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>{x.label}</p>
            <input value={pForm[x.k]} onChange={e=>setPForm(f=>({...f,[x.k]:e.target.value}))} placeholder={x.placeholder} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none"}}/>
          </div>)}
          <div style={{gridColumn:"span 2",marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>Note</p>
            <textarea value={pForm.note} onChange={e=>setPForm(f=>({...f,note:e.target.value}))} placeholder="Contexte, potentiel..." style={{width:"100%",padding:"7px 9px",borderRadius:7,fontSize:12,resize:"none",height:55,outline:"none"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={addProspect} className="btn" style={{flex:1,padding:"9px",background:`linear-gradient(135deg,${accent},${accent}99)`,border:"none",borderRadius:7,color:"white",fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ Ajouter</button>
          <button onClick={()=>setShowAddProspect(false)} className="btn" style={{padding:"9px 14px",background:"#0b0d16",border:"1px solid #0f1520",borderRadius:7,color:"#6b7280",fontSize:12,cursor:"pointer"}}>Annuler</button>
        </div>
      </Modal>}

      {/* ADD ORDER */}
      {showAddOrder&&<Modal title="📦 Nouvelle commande" onClose={()=>setShowAddOrder(false)} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
          <div style={{marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>{isMakeup?"École":"Fournisseur"}</p>
            <select value={oForm.prospectId} onChange={e=>setOForm(f=>({...f,prospectId:e.target.value}))} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none",cursor:"pointer"}}>
              <option value="">— Sélectionner</option>
              {prospects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {[
            {label:"Produit",k:"product",placeholder:isMakeup?"Package Carnaval Gall":"Barolo 2021, Chardonnay..."},
            {label:isMakeup?"Nb élèves":"Nb caisses",k:"qty",placeholder:"6",type:"number"},
            {label:isMakeup?"Prix/élève (€)":"Prix unitaire (€)",k:"unitPrice",placeholder:isMakeup?"3500":"850",type:"number"},
          ].map(x=><div key={x.k} style={{marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>{x.label}</p>
            <input type={x.type||"text"} value={oForm[x.k]} onChange={e=>setOForm(f=>({...f,[x.k]:e.target.value}))} placeholder={x.placeholder} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none"}}/>
          </div>)}
          <div style={{marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>Statut</p>
            <select value={oForm.status} onChange={e=>setOForm(f=>({...f,status:e.target.value}))} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none",cursor:"pointer"}}>
              {ORDER_STATUS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {[
            {label:"Date commande",k:"orderDate",type:"date"},
            {label:"Date livraison",k:"deliveryDate",type:"date"},
          ].map(x=><div key={x.k} style={{marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>{x.label}</p>
            <input type={x.type} value={oForm[x.k]} onChange={e=>setOForm(f=>({...f,[x.k]:e.target.value}))} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none"}}/>
          </div>)}
          <div style={{gridColumn:"span 2",marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>Notes</p>
            <textarea value={oForm.notes} onChange={e=>setOForm(f=>({...f,notes:e.target.value}))} placeholder="Conditions, spécificités..." style={{width:"100%",padding:"7px 9px",borderRadius:7,fontSize:12,resize:"none",height:50,outline:"none"}}/>
          </div>
        </div>
        {!isMakeup&&oForm.unitPrice&&oForm.qty&&(()=>{const t=calcTaxesBresil(parseFloat(oForm.unitPrice)*parseFloat(oForm.qty));return(
          <div style={{marginBottom:12,padding:"10px 12px",background:"#1f0a0a",borderRadius:8,border:"1px solid #ef444420"}}>
            <p style={{fontSize:11,fontWeight:600,color:"#f87171",marginBottom:6}}>🇧🇷 Estimation taxes import Brésil</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {[{l:"Montant HT",v:`€${Math.round(parseFloat(oForm.unitPrice)*parseFloat(oForm.qty)).toLocaleString("fr")}`},{l:"II + IPI",v:fmtR(t.ii+t.ipi)},{l:"PIS/COFINS + ICMS",v:fmtR(t.pisCof+t.icms)},{l:"Total taxes",v:`≈€${Math.round(t.totalEur).toLocaleString("fr")}`}].map(x=>(
                <div key={x.l}><p style={{fontSize:9,color:"#4b5563",marginBottom:2}}>{x.l}</p><p style={{fontSize:12,fontWeight:700,color:"#f87171"}}>{x.v}</p></div>
              ))}
            </div>
          </div>
        );})()}
        <div style={{display:"flex",gap:7}}>
          <button onClick={addOrder} className="btn" style={{flex:1,padding:"9px",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:7,color:"white",fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ Enregistrer</button>
          <button onClick={()=>setShowAddOrder(false)} className="btn" style={{padding:"9px 14px",background:"#0b0d16",border:"1px solid #0f1520",borderRadius:7,color:"#6b7280",fontSize:12,cursor:"pointer"}}>Annuler</button>
        </div>
      </Modal>}

      {/* ADD EVENT */}
      {showAddEvent&&<Modal title="📅 Nouvel événement agenda" onClose={()=>setShowAddEvent(false)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
          <div style={{gridColumn:"span 2",marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>Titre *</p>
            <input value={eForm.title} onChange={e=>setEForm(f=>({...f,title:e.target.value}))} placeholder="Appel avec Sophie Renard..." style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none"}}/>
          </div>
          <div style={{marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>Type</p>
            <select value={eForm.type} onChange={e=>setEForm(f=>({...f,type:e.target.value}))} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none",cursor:"pointer"}}>
              {EVENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>Date</p>
            <input type="date" value={eForm.date} onChange={e=>setEForm(f=>({...f,date:e.target.value}))} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none"}}/>
          </div>
          <div style={{gridColumn:"span 2",marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>{isMakeup?"École liée":"Fournisseur lié"} (optionnel)</p>
            <select value={eForm.prospectId} onChange={e=>setEForm(f=>({...f,prospectId:e.target.value}))} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none",cursor:"pointer"}}>
              <option value="">— Aucun</option>
              {prospects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{gridColumn:"span 2",marginBottom:12}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>Notes</p>
            <textarea value={eForm.notes} onChange={e=>setEForm(f=>({...f,notes:e.target.value}))} placeholder="Objectif de l'appel, points à aborder..." style={{width:"100%",padding:"7px 9px",borderRadius:7,fontSize:12,resize:"none",height:55,outline:"none"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={addEvent} className="btn" style={{flex:1,padding:"9px",background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:7,color:"white",fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ Ajouter à l'agenda</button>
          <button onClick={()=>setShowAddEvent(false)} className="btn" style={{padding:"9px 14px",background:"#0b0d16",border:"1px solid #0f1520",borderRadius:7,color:"#6b7280",fontSize:12,cursor:"pointer"}}>Annuler</button>
        </div>
      </Modal>}

      {/* ADD STOCK */}
      {showAddStock&&<Modal title="🍾 Entrée de stock" onClose={()=>setShowAddStock(false)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
          <div style={{gridColumn:"span 2",marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>Fournisseur</p>
            <select value={sForm.supplierId} onChange={e=>setSForm(f=>({...f,supplierId:e.target.value}))} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none",cursor:"pointer"}}>
              <option value="">— Sélectionner</option>
              {data?.vin?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {[
            {label:"Produit",k:"product",placeholder:"Barolo 2021, 12 btl/caisse"},
            {label:"Nb caisses commandées",k:"casesOrdered",placeholder:"48",type:"number"},
            {label:"Prix/caisse (€)",k:"pricePerCase",placeholder:"850",type:"number"},
            {label:"Date entrée",k:"entryDate",type:"date"},
          ].map(x=><div key={x.k} style={{marginBottom:10}}>
            <p style={{fontSize:10,color:"#4b5563",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px"}}>{x.label}</p>
            <input type={x.type||"text"} value={sForm[x.k]} onChange={e=>setSForm(f=>({...f,[x.k]:e.target.value}))} placeholder={x.placeholder} style={{width:"100%",padding:"8px 9px",borderRadius:7,fontSize:12,outline:"none"}}/>
          </div>)}
        </div>
        {sForm.casesOrdered&&sForm.pricePerCase&&(
          <div style={{marginBottom:12,padding:"10px 12px",background:"#0a1f0a",borderRadius:8,border:"1px solid #22c55e20"}}>
            <p style={{fontSize:11,color:"#4ade80"}}>Valeur stock : <strong>{fmt(parseInt(sForm.casesOrdered)*parseFloat(sForm.pricePerCase))}</strong> · Taxes BR estimées : <strong style={{color:"#f87171"}}>{fmt(calcTaxesBresil(parseInt(sForm.casesOrdered)*parseFloat(sForm.pricePerCase)).totalEur)}</strong></p>
          </div>
        )}
        <div style={{display:"flex",gap:7}}>
          <button onClick={addStock} className="btn" style={{flex:1,padding:"9px",background:"linear-gradient(135deg,#8b5cf6,#7c3aed)",border:"none",borderRadius:7,color:"white",fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ Enregistrer</button>
          <button onClick={()=>setShowAddStock(false)} className="btn" style={{padding:"9px 14px",background:"#0b0d16",border:"1px solid #0f1520",borderRadius:7,color:"#6b7280",fontSize:12,cursor:"pointer"}}>Annuler</button>
        </div>
      </Modal>}

      {/* TAX DETAIL */}
      {showTaxDetail&&<Modal title={`🇧🇷 Détail taxes — ${showTaxDetail.prospectName}`} onClose={()=>setShowTaxDetail(null)}>
        {(()=>{const t=showTaxDetail.taxData;if(!t)return null;return(<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:14}}>
            {[{l:"Valeur FOB",v:fmt(showTaxDetail.totalEur),c:"#f1f5f9"},{l:"CIF (+fret 10%)",v:fmtR(t.cif),c:"#60a5fa"},{l:"II (27% CIF)",v:fmtR(t.ii),c:"#f87171"},{l:"IPI (20%)",v:fmtR(t.ipi),c:"#f87171"},{l:"PIS+COFINS (9,25%)",v:fmtR(t.pisCof),c:"#fbbf24"},{l:"ICMS RJ (30% p.d.)",v:fmtR(t.icms),c:"#fb923c"}].map(x=>(
              <div key={x.l} style={{background:"#080a0f",borderRadius:8,padding:"10px 12px",border:"1px solid #0f1520"}}>
                <p style={{fontSize:10,color:"#4b5563",marginBottom:4}}>{x.l}</p>
                <p style={{fontSize:14,fontWeight:700,color:x.c,fontFamily:"'Playfair Display',serif"}}>{x.v}</p>
              </div>
            ))}
          </div>
          <div style={{padding:"12px 14px",background:"#1f0a0a",borderRadius:8,border:"1px solid #ef444428",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><p style={{fontSize:11,color:"#6b7280"}}>Total taxes sur {fmt(showTaxDetail.totalEur)} FOB</p><p style={{fontSize:11,color:"#f87171",marginTop:2}}>Taux effectif {t.txEffective}% du FOB · 1€ = R${t.eurBrl}</p></div>
            <div style={{textAlign:"right"}}><p style={{fontSize:22,fontWeight:700,color:"#f87171",fontFamily:"'Playfair Display',serif"}}>{fmtR(t.total)}</p><p style={{fontSize:11,color:"#ef4444"}}>≈ {fmt(t.totalEur)}</p></div>
          </div>
        </>);})()} 
      </Modal>}

      {/* DRAFT */}
      {showDraft&&<Modal title="✉️ Proposition — Package Gall" onClose={()=>setShowDraft(false)} wide>
        <textarea defaultValue={`Objet : Voyage pédagogique · Carnaval de Rio avec Madame Gall\n\nBonjour,\n\nNous proposons à quelques écoles sélectionnées un programme immersif de 5 jours à Rio de Janeiro pendant le Carnaval (février 2026), développé en partenariat avec Madame Gall.\n\nLe programme comprend :\n• Ateliers quotidiens avec Madame Gall sur le terrain\n• Expérience directe avec les troupes et chars officiels\n• Hébergement à Ipanema (inclus)\n• Séances photo professionnelles pour le book de chaque élève\n\nTarif groupe : 3 500€ / élève (6 à 10 participants)\n\nDisponible pour un échange cette semaine ?\n\nCordialement,\nAnthony`} style={{width:"100%",height:240,padding:12,borderRadius:9,fontSize:12,resize:"vertical",outline:"none",lineHeight:1.8}}/>
        <div style={{display:"flex",gap:7,marginTop:11}}>
          <button className="btn" style={{flex:1,padding:"8px",background:"linear-gradient(135deg,#be185d,#7c3aed)",border:"none",borderRadius:7,color:"white",fontSize:12,fontWeight:600,cursor:"pointer"}}>📤 Envoyer via Gmail</button>
          <button onClick={()=>setShowDraft(false)} className="btn" style={{padding:"8px 12px",background:"#0b0d16",border:"1px solid #0f1520",borderRadius:7,color:"#4b5563",fontSize:12,cursor:"pointer"}}>Fermer</button>
        </div>
      </Modal>}
    </div>
  );
}

