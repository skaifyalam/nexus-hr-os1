-- ============================================================
-- NEXUS HR — Localization / Nationalization Compliance
-- Saudization, Qatarization, Emiratization... company-defined
-- Run AFTER 17_stage_tracking.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS localization_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- e.g. "Saudization — KSA Operations"
  section_key TEXT NOT NULL,             -- which section holds the people (usually 'employee')
  nationality_field_key TEXT NOT NULL,   -- which field holds nationality
  local_values JSONB DEFAULT '[]',       -- values that count as "local" e.g. ["Saudi Arabia","Saudi"]
  target_pct NUMERIC(5,2) DEFAULT 0,     -- required percentage e.g. 30
  profession_field_key TEXT,             -- optional: Iqama profession field to track
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE localization_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "localization_rules_access" ON localization_rules;
CREATE POLICY "localization_rules_access" ON localization_rules
  FOR ALL USING (company_id = public.user_company_id());
