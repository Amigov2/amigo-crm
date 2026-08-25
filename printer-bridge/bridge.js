#!/usr/bin/env node
/**
 * Amigo CRM — Printer Bridge
 *
 * Tourne sur le Mac Mini de l'atelier.
 * Écoute les imprimantes 3D (Bambu Lab via MQTT, Creality via Moonraker API)
 * et envoie les données d'impression vers Supabase pour le suivi stock filament.
 *
 * Usage:
 *   npm install mqtt @supabase/supabase-js
 *   node bridge.js
 */

const mqtt = require("mqtt");
const { createClient } = require("@supabase/supabase-js");
const config = require("./config.json");

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(config.supabase.url, config.supabase.anonKey);
const KEY = config.supabaseKey;

async function logPrint(printer, data) {
  try {
    const raw = await supabase.from("amigo_data").select("value").eq("key", KEY).single();
    if (!raw.data) return;
    const d = typeof raw.data.value === "string" ? JSON.parse(raw.data.value) : raw.data.value;

    // Ajouter le log d'impression
    if (!d.printLogs) d.printLogs = [];
    d.printLogs.push({
      id: Date.now(),
      printer: printer,
      ...data,
      at: Date.now(),
    });
    // Garder les 200 derniers logs
    d.printLogs = d.printLogs.slice(-200);

    // Déduire du stock filament si possible
    if (data.filamentUsedG && data.filamentUsedG > 0) {
      const stock = d.filamentStock || [];
      // Chercher la bobine active (la première qui a encore du stock)
      // TODO: matcher par couleur/matériau quand l'imprimante le fournit
      const spool = stock.find(s => (s.weightUsed || 0) < s.weightTotal);
      if (spool) {
        spool.weightUsed = Math.min(spool.weightTotal, (spool.weightUsed || 0) + Math.round(data.filamentUsedG));
        console.log(`  📉 Stock déduit: ${Math.round(data.filamentUsedG)}g de "${spool.color}" (${spool.weightUsed}/${spool.weightTotal}g)`);
      }
    }

    // Ajouter à l'activité
    d.activity = [...(d.activity || []).slice(-99), {
      id: Date.now(),
      by: "system",
      byLabel: `🖨 ${printer}`,
      prospectName: data.fileName || "Impression",
      action: `terminée · ${data.filamentUsedG ? Math.round(data.filamentUsedG) + "g" : ""} · ${data.printTimeMin ? Math.round(data.printTimeMin) + "min" : ""}`,
      at: Date.now(),
      proj: "print3d",
    }];

    await supabase.from("amigo_data").upsert({
      key: KEY,
      value: JSON.stringify(d),
      updated_at: new Date().toISOString(),
    });

    console.log(`✅ Log envoyé → Supabase (${data.fileName || "?"})`);
  } catch (e) {
    console.error("❌ Erreur Supabase:", e.message);
  }
}

