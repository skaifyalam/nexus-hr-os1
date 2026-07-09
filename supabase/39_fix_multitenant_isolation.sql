-- ============================================================
-- NAIBUS — Fix Multi-Tenant Data Isolation (CRITICAL)
-- departments and agencies were GLOBAL tables shared by all companies.
-- This adds company_id so each company has its OWN departments/agencies.
-- Existing rows are assigned to the oldest company (the original one).
-- Safe to run once.
-- ============================================================

-- ---- DEPARTMENTS ----
ALTER TABLE departments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE;

-- Assign any existing department rows (that have no company) to the oldest company
UPDATE departments
SET company_id = (SELECT id FROM company_profile ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- ---- AGENCIES ----
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE;

UPDATE agencies
SET company_id = (SELECT id FROM company_profile ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- ---- RLS: each company sees only its own departments/agencies ----
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dept_company_isolation ON departments;
CREATE POLICY dept_company_isolation ON departments
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_company_isolation ON agencies;
CREATE POLICY agency_company_isolation ON agencies
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ---- Also fix company_profile RLS so the switcher can read names of ALL
--      companies the user is a member of (fixes "Unnamed" in the switcher) ----
DROP POLICY IF EXISTS company_profile_member_read ON company_profile;
CREATE POLICY company_profile_member_read ON company_profile
  FOR SELECT
  USING (
    id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid())
    OR id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  );
