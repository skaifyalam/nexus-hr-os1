-- ============================================================
-- NEXUS HR — Phase 4: AI Report Studio
-- Run AFTER 09_company_brain.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  report_type TEXT DEFAULT 'narrative',
  -- narrative | tabular | summary | presentation
  content TEXT,          -- generated markdown/structured content
  data_snapshot JSONB,   -- snapshot of data used to generate
  generated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_access" ON ai_reports;
CREATE POLICY "reports_access" ON ai_reports
  FOR ALL USING (company_id = public.user_company_id());
