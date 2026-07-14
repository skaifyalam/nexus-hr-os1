-- ============================================================
-- NAIBUS — Add Sponsor ID to visa blocks
-- The sponsor ID is the official identifier (name alone is ambiguous).
-- ============================================================
ALTER TABLE visa_blocks ADD COLUMN IF NOT EXISTS sponsor_id TEXT;
