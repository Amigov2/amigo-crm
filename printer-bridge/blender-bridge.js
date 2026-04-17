#!/usr/bin/env node
/**
 * Amigo CRM — Blender MCP Bridge
 *
 * WebSocket server that connects the CRM frontend to a running Blender instance
 * via the blender-mcp addon socket (default port 9876).
 *
 * Usage:
 *   node blender-bridge.js
 *
 * Requires: Blender running with the blender-mcp addon active.
 * The addon exposes a TCP socket server on port 9876.
 */

const net = require("net");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Config optionnelle — fonctionne sans
let config = {};
try { config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8")); } catch {}

const BLENDER_HOST = config.blender?.host || "127.0.0.1";
const BLENDER_PORT = config.blender?.port || 9876;
const WS_PORT = config.blender?.wsPort || 8769;

// ── Minimal WebSocket server (no dependencies) ─────────────────────────────
const crypto = require("crypto");

function acceptKey(key) {
  return crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-5AB9FFBD7B2E").digest("base64");
}

const server = http.createServer((req, res) => {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, blenderHost: BLENDER_HOST, blenderPort: BLENDER_PORT }));
    return;
  }

  res.writeHead(404); res.end("Not found");
});

const clients = new Set();

server.on("upgrade", (req, socket, head) => {
  const key = req.headers["sec-websocket-key"];
  if (!key) { socket.destroy(); return; }

  const headers = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
    "", ""
  ].join("\r\n");
  socket.write(headers);

  clients.add(socket);
  console.log(`🌐 CRM connecté (${clients.size} client${clients.size > 1 ? "s" : ""})`);

  socket.on("data", (buf) => {
    const msg = decodeWsFrame(buf);
    if (!msg) return;

    try {
      const cmd = JSON.parse(msg);
      handleCommand(cmd, socket);
    } catch (e) {
      sendWs(socket, JSON.stringify({ error: "Invalid JSON", detail: e.message }));
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    console.log(`🔌 CRM déconnecté (${clients.size} client${clients.size > 1 ? "s" : ""})`);
  });

  socket.on("error", () => clients.delete(socket));
});

// ── WebSocket frame encode/decode ──────────────────────────────────────────

function decodeWsFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  if (opcode === 0x08) return null; // close frame
  if (opcode !== 0x01) return null; // only text frames

  let payloadLen = buf[1] & 0x7f;
  let offset = 2;
  if (payloadLen === 126) { payloadLen = buf.readUInt16BE(2); offset = 4; }
  else if (payloadLen === 127) { payloadLen = Number(buf.readBigUInt64BE(2)); offset = 10; }

  const masked = (buf[1] & 0x80) !== 0;
  let maskKey;
  if (masked) { maskKey = buf.slice(offset, offset + 4); offset += 4; }

  const payload = buf.slice(offset, offset + payloadLen);
  if (masked) { for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i % 4]; }
  return payload.toString("utf8");
}

function encodeWsFrame(str) {
  const data = Buffer.from(str, "utf8");
  let header;
  if (data.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = data.length;
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  return Buffer.concat([header, data]);
}

function sendWs(socket, str) {
  try { socket.write(encodeWsFrame(str)); } catch (e) { /* client gone */ }
}

// ── Blender communication ──────────────────────────────────────────────────

function sendToBlender(command) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let responseData = "";

    client.connect(BLENDER_PORT, BLENDER_HOST, () => {
      const payload = JSON.stringify(command);
      // blender-mcp protocol: send JSON terminated by newline
      client.write(payload + "\n");
    });

    client.on("data", (data) => {
      responseData += data.toString();
    });

    client.on("end", () => {
      try {
        resolve(JSON.parse(responseData));
      } catch {
        resolve({ raw: responseData });
      }
      client.destroy();
    });

    client.on("error", (err) => {
      reject(err);
      client.destroy();
    });

    // Timeout after 30 seconds (3D generation can take time)
    setTimeout(() => {
      client.destroy();
      reject(new Error("Timeout: Blender n'a pas répondu en 30s"));
    }, 30000);
  });
}

