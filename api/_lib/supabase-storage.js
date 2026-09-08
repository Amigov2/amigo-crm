// Upload d'images (photos WhatsApp inbound) vers un bucket Supabase public
// pour que Meshy puisse les fetch via URL.
// Bucket : "meshy-inputs" (à créer une seule fois, cf commentaire fin de fichier)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const BUCKET = "meshy-inputs";

export async function uploadImageForMeshy({ buffer, filename, mimeType = "image/jpeg" }) {
  const path = `${Date.now()}-${filename || "input.jpg"}`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(`Supabase upload: ${error.message}`);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return pub.publicUrl;
}

// Setup une seule fois via SQL dans Supabase dashboard :
// INSERT INTO storage.buckets (id, name, public) VALUES ('meshy-inputs', 'meshy-inputs', true);
// CREATE POLICY "public read" ON storage.objects FOR SELECT USING (bucket_id = 'meshy-inputs');
// CREATE POLICY "authenticated insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'meshy-inputs');
