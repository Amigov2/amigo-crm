// Endpoint debug — retourne un résumé du state wa_labo3d.
// Protégé par AMIGO_TEST_TOKEN.

import { loadWaLabo3d } from "./_lib/supabase.js";

export default async function handler(req, res) {
  const token = req.headers["x-test-token"];
  const expected = process.env.AMIGO_TEST_TOKEN;
  if (!expected || token !== expected) {
    return res.status(401).json({ error: "invalid token" });
  }
  const state = await loadWaLabo3d();
  return res.status(200).json({
    conversations_count: state.conversations?.length || 0,
    templates_count: state.templates?.length || 0,
    knowledge_base_present: !!state.knowledge_base,
    knowledge_base_updated_at: state.knowledge_base_updated_at || null,
    knowledge_base_pages_count: state.knowledge_base?.pages?.length || 0,
    knowledge_base_company_name: state.knowledge_base?.company?.name || null,
    knowledge_base_first_page: state.knowledge_base?.pages?.[0]
      ? { label: state.knowledge_base.pages[0].label, chars: state.knowledge_base.pages[0].text?.length }
      : null,
    top_level_keys: Object.keys(state),
  });
}