async function handleCommand(cmd, socket) {
  console.log(`📨 Commande: ${cmd.action}`, cmd.params ? JSON.stringify(cmd.params).slice(0, 100) : "");

  try {
    let blenderCmd;

    switch (cmd.action) {
      case "ping":
        // Test connection to Blender
        blenderCmd = { type: "get_scene_info" };
        break;

      case "scene_info":
        blenderCmd = { type: "get_scene_info" };
        break;

      case "screenshot":
        blenderCmd = { type: "get_screenshot" };
        break;

      case "create_object":
        // { type: "cube"|"sphere"|"cylinder"|"plane"|"cone"|"torus", name, location, scale, color }
        blenderCmd = {
          type: "create_object",
          params: {
            type: cmd.params?.type || "cube",
            name: cmd.params?.name || "Objet",
            location: cmd.params?.location || [0, 0, 0],
            scale: cmd.params?.scale || [1, 1, 1],
            ...(cmd.params?.color ? { color: cmd.params.color } : {}),
          }
        };
        break;

      case "modify_object":
        blenderCmd = {
          type: "modify_object",
          params: cmd.params
        };
        break;

      case "delete_object":
        blenderCmd = {
          type: "execute_code",
          params: {
            code: `
import bpy
obj = bpy.data.objects.get("${(cmd.params?.name || "").replace(/"/g, '\\"')}")
if obj:
    bpy.data.objects.remove(obj, do_unlink=True)
    result = "Objet supprimé"
else:
    result = "Objet non trouvé"
`
          }
        };
        break;

      case "execute_code":
        blenderCmd = {
          type: "execute_code",
          params: { code: cmd.params?.code || "" }
        };
        break;

      case "export_stl":
        // Export the scene or selected object as STL
        const exportName = cmd.params?.name || "export";
        blenderCmd = {
          type: "execute_code",
          params: {
            code: `
import bpy, tempfile, base64, os
path = os.path.join(tempfile.gettempdir(), "${exportName}.stl")
bpy.ops.export_mesh.stl(filepath=path, use_selection=${cmd.params?.selected ? "True" : "False"})
with open(path, "rb") as f:
    result = base64.b64encode(f.read()).decode()
`
          }
        };
        break;

      case "clear_scene":
        blenderCmd = {
          type: "execute_code",
          params: {
            code: `
import bpy
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
result = "Scène vidée"
`
          }
        };
        break;

      case "generate_model":
        // Generate model from text description using Blender Python
        const desc = cmd.params?.description || "";
        blenderCmd = {
          type: "execute_code",
          params: {
            code: generateModelCode(desc, cmd.params)
          }
        };
        break;

      default:
        sendWs(socket, JSON.stringify({ error: `Action inconnue: ${cmd.action}` }));
        return;
    }

    const result = await sendToBlender(blenderCmd);
    sendWs(socket, JSON.stringify({ action: cmd.action, id: cmd.id, result }));
    console.log(`✅ ${cmd.action} → OK`);
  } catch (err) {
    console.error(`❌ ${cmd.action} → ${err.message}`);
    sendWs(socket, JSON.stringify({
      action: cmd.action,
      id: cmd.id,
      error: err.message,
      hint: err.code === "ECONNREFUSED"
        ? "Blender n'est pas lancé ou l'addon blender-mcp n'est pas activé. Ouvrez Blender et activez l'addon."
        : undefined
    }));
  }
}

// ── Model generation from text ─────────────────────────────────────────────

