-- Hotfix 2026-09-29 : à coller dans Supabase SQL Editor (Dashboard → SQL).
--
-- 1) Autorise vidéo + GLB sur le bucket meshy-inputs (fix upload frontend).
-- 2) Corrige la RPC wa_labo3d_resolve_pending_quote pour ne plus pousser
--    un null dans messages[] quand p_new_message vaut null (cas "take" du
--    flow d'approbation email — a causé un écran blanc sur AMIGO le 29/09).

-- ─────────────────────────────────────────────────────────────
-- 1) Bucket meshy-inputs — ajoute video/mp4, video/quicktime, glb
-- ─────────────────────────────────────────────────────────────
UPDATE storage.buckets
SET allowed_mime_types = (
  SELECT array_agg(DISTINCT m)
  FROM unnest(
    COALESCE(allowed_mime_types, ARRAY[]::text[])
    || ARRAY['video/mp4', 'video/quicktime', 'model/gltf-binary', 'application/octet-stream']
  ) AS m
)
WHERE id = 'meshy-inputs';

SELECT id, allowed_mime_types FROM storage.buckets WHERE id = 'meshy-inputs';

-- ─────────────────────────────────────────────────────────────
-- 2) RPC resolve_pending_quote — no-op sur messages si p_new_message NULL
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION wa_labo3d_resolve_pending_quote(
  p_conv_id text,
  p_resolved_fields jsonb,
  p_new_message jsonb,
  p_last_message_at text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_state jsonb;
  v_idx int;
  v_pending jsonb;
  v_messages jsonb;
BEGIN
  SELECT value::jsonb INTO v_state
  FROM amigo_data
  WHERE key = 'wa_labo3d'
  FOR UPDATE;

  IF v_state IS NULL THEN
    RETURN false;
  END IF;

  SELECT (ordinality - 1)::int INTO v_idx
  FROM jsonb_array_elements(v_state->'conversations') WITH ORDINALITY
  WHERE value->>'id' = p_conv_id
  LIMIT 1;

  IF v_idx IS NULL THEN
    RETURN false;
  END IF;

  v_pending := coalesce(v_state->'conversations'->v_idx->'pending_quote', '{}'::jsonb) || p_resolved_fields;

  -- Fix 29/09 : n'ajoute au tableau messages QUE si p_new_message est un objet non-null.
  -- Sinon on préserve l'existant (cas "take" du webhook d'approbation qui passe null).
  IF p_new_message IS NOT NULL AND jsonb_typeof(p_new_message) = 'object' THEN
    v_messages := coalesce(v_state->'conversations'->v_idx->'messages', '[]'::jsonb) || jsonb_build_array(p_new_message);
  ELSE
    v_messages := coalesce(v_state->'conversations'->v_idx->'messages', '[]'::jsonb);
  END IF;

  UPDATE amigo_data
  SET value = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          v_state,
          ARRAY['conversations', v_idx::text, 'pending_quote'],
          v_pending
        ),
        ARRAY['conversations', v_idx::text, 'messages'],
        v_messages
      ),
      ARRAY['conversations', v_idx::text, 'last_message_at'],
      to_jsonb(p_last_message_at)
    ),
    ARRAY['conversations', v_idx::text, 'unread'],
    'false'::jsonb
  )::text,
  updated_at = now()
  WHERE key = 'wa_labo3d';

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION wa_labo3d_resolve_pending_quote(text, jsonb, jsonb, text) TO service_role, anon, authenticated;
