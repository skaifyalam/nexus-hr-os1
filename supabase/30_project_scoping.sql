-- ============================================================
-- NEXUS HR — Project Scoping (Build D). Self-healing.
-- Run AFTER 29_custom_roles.sql
-- ============================================================

-- Which employee/candidate field represents "project/site" — company chooses (nothing hardcoded)
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS project_field_key TEXT;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS candidate_project_field_key TEXT;

-- profiles.project_scope already exists (JSONB array of allowed project values), added in 29.
-- Empty array = no restriction (sees all). Non-empty = sees only those projects.
