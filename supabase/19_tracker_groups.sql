-- ============================================================
-- NEXUS HR — Tracker Groups (report rollups)
-- Map many statuses into report buckets (Tracker B/C/D style)
-- Run AFTER 18_localization.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS tracker_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  tracker_name TEXT NOT NULL,          -- e.g. "Tracker B", "Report View"
  status_value TEXT NOT NULL,          -- e.g. "B2 - Medical - Fit"
  group_label TEXT NOT NULL,           -- e.g. "Visa Allocated"
  UNIQUE(company_id, section_key, tracker_name, status_value)
);

ALTER TABLE tracker_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tracker_groups_access" ON tracker_groups;
CREATE POLICY "tracker_groups_access" ON tracker_groups
  FOR ALL USING (company_id = public.user_company_id());
