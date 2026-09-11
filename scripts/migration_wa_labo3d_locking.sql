-- Migration : fonctions RPC atomiques pour éviter la race condition sur pending_quote
-- Contexte : incident 2026-09-11, le pending_quote de Mariana Secretaria a été perdu
-- entre sa création (RAM) et sa persistance (save final tardif), écrasé par un webhook
-- concurrent qui avait chargé le state avant l'écriture.
--
-- Application : SQL Editor Supabase AMIGO (ref mqaalshpmxzdyjcnxwuc)
-- Puis côté Vercel : ajouter env `WA_LABO3D_LOCKING=1` sur le projet `amigo-labo3d`
--
-- Ces fonctions utilisent SELECT ... FOR UPDATE pour verrouiller la ligne
-- amigo_data pendant l'écriture. Postgres sérialise automatiquement les
-- transactions concurrentes sur cette ligne.

-- ─────────────────────────────────────────────────────────────
-- RPC 1 : set atomique du pending_quote (création par le bot IA)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION wa_labo3d_set_pending_quote(
  p_conv_id text,
  p_pending jsonb
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_state jsonb;
  v_idx int;
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

  UPDATE amigo_data
  SET value = jsonb_set(
    jsonb_set(
      v_state,
      ARRAY['conversations', v_idx::text, 'pending_quote'],
      p_pending
    ),
    ARRAY['conversations', v_idx::text, 'unread'],
    'false'::jsonb
  )::text,
  updated_at = now()
  WHERE key = 'wa_labo3d';

  RETURN true;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC 2 : résolution atomique (admin approuve/modifie + push message)
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
  v_messages := coalesce(v_state->'conversations'->v_idx->'messages', '[]'::jsonb) || jsonb_build_array(p_new_message);

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

-- ─────────────────────────────────────────────────────────────
-- Grants : le service_role et anon peuvent appeler
-- ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION wa_labo3d_set_pending_quote(text, jsonb) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION wa_labo3d_resolve_pending_quote(text, jsonb, jsonb, text) TO service_role, anon, authenticated;