function generateModelCode(description, params) {
  // This generates Blender Python code based on a text description
  // For complex models, the user should use the full blender-mcp with Claude
  // This handles common parametric shapes
  const d = description.toLowerCase();

  return `
import bpy
import math

# Vider la scène
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Description: ${description.replace(/\n/g, " ").replace(/"/g, "'")}
desc = "${description.replace(/"/g, '\\"')}"

# Ajouter un sol
bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = "Sol"
mat_floor = bpy.data.materials.new("Mat_Sol")
mat_floor.use_nodes = True
mat_floor.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.15, 0.15, 0.15, 1)
mat_floor.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
floor.data.materials.append(mat_floor)

# Créer l'objet principal basé sur la description
${generateShapeCode(description, params)}

# Configurer la caméra
cam = bpy.data.cameras.new("Camera")
cam_obj = bpy.data.objects.new("Camera", cam)
bpy.context.scene.collection.objects.link(cam_obj)
cam_obj.location = (${params?.cameraDistance || 6}, -${params?.cameraDistance || 6}, ${(params?.cameraDistance || 6) * 0.6})
cam_obj.rotation_euler = (math.radians(65), 0, math.radians(45))
bpy.context.scene.camera = cam_obj

# Éclairage studio
light_data = bpy.data.lights.new("Key", type='AREA')
light_data.energy = 200
light_data.size = 3
light_obj = bpy.data.objects.new("Key", light_data)
bpy.context.scene.collection.objects.link(light_obj)
light_obj.location = (3, -2, 4)
light_obj.rotation_euler = (math.radians(45), 0, math.radians(25))

fill_data = bpy.data.lights.new("Fill", type='AREA')
fill_data.energy = 80
fill_data.size = 4
fill_obj = bpy.data.objects.new("Fill", fill_data)
bpy.context.scene.collection.objects.link(fill_obj)
fill_obj.location = (-3, -1, 2)
fill_obj.rotation_euler = (math.radians(60), 0, math.radians(-30))

result = "Modèle généré: ${description.replace(/"/g, "'").slice(0, 60)}"
`;
}

