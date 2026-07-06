-- ============================================================
-- NEXUS HR — One-Time Legacy Cleanup
-- Drops tables from the app's OLD architecture that no live
-- route uses. Your real data lives in section_records /
-- company_sections / req_headers — none of that is touched.
--
-- SAFE: run this whole block. CASCADE clears cross-links
-- (the FK errors you kept hitting) automatically.
--
-- KEPT (still in active use, do NOT drop):
--   operations, departments, agencies, projects, company_profile,
--   profiles, section_records, company_sections, section_field_configs,
--   req_headers, req_lines, leave_*, attendance_records,
--   performance_reviews, document_records, subscriptions,
--   custom_roles, approval_*, feature_labels, user_feature_order,
--   dashboard_widgets, stage_flows, stage_history, org_nodes,
--   company_memberships, brain_*, ai_reports, id_formats,
--   localization_rules, tracker_groups
-- ============================================================

-- Old employee/candidate architecture (replaced by the universal engine)
DROP TABLE IF EXISTS transfer_checklist CASCADE;
DROP TABLE IF EXISTS transfer_requests CASCADE;
DROP TABLE IF EXISTS employee_assignments CASCADE;
DROP TABLE IF EXISTS employee_documents CASCADE;
DROP TABLE IF EXISTS employee_status_history CASCADE;
DROP TABLE IF EXISTS mobilization_stages CASCADE;
DROP TABLE IF EXISTS candidate_documents CASCADE;
DROP TABLE IF EXISTS candidate_messages CASCADE;
DROP TABLE IF EXISTS onboarding_messages CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;

-- Old requisition architecture (replaced by req_headers / req_lines)
DROP TABLE IF EXISTS requisition_items CASCADE;
DROP TABLE IF EXISTS requisitions CASCADE;

-- Old dynamic-fields architecture (replaced by section_field_configs)
DROP TABLE IF EXISTS custom_fields CASCADE;
DROP TABLE IF EXISTS custom_records CASCADE;
DROP TABLE IF EXISTS custom_sections CASCADE;
DROP TABLE IF EXISTS field_options CASCADE;

-- Old config / misc (replaced or never wired to live UI)
DROP TABLE IF EXISTS sidebar_config CASCADE;
DROP TABLE IF EXISTS installed_modules CASCADE;
DROP TABLE IF EXISTS user_operations CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS knowledge_documents CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Note: disciplinary_records and exit_records are dropped here because the
-- upcoming Conduct & Exit module will rebuild them cleanly on the universal engine.
DROP TABLE IF EXISTS disciplinary_records CASCADE;
DROP TABLE IF EXISTS exit_records CASCADE;
