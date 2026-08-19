-- ============================================================
-- NAIBUS — Sub-companies (the "company" link entity)
--
-- MEANING: one tenant company may manage several sub-companies underneath it,
-- purely as DATA labels (e.g. an employee belongs to "NBTC Contracting").
-- It is NOT a separate tenant — a genuinely separate business creates its own
-- company account through the existing multi-company flow.
--
-- NAMING: deliberately `sub_companies`, NOT `companies`, so it can never be
-- confused with `company_profile` (the tenant record). Linking spreadsheet
-- values to the tenant table would break multi-tenancy.
--
-- Shape is intentionally identical to `departments`: a flat, named list that the
-- import can auto-create and count by name. Simple, like agency/department.
-- ============================================================

CREATE TABLE IF NOT EXISTS sub_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_companies_company ON sub_companies(company_id);

ALTER TABLE sub_companies ENABLE ROW LEVEL SECURITY;

-- Uses the proven helper (raw subqueries have silently failed before).
DROP POLICY IF EXISTS "sub_companies_access" ON sub_companies;
CREATE POLICY "sub_companies_access" ON sub_companies
  FOR ALL USING (company_id::UUID = public.user_company_id());

-- Verify
SELECT 'sub_companies created' AS status;