function generateShapeCode(description, params) {
  // Parse description to generate appropriate Blender primitives
  const d = description.toLowerCase();
  const color = params?.color || [0.2, 0.6, 0.9, 1];
  const colorStr = `(${color.join(", ")})`;

  let code = "";

  // Helper for material
  const matCode = (name, col) => `
mat = bpy.data.materials.new("${name}")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = ${col}
bsdf.inputs["Metallic"].default_value = 0.3
bsdf.inputs["Roughness"].default_value = 0.4
bpy.context.active_object.data.materials.append(mat)
`;

  if (d.includes("vase") || d.includes("pot") || d.includes("vaso")) {
    code = `
# Vase / pot
bpy.ops.mesh.primitive_cylinder_add(radius=1, depth=2.5, location=(0, 0, 1.25))
obj = bpy.context.active_object
obj.name = "Vase"
# Modifier avec un lattice simple pour la forme
bpy.ops.object.modifier_add(type='SOLIDIFY')
obj.modifiers["Solidify"].thickness = 0.1
obj.modifiers["Solidify"].offset = -1
bpy.ops.object.modifier_add(type='SUBSURF')
obj.modifiers["Subdivision Surface"].levels = 2
${matCode("Mat_Vase", colorStr)}
`;
  } else if (d.includes("trophée") || d.includes("trophy") || d.includes("trofeu")) {
    code = `
# Trophée
# Base
bpy.ops.mesh.primitive_cylinder_add(radius=1.2, depth=0.3, location=(0, 0, 0.15))
base = bpy.context.active_object
base.name = "Base"
${matCode("Mat_Base", "(0.15, 0.12, 0.08, 1)")}

# Colonne
bpy.ops.mesh.primitive_cylinder_add(radius=0.3, depth=1.5, location=(0, 0, 1.0))
col = bpy.context.active_object
col.name = "Colonne"
${matCode("Mat_Col", "(0.85, 0.65, 0.13, 1)")}

# Coupe
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.8, location=(0, 0, 2.2))
bpy.ops.transform.resize(value=(1, 1, 0.5))
cup = bpy.context.active_object
cup.name = "Coupe"
${matCode("Mat_Coupe", "(0.85, 0.65, 0.13, 1)")}
`;
  } else if (d.includes("maquette") || d.includes("maison") || d.includes("house") || d.includes("building") || d.includes("bâtiment")) {
    code = `
# Maquette architecturale
# Murs
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1))
walls = bpy.context.active_object
walls.name = "Murs"
walls.scale = (2, 1.5, 1)
${matCode("Mat_Murs", "(0.9, 0.88, 0.82, 1)")}

# Toit
bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=2.3, depth=1.2, location=(0, 0, 2.6))
roof = bpy.context.active_object
roof.name = "Toit"
roof.scale = (1, 0.75, 1)
roof.rotation_euler = (0, 0, math.radians(45))
${matCode("Mat_Toit", "(0.6, 0.25, 0.15, 1)")}

# Porte
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -1.51, 0.5))
door = bpy.context.active_object
door.name = "Porte"
door.scale = (0.4, 0.05, 0.7)
${matCode("Mat_Porte", "(0.35, 0.22, 0.12, 1)")}
`;
  } else if (d.includes("engrenage") || d.includes("gear") || d.includes("engranagem")) {
    code = `
# Engrenage
import bmesh
bpy.ops.mesh.primitive_cylinder_add(radius=1.5, depth=0.4, vertices=32, location=(0, 0, 0.2))
obj = bpy.context.active_object
obj.name = "Engrenage"
# Ajouter des dents via array + boolean
bpy.ops.mesh.primitive_cube_add(size=0.5, location=(1.6, 0, 0.2))
tooth = bpy.context.active_object
tooth.name = "Dent"
tooth.scale = (0.3, 0.2, 0.4)
# Array circulaire
bpy.ops.object.modifier_add(type='ARRAY')
tooth.modifiers["Array"].use_relative_offset = False
tooth.modifiers["Array"].use_object_offset = True
tooth.modifiers["Array"].count = 16
# Créer un empty pour la rotation
bpy.ops.object.empty_add(location=(0, 0, 0))
empty = bpy.context.active_object
empty.name = "RotationPivot"
empty.rotation_euler = (0, 0, math.radians(360/16))
tooth.modifiers["Array"].offset_object = empty
${matCode("Mat_Gear", colorStr)}
`;
  } else if (d.includes("support") || d.includes("phone") || d.includes("téléphone") || d.includes("stand") || d.includes("suporte")) {
    code = `
# Support téléphone
# Base
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.15))
base = bpy.context.active_object
base.name = "Base"
base.scale = (1.5, 1, 0.15)
bpy.ops.object.modifier_add(type='BEVEL')
base.modifiers["Bevel"].width = 0.05
base.modifiers["Bevel"].segments = 3
${matCode("Mat_Base", colorStr)}

# Dossier
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.35, 1.2))
back = bpy.context.active_object
back.name = "Dossier"
back.scale = (1.3, 0.08, 1)
back.rotation_euler = (math.radians(-15), 0, 0)
bpy.ops.object.modifier_add(type='BEVEL')
back.modifiers["Bevel"].width = 0.03
back.modifiers["Bevel"].segments = 3
${matCode("Mat_Back", colorStr)}

# Lèvre avant
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.4, 0.4))
lip = bpy.context.active_object
lip.name = "Levre"
lip.scale = (1.3, 0.08, 0.15)
${matCode("Mat_Lip", colorStr)}
`;
  } else {
    // Default: cube with bevel
    code = `
# Objet par défaut — cube biseauté
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1))
obj = bpy.context.active_object
obj.name = "Objet"
bpy.ops.object.modifier_add(type='BEVEL')
obj.modifiers["Bevel"].width = 0.1
obj.modifiers["Bevel"].segments = 3
bpy.ops.object.modifier_add(type='SUBSURF')
obj.modifiers["Subdivision Surface"].levels = 2
${matCode("Mat_Objet", colorStr)}
`;
  }

  return code;
}

// ── Start ──────────────────────────────────────────────────────────────────

server.listen(WS_PORT, () => {
  console.log("╔══════════════════════════════════════╗");
  console.log("║  Amigo CRM — Blender Bridge v1.0    ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("");
  console.log(`🌐 WebSocket: ws://localhost:${WS_PORT}`);
  console.log(`🎨 Blender:   ${BLENDER_HOST}:${BLENDER_PORT}`);
  console.log("");
  console.log("En attente de connexions CRM...");
});
