-- ============================================================
-- NAIBUS — Entity Mapping Foundation
-- Solves: Excel values (e.g. agency "IOC") not matching app entities
-- (e.g. agency "International Overseas Consultants").
--
-- A generic, reusable mapping table. Confirmed mappings are set by the user
-- (never auto-guessed), then applied automatically on future imports.
-- Reusable for ALL entity types: agency, project, department, country, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,           -- 'agency' | 'project' | 'department' | 'country' | ...
  excel_value TEXT NOT NULL,           -- the value as it appears in uploaded Excel (e.g. 'IOC')
  mapped_id UUID,                      -- the real app entity's id (nullable if mapped by name only)
  mapped_name TEXT NOT NULL,           -- the real app entity's display name
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One mapping per (company, entity_type, excel_value). Re-mapping updates it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_mappings_unique
  ON entity_mappings (company_id, entity_type, lower(excel_value));

CREATE INDEX IF NOT EXISTS idx_entity_mappings_lookup
  ON entity_mappings (company_id, entity_type);

-- RLS: company isolation
ALTER TABLE entity_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_mappings_isolation ON entity_mappings;
CREATE POLICY entity_mappings_isolation ON entity_mappings
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================
-- Mark which fields LINK to a business entity (agency/project/etc).
-- Set by the AI's suggestion + the user's confirmation. Null = plain field.
-- ============================================================
ALTER TABLE section_field_configs ADD COLUMN IF NOT EXISTS links_to TEXT;
