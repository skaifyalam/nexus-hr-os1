-- ============================================================
-- NAIBUS — Explicit status/stage field flag
-- Previously the status/stage column was detected by keyword ("status"/"stage")
-- in the label — fragile if a company names it differently. This lets the user
-- mark it explicitly in the "Review your fields" step.
-- ============================================================
ALTER TABLE section_field_configs ADD COLUMN IF NOT EXISTS is_status_field BOOLEAN DEFAULT false;
