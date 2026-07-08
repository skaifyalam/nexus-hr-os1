-- ============================================================
-- NEXUS HR — Visa ↔ Pipeline Stage Mapping (Layer 3a). Self-healing.
-- Run AFTER 36_visa_workflow.sql
-- Each company maps their OWN candidate pipeline stages to Naibus's
-- standard visa stages. Nothing hardcoded — company confirms once.
-- ============================================================

-- Which candidate field holds the pipeline status (detected, company can override)
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS candidate_status_field_key TEXT;

-- The mapping itself: { "ewakala_issued": "B5 - Ewakala", "passport_submitted": "B7 - Under Stamping", "stamped": "Visa Done" }
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS visa_stage_map JSONB DEFAULT '{}';