// ── Bambu Lab A1 (MQTT) ──────────────────────────────────────────────────────
function connectBambu() {
  const { ip, accessCode, serial } = config.bambu;
  if (!ip) { console.log("⚠ Bambu: pas d'IP configurée"); return; }

  console.log(`🔌 Connexion Bambu Lab A1 @ ${ip}...`);

  const client = mqtt.connect(`mqtts://${ip}:8883`, {
    username: "bblp",
    password: accessCode,
    rejectUnauthorized: false,
    clientId: `amigo_bridge_${Date.now()}`,
  });

  let lastPrintId = null;
  let currentPrint = {};

  client.on("connect", () => {
    console.log("✅ Bambu Lab connectée !");
    // S'abonner au topic de rapport
    client.subscribe(`device/${serial}/report`);
  });

  client.on("message", (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      const print = data.print || {};

      // Suivre l'état de l'impression
      if (print.gcode_state) {
        const state = print.gcode_state;
        const progress = print.mc_percent || 0;
        const fileName = print.subtask_name || print.gcode_file || "";
        const timeRemain = print.mc_remaining_time || 0; // minutes

        // Mise à jour de l'impression en cours
        if (state === "RUNNING" || state === "PREPARE") {
          if (fileName !== currentPrint.fileName) {
            currentPrint = { fileName, startedAt: Date.now(), state };
            console.log(`🖨 Impression démarrée: ${fileName}`);
          }
          if (progress > 0 && progress % 25 === 0 && progress !== currentPrint.lastLog) {
            currentPrint.lastLog = progress;
            console.log(`  ⏳ ${fileName}: ${progress}% (reste ~${timeRemain}min)`);
          }
        }

        // Impression terminée
        if (state === "FINISH" && currentPrint.fileName) {
          const printTimeMin = currentPrint.startedAt
            ? (Date.now() - currentPrint.startedAt) / 60000
            : 0;

          console.log(`🏁 Impression terminée: ${currentPrint.fileName}`);

          logPrint("Bambu A1", {
            fileName: currentPrint.fileName,
            printTimeMin: Math.round(printTimeMin),
            filamentUsedG: null, // Le A1 ne fournit pas toujours cette info via MQTT
            progress: 100,
            state: "FINISH",
          });

          currentPrint = {};
        }

        // Impression annulée
        if (state === "FAILED" || state === "IDLE") {
          if (currentPrint.fileName) {
            console.log(`⚠ Impression arrêtée/annulée: ${currentPrint.fileName}`);
            currentPrint = {};
          }
        }
      }

      // Données AMS (Automatic Material System) — poids filament
      if (data.print?.ams?.ams) {
        for (const ams of data.print.ams.ams) {
          for (const tray of (ams.tray || [])) {
            if (tray.remain !== undefined) {
              // tray.remain = pourcentage restant du filament
              // On pourrait tracker ça pour mettre à jour le stock
            }
          }
        }
      }
    } catch (e) {
      // Messages non-JSON, ignorer
    }
  });

  client.on("error", (err) => {
    console.error("❌ Bambu MQTT erreur:", err.message);
  });

  client.on("close", () => {
    console.log("🔌 Bambu déconnectée. Reconnexion dans 10s...");
    setTimeout(connectBambu, 10000);
  });
}

// ── Creality Ender 3 V3 KE (Moonraker API) ──────────────────────────────────
let creaLastJob = null;

async function pollCreality() {
  const { ip } = config.creality;
  if (!ip) return;

  try {
    // Vérifier le statut du job en cours
    const res = await fetch(`http://${ip}:7125/printer/objects/query?print_stats`);
    const data = await res.json();
    const stats = data.result?.status?.print_stats;

    if (!stats) return;

    const state = stats.state; // "printing", "complete", "standby", "error", "paused"
    const fileName = stats.filename || "";
    const printDuration = stats.print_duration || 0; // secondes
    const filamentUsed = stats.filament_used || 0; // mm

    if (state === "complete" && fileName && fileName !== creaLastJob) {
      creaLastJob = fileName;
      const filamentUsedG = (filamentUsed / 1000) * 1.24 * 3.14159 * (1.75 / 2) ** 2 / 1000;
      // filament_used est en mm → convertir en grammes (PLA ~1.24 g/cm³, diamètre 1.75mm)
      const actualG = filamentUsed * 1.24 * 3.14159 * (0.175 / 2) ** 2 / 100;

      console.log(`🏁 Creality terminée: ${fileName} (${Math.round(actualG)}g, ${Math.round(printDuration / 60)}min)`);

      await logPrint("Creality Ender 3", {
        fileName,
        printTimeMin: Math.round(printDuration / 60),
        filamentUsedG: Math.round(actualG),
        progress: 100,
        state: "complete",
      });
    }

    if (state === "printing" && fileName) {
      creaLastJob = null; // Reset pour détecter la prochaine fin
    }
  } catch (e) {
    // Imprimante peut être éteinte, pas grave
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════╗");
console.log("║   Amigo CRM — Printer Bridge v1.0   ║");
console.log("╚══════════════════════════════════════╝");
console.log("");

// Bambu Lab (MQTT temps réel)
connectBambu();

// Creality (polling toutes les 30s)
if (config.creality.ip) {
  console.log(`🔌 Creality Ender 3 V3 KE @ ${config.creality.ip} (poll ${config.pollInterval / 1000}s)`);
  setInterval(pollCreality, config.pollInterval);
  pollCreality();
} else {
  console.log("⚠ Creality: pas d'IP configurée (ajouter dans config.json)");
}

console.log("");
console.log("En écoute... (Ctrl+C pour arrêter)");
