-- ============================================================
-- NEXUS HR — Grievances. Self-healing.
-- Run AFTER 34_conduct_exit.sql
-- ============================================================
DROP TABLE IF EXISTS grievances CASCADE;
CREATE TABLE grievances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  person_record_id UUID,
  person_name TEXT,
  person_code TEXT,
  category TEXT DEFAULT 'general',      -- workplace | pay | harassment | facilities | general (company-defined)
  subject TEXT NOT NULL,
  description TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'submitted',      -- submitted | in_review | resolved | closed
  resolution TEXT,
  raised_by TEXT,
  handled_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_grievances_company ON grievances(company_id);
ALTER TABLE grievances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grievances_access" ON grievances
  FOR ALL USING (company_id = public.user_company_id());
