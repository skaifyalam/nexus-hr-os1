-- ============================================================
-- NEXUS HR — Stage Tracking Engine
-- Status→date mapping, change history, delay analysis
-- Run AFTER 16_dashboard_widgets.sql
-- ============================================================

-- Company-defined mapping: which status fills which date field
CREATE TABLE IF NOT EXISTS stage_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  status_value TEXT NOT NULL,        -- e.g. "B2 - Medical - Fit"
  date_field_key TEXT,               -- e.g. "medical_date" (nullable = no date needed)
  trackers JSONB DEFAULT '{}',       -- e.g. {"Tracker B":"Visa Allocated","Tracker D":"Agency followup"}
  UNIQUE(company_id, section_key, status_value)
);

-- Every stage change is logged here — powers delay analysis
CREATE TABLE IF NOT EXISTS stage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  record_pk UUID NOT NULL,           -- section_records.id
  record_id TEXT,                    -- human readable (Recruitment ID)
  from_status TEXT,
  to_status TEXT NOT NULL,
  change_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_history_record ON stage_history(record_pk);
CREATE INDEX IF NOT EXISTS idx_stage_flows_lookup ON stage_flows(company_id, section_key);

ALTER TABLE stage_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage_flows_access" ON stage_flows;
CREATE POLICY "stage_flows_access" ON stage_flows
  FOR ALL USING (company_id = public.user_company_id());

DROP POLICY IF EXISTS "stage_history_access" ON stage_history;
CREATE POLICY "stage_history_access" ON stage_history
  FOR ALL USING (company_id = public.user_company_id());
