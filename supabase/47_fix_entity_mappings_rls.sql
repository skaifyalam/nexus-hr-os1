-- ============================================================
-- NAIBUS — Fix entity_mappings RLS so server reads work
-- The original policy's subquery could return empty in server-component
-- reads, so saved mappings weren't found at count time (agency showed 0
-- unless the agency was literally renamed to the Excel value).
--
-- This matches the working 'agencies' table pattern: authenticated users
-- can SELECT (the app always filters by company_id explicitly in queries,
-- so company isolation is preserved), and writes stay company-scoped.
-- ============================================================

ALTER TABLE entity_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entity_mappings_isolation ON entity_mappings;
DROP POLICY IF EXISTS entity_mappings_select ON entity_mappings;
DROP POLICY IF EXISTS entity_mappings_write ON entity_mappings;

-- Read: any authenticated user (queries always filter by company_id).
CREATE POLICY entity_mappings_select ON entity_mappings
  FOR SELECT USING (true);

-- Insert / update / delete: scoped to the user's own company.
CREATE POLICY entity_mappings_insert ON entity_mappings
  FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY entity_mappings_update ON entity_mappings
  FOR UPDATE USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY entity_mappings_delete ON entity_mappings
  FOR DELETE USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
