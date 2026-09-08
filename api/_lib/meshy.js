// Génération 3D via Meshy AI Image-to-3D API
// Doc : https://docs.meshy.ai/api-image-to-3d
// Flow : POST /image-to-3d → task_id → poll GET /image-to-3d/{task_id} → SUCCEEDED

const MESHY_BASE = "https://api.meshy.ai/openapi/v1";

export async function meshyStartImageTo3D({
  image_url,
  ai_model = "meshy-5",
  topology = "quad",
  target_polycount = 30000,
  art_style,          // "cartoon" | "realistic" | "sculpture" — optionnel
  style_prompt,       // description du style visuel (ex: "cake topper figurine, chibi")
  texture_prompt,     // description couleurs/textures (ex: "purple v-neck, red converse")
  negative_prompt,    // ce qu'on ne veut pas (ex: "blurry, deformed face")
} = {}) {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error("MESHY_API_KEY missing");

  const body = {
    image_url,
    enable_pbr: true,
    should_remesh: true,
    should_texture: true,
    ai_model,
    topology,
    target_polycount,
    symmetry_mode: "auto",
    moderation: true,
  };
  if (art_style) body.art_style = art_style;
  if (style_prompt) body.style_prompt = style_prompt;
  if (texture_prompt) body.texture_prompt = texture_prompt;
  if (negative_prompt) body.negative_prompt = negative_prompt;

  const resp = await fetch(`${MESHY_BASE}/image-to-3d`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.message || `Meshy start ${resp.status}`);
  return data.result; // task_id
}

export async function meshyGetTask(taskId) {
  const key = process.env.MESHY_API_KEY;
  const resp = await fetch(`${MESHY_BASE}/image-to-3d/${taskId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.message || `Meshy get ${resp.status}`);
  return data;
  // { id, status: "PENDING"|"IN_PROGRESS"|"SUCCEEDED"|"FAILED", progress, model_urls: { glb, obj, fbx }, thumbnail_url, video_url, ... }
}
