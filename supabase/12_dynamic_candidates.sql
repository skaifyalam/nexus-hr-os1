-- ============================================================
-- NEXUS HR — Dynamic Candidate Fields
-- Lets candidates store user-defined columns in JSONB
-- Run AFTER 11_user_defined_fields.sql
-- ============================================================

-- Add a flexible data column to candidates for user-defined fields
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}';

-- Add company_id so candidates are scoped per company like everything else
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES company_profile(id);

-- Backfill company_id for existing candidates (link to first company)
UPDATE candidates SET company_id = (SELECT id FROM company_profile LIMIT 1)
WHERE company_id IS NULL;

-- Index for fast JSONB queries
CREATE INDEX IF NOT EXISTS idx_candidates_custom_data ON candidates USING gin (custom_data);
