-- ============================================================
-- NEXUS HR — Active/Inactive status config per section
-- Run AFTER 19_tracker_groups.sql
-- ============================================================

-- Which field determines active/inactive, and which values = active
ALTER TABLE company_sections ADD COLUMN IF NOT EXISTS active_field_key TEXT;
ALTER TABLE company_sections ADD COLUMN IF NOT EXISTS active_values JSONB DEFAULT '[]';
