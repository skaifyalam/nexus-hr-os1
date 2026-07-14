-- ============================================================
-- NAIBUS — Ensure section_records INSERT works (for remob → pipeline)
-- The policy had USING but no WITH CHECK, which can block INSERTs.
-- This adds an explicit WITH CHECK so inserts into the user's own company work.
-- ============================================================
DROP POLICY IF EXISTS "section_records_access" ON section_records;
CREATE POLICY "section_records_access" ON section_records
  FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());
