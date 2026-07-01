-- ============================================================
-- NEXUS HR — Dashboard Widgets (fully customizable)
-- Run AFTER 15_requisitions_flexible.sql
-- ============================================================

-- Ensure the widgets table has all needed columns
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS section_key TEXT;
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS metric TEXT DEFAULT 'count';
-- metric: count | breakdown | sum | filtered_count
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS field_key TEXT;      -- for breakdown/sum
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS filter_field TEXT;   -- for filtered count
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS filter_value TEXT;
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS display TEXT DEFAULT 'card';
-- display: card | bar | pie | list
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'indigo';

-- Make user_id nullable so company-wide widgets work
ALTER TABLE dashboard_widgets ALTER COLUMN user_id DROP NOT NULL;

-- Ensure RLS is correct
DROP POLICY IF EXISTS "dashboard_widgets_access" ON dashboard_widgets;
CREATE POLICY "dashboard_widgets_access" ON dashboard_widgets
  FOR ALL USING (company_id = public.user_company_id());
