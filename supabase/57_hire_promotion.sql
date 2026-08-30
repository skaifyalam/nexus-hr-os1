-- 57_hire_promotion.sql
-- Recruitment → Employee promotion.
--
-- A candidate is a section_record with section_key = 'candidate'. When they are
-- hired, we flag the record; when they are added to the Employee master, we link
-- the created employee record. Two nullable columns carry that state:
--   hired_at            → set when "Hire → Move to Employees" is clicked
--   promoted_record_id  → set to the new employee record's id once promoted
--
-- State machine for a candidate record:
--   hired_at NULL, promoted_record_id NULL  → active candidate
--   hired_at SET,  promoted_record_id NULL  → hired, pending add (banner group)
--   promoted_record_id SET                  → promoted, history

ALTER TABLE public.section_records ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ;
ALTER TABLE public.section_records ADD COLUMN IF NOT EXISTS promoted_record_id UUID;

-- Fast lookup of "hired but not yet promoted" candidates per company.
CREATE INDEX IF NOT EXISTS idx_section_records_pending_hire
  ON public.section_records (company_id, section_key)
  WHERE hired_at IS NOT NULL AND promoted_record_id IS NULL;
