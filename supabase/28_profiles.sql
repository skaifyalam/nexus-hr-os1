-- ============================================================
-- NEXUS HR — Profile fields (phone). Self-healing.
-- Run AFTER 27_sidebar_prefs.sql
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
