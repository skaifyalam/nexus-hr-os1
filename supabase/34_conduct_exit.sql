-- ============================================================
-- NEXUS HR — Conduct & Exit. Self-healing.
-- Run AFTER 33_visa_management.sql
-- ============================================================

-- Conduct: warnings, misconduct, disciplinary records
DROP TABLE IF EXISTS conduct_records CASCADE;
CREATE TABLE conduct_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  person_record_id UUID,
  person_name TEXT,
  person_code TEXT,
  record_type TEXT DEFAULT 'warning',   -- warning | misconduct | verbal | final_warning (company-defined)
  severity TEXT DEFAULT 'low',          -- low | medium | high
  subject TEXT,
  description TEXT,
  action_taken TEXT,
  incident_date DATE,
  status TEXT DEFAULT 'open',           -- open | approved | rejected | closed
  approval_request_id UUID,
  issued_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_conduct_company ON conduct_records(company_id);
ALTER TABLE conduct_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conduct_access" ON conduct_records
  FOR ALL USING (company_id = public.user_company_id());

-- Exit: offboarding / resignation / termination
DROP TABLE IF EXISTS exit_records CASCADE;
CREATE TABLE exit_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  person_record_id UUID,
  person_name TEXT,
  person_code TEXT,
  exit_type TEXT DEFAULT 'resignation', -- resignation | termination | end_of_contract | retirement
  reason TEXT,
  last_working_day DATE,
  notice_period TEXT,
  -- checklist: [{ item, done }] — company can define items
  checklist JSONB DEFAULT '[]',
  settlement_note TEXT,
  status TEXT DEFAULT 'in_progress',    -- in_progress | approved | rejected | completed
  approval_request_id UUID,
  processed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_exit_company ON exit_records(company_id);
ALTER TABLE exit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exit_access" ON exit_records
  FOR ALL USING (company_id = public.user_company_id());
