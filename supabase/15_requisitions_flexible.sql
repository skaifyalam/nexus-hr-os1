-- ============================================================
-- NEXUS HR — Flexible Requisitions (single + bulk)
-- Run AFTER 14_seed_core_sections.sql
-- ============================================================

-- Requisition headers (one REQ ID per header)
CREATE TABLE IF NOT EXISTS req_headers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  req_id TEXT,                    -- human readable, auto-generated
  data JSONB NOT NULL DEFAULT '{}',  -- header-level custom fields
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Requisition line items (many positions under one header)
CREATE TABLE IF NOT EXISTS req_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  header_id UUID REFERENCES req_headers(id) ON DELETE CASCADE,
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',  -- line-level custom fields (position, headcount, project, etc)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_req_headers_company ON req_headers(company_id);
CREATE INDEX IF NOT EXISTS idx_req_lines_header ON req_lines(header_id);

ALTER TABLE req_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE req_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "req_headers_access" ON req_headers;
CREATE POLICY "req_headers_access" ON req_headers
  FOR ALL USING (company_id = public.user_company_id());

DROP POLICY IF EXISTS "req_lines_access" ON req_lines;
CREATE POLICY "req_lines_access" ON req_lines
  FOR ALL USING (company_id = public.user_company_id());

-- Seed a requisition section into company_sections so it has field configs
INSERT INTO company_sections (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
SELECT cp.id, 'requisition', 'Requisitions', 'requisitions', false, 'table', 3, 'REQ-{YEAR}-{SEQ4}'
FROM company_profile cp
WHERE NOT EXISTS (SELECT 1 FROM company_sections cs WHERE cs.company_id = cp.id AND cs.section_key = 'requisition');

-- ID generator for requisitions (uses the requisition section's format)
CREATE OR REPLACE FUNCTION public.generate_req_id(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_section_pk UUID;
  v_result TEXT;
BEGIN
  SELECT id INTO v_section_pk FROM company_sections
  WHERE company_id = p_company_id AND section_key = 'requisition' LIMIT 1;
  IF v_section_pk IS NULL THEN
    RETURN 'REQ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD((FLOOR(RANDOM()*9999))::TEXT, 4, '0');
  END IF;
  SELECT public.generate_section_id(v_section_pk) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.generate_req_id TO authenticated;
