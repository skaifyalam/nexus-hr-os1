-- ============================================================
-- NAIBUS — Fix Projects & Operations Multi-Tenant Isolation
-- projects and operations had no company_id — shared across all companies.
-- Same critical fix as departments/agencies. Assigns existing rows to the
-- oldest company and adds RLS isolation.
-- ============================================================

-- ---- OPERATIONS ----
ALTER TABLE operations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE;
UPDATE operations SET company_id = (SELECT id FROM company_profile ORDER BY created_at ASC LIMIT 1) WHERE company_id IS NULL;

-- ---- PROJECTS ----
ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE;
UPDATE projects SET company_id = (SELECT id FROM company_profile ORDER BY created_at ASC LIMIT 1) WHERE company_id IS NULL;

-- ---- RLS ----
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ops_company_isolation ON operations;
CREATE POLICY ops_company_isolation ON operations
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_company_isolation ON projects;
CREATE POLICY proj_company_isolation ON projects
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
