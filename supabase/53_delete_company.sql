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
-- automatically. The ONLY exceptions are `profiles` and `candidates`
-- (plain REFERENCES, no cascade), so we clear those explicitly first,
-- inside the same transaction. Candidate child tables all cascade from
-- candidates(id), so deleting candidates is sufficient.

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

  -- Clear the two non-cascading references, then delete (rest cascades).
  DELETE FROM candidates WHERE company_id = target_company_id::UUID;
  UPDATE profiles SET company_id = NULL WHERE company_id = target_company_id::UUID;
  DELETE FROM company_profile WHERE id = target_company_id::UUID;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_company(UUID) TO authenticated;
