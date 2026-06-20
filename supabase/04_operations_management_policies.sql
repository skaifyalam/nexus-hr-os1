-- ============================================================
-- NEXUS HR — Allow Admins to Manage Countries & Projects
-- Run this AFTER 03_multi_country_operations.sql
-- ============================================================
-- The previous file only allowed everyone to VIEW the country/project
-- list. This adds the ability for Super Admin / HR Director to actually
-- add, edit, and remove countries and projects from the app itself —
-- no SQL needed after this point.

CREATE POLICY "Admins insert operations" ON operations FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'hr_director'));

CREATE POLICY "Admins update operations" ON operations FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'hr_director'));

CREATE POLICY "Admins delete operations" ON operations FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'hr_director'));

CREATE POLICY "Admins insert projects" ON projects FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'hr_director'));

CREATE POLICY "Admins update projects" ON projects FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'hr_director'));

CREATE POLICY "Admins delete projects" ON projects FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'hr_director'));
