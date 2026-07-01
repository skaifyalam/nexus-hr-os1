-- ============================================================
-- NEXUS HR — Universal Section Engine
-- ONE records table for ALL sections (employee, candidate, custom)
-- Run AFTER 12_dynamic_candidates.sql
-- ============================================================

-- Universal records — every section's data lives here
CREATE TABLE IF NOT EXISTS section_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,   -- 'employee' | 'candidate' | custom section UUID
  record_id TEXT,               -- human-readable ID from section's id_format
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_section_records_lookup
  ON section_records (company_id, section_key);
CREATE INDEX IF NOT EXISTS idx_section_records_data
  ON section_records USING gin (data);

ALTER TABLE section_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "section_records_access" ON section_records;
CREATE POLICY "section_records_access" ON section_records
  FOR ALL USING (company_id = public.user_company_id());

-- Section registry — defines every section a company has (core or custom)
CREATE TABLE IF NOT EXISTS company_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,    -- stable key used in records + field configs
  label TEXT NOT NULL,           -- display name, user can rename
  icon TEXT DEFAULT 'folder',
  is_core BOOLEAN DEFAULT FALSE, -- core sections can't be deleted
  view_type TEXT DEFAULT 'table', -- 'table' | 'kanban' | 'both'
  sidebar_order INTEGER DEFAULT 99,
  id_format TEXT DEFAULT '{SEQ4}',
  id_last_sequence INTEGER DEFAULT 0,
  is_configured BOOLEAN DEFAULT FALSE, -- true once fields are set up
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, section_key)
);

ALTER TABLE company_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_sections_access" ON company_sections;
CREATE POLICY "company_sections_access" ON company_sections
  FOR ALL USING (company_id = public.user_company_id());

-- ID generator for any section
CREATE OR REPLACE FUNCTION public.generate_section_id(p_section_pk UUID)
RETURNS TEXT AS $$
DECLARE
  v_format TEXT;
  v_seq INTEGER;
  v_result TEXT;
BEGIN
  UPDATE company_sections
  SET id_last_sequence = id_last_sequence + 1
  WHERE id = p_section_pk
  RETURNING id_format, id_last_sequence INTO v_format, v_seq;

  v_result := COALESCE(v_format, '{SEQ4}');
  v_result := REPLACE(v_result, '{YEAR}',  TO_CHAR(NOW(), 'YYYY'));
  v_result := REPLACE(v_result, '{MONTH}', TO_CHAR(NOW(), 'MM'));
  v_result := REPLACE(v_result, '{SEQ3}',  LPAD(v_seq::TEXT, 3, '0'));
  v_result := REPLACE(v_result, '{SEQ4}',  LPAD(v_seq::TEXT, 4, '0'));
  v_result := REPLACE(v_result, '{SEQ5}',  LPAD(v_seq::TEXT, 5, '0'));
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.generate_section_id TO authenticated;
