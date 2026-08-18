-- ============================================================
-- NAIBUS — Atomic upsert for entity_mappings
-- Fixes: 23505 "duplicate key value violates unique constraint
-- idx_entity_mappings_unique" on re-mapping.
--
-- The unique index is on the EXPRESSION (company_id, entity_type,
-- lower(excel_value)). PostgREST/supabase-js .upsert() cannot target an
-- expression index, and client-side delete-then-insert is racy and casing-
-- sensitive. This function lets Postgres resolve the conflict atomically via
-- ON CONFLICT ... DO UPDATE, which CAN name the exact expression.
--
-- Security: the caller's company is taken from public.user_company_id() — the
-- passed rows never carry a company_id, so a user can only write their own.
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_entity_mappings(
  p_entity_type text,
  p_rows jsonb
)
RETURNS void AS $$
DECLARE
  r jsonb;
  v_company uuid;
BEGIN
  v_company := public.user_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'No company found for current user';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO entity_mappings (company_id, entity_type, excel_value, mapped_id, mapped_name)
    VALUES (
      v_company,
      p_entity_type,
      r->>'excel_value',
      NULLIF(r->>'mapped_id', '')::uuid,
      r->>'mapped_name'
    )
    ON CONFLICT (company_id, entity_type, lower(excel_value))
    DO UPDATE SET
      mapped_id  = EXCLUDED.mapped_id,
      mapped_name = EXCLUDED.mapped_name,
      updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.upsert_entity_mappings(text, jsonb) TO authenticated;
