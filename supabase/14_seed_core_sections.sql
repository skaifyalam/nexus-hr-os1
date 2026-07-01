-- ============================================================
-- NEXUS HR — Seed Core Sections + Migrate Sidebar
-- Run AFTER 13_universal_engine.sql
-- Creates the default sections every company gets, driven by
-- the universal engine.
-- ============================================================

-- Seed core sections for any company that doesn't have them yet
INSERT INTO company_sections (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
SELECT cp.id, 'employee', 'Employees', 'employees', true, 'table', 1, 'EMP-{YEAR}-{SEQ4}'
FROM company_profile cp
WHERE NOT EXISTS (SELECT 1 FROM company_sections cs WHERE cs.company_id = cp.id AND cs.section_key = 'employee');

INSERT INTO company_sections (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
SELECT cp.id, 'candidate', 'Recruitment Pipeline', 'recruitment', false, 'both', 2, 'CAND-{YEAR}-{SEQ4}'
FROM company_profile cp
WHERE NOT EXISTS (SELECT 1 FROM company_sections cs WHERE cs.company_id = cp.id AND cs.section_key = 'candidate');

-- Migrate any existing custom_sections into company_sections
INSERT INTO company_sections (company_id, section_key, label, icon, is_core, view_type, sidebar_order)
SELECT company_id, id::TEXT, name, COALESCE(icon, 'folder'), false, 'table', sidebar_order
FROM custom_sections
WHERE NOT EXISTS (
  SELECT 1 FROM company_sections cs
  WHERE cs.company_id = custom_sections.company_id
  AND cs.section_key = custom_sections.id::TEXT
);
