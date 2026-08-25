-- 53_delete_company.sql
-- Server-enforced deletion of an entire company workspace.
--
-- Guards (all enforced in the DB, not just the UI):
--   1. Caller must be a super_admin (profiles.role).
--   2. Caller must belong to the target company (company_memberships).
--   3. Never delete the company the caller is currently inside.
--   4. Never delete the caller's last remaining company.
--
-- Data cleanup: almost every table references company_profile with
-- ON DELETE CASCADE, so deleting the company_profile row removes its data
-- automatically. The only live non-cascading reference is `profiles`, which
-- we NULL out first. (A `candidates` table also referenced company_profile
-- without cascade, but it was dropped in migration 32 for the universal
-- engine; we still clear it defensively IF it exists, for older databases.)

CREATE OR REPLACE FUNCTION public.delete_company(target_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user   UUID;
  v_role   TEXT;
  v_member BOOLEAN;
  v_active UUID;
  v_count  INT;
BEGIN
  v_user := auth.uid()::UUID;
  IF v_user IS NULL THEN RETURN FALSE; END IF;

  -- 1) Super admin only.
  SELECT role INTO v_role FROM profiles WHERE id = v_user;
  IF v_role IS DISTINCT FROM 'super_admin' THEN RETURN FALSE; END IF;

  -- 2) Must be a member of the target company.
  SELECT EXISTS(
    SELECT 1 FROM company_memberships
    WHERE user_id = v_user AND company_id = target_company_id::UUID
  ) INTO v_member;
  IF NOT v_member THEN RETURN FALSE; END IF;

  -- 3) Cannot delete the company you're currently inside.
  SELECT company_id INTO v_active FROM profiles WHERE id = v_user;
  IF v_active = target_company_id::UUID THEN RETURN FALSE; END IF;

  -- 4) Cannot delete your last remaining company.
  SELECT COUNT(*) INTO v_count FROM company_memberships WHERE user_id = v_user;
  IF v_count <= 1 THEN RETURN FALSE; END IF;

  -- Clear the non-cascading reference that always exists (core table).
  UPDATE profiles SET company_id = NULL WHERE company_id = target_company_id::UUID;

  -- Legacy safety: the physical `candidates` table was dropped in migration 32
  -- (replaced by the universal engine). Only touch it if it still exists on
  -- this database, so the function is safe regardless of migration state.
  IF to_regclass('public.candidates') IS NOT NULL THEN
    EXECUTE 'DELETE FROM candidates WHERE company_id = $1' USING target_company_id::UUID;
  END IF;

  -- Delete the company (all remaining child data cascades).
  DELETE FROM company_profile WHERE id = target_company_id::UUID;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_company(UUID) TO authenticated;
