-- ============================================================
-- NEXUS HR — Restore Core Sections (Employee + Recruitment)
-- Safe to run anytime. Re-creates the Employee and Recruitment
-- sections for ANY company that is missing them. Will NOT duplicate
-- for companies that already have them (WHERE NOT EXISTS guard).
-- This ensures core sections ALWAYS exist, even if their data was cleared.
-- ============================================================

-- Employee section
INSERT INTO company_sections (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
SELECT cp.id, 'employee', 'Employees', 'employees', true, 'table', 1, 'EMP-{YEAR}-{SEQ4}'
FROM company_profile cp
WHERE NOT EXISTS (SELECT 1 FROM company_sections cs WHERE cs.company_id = cp.id AND cs.section_key = 'employee');

-- Recruitment (candidate) section
INSERT INTO company_sections (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
SELECT cp.id, 'candidate', 'Recruitment Pipeline', 'recruitment', false, 'both', 2, 'CAND-{YEAR}-{SEQ4}'
FROM company_profile cp
WHERE NOT EXISTS (SELECT 1 FROM company_sections cs WHERE cs.company_id = cp.id AND cs.section_key = 'candidate');
