-- 58_seed_requisition_section.sql
-- ============================================================
-- "Requisitions is missing from the sidebar" — same class of bug as the
-- employee/candidate seeding gap. The requisition section was seeded ONLY by a
-- one-time migration (15), so companies created afterward never got it.
--
-- This extends the seed_core_sections() trigger (from migration 54) to also
-- create the requisition section on company creation, and backfills any
-- existing company that is missing it. Definition mirrors 15 exactly:
--   'requisition' / 'Requisitions' / icon 'requisitions' / sidebar_order 3 /
--   id_format 'REQ-{YEAR}-{SEQ4}'. The sidebar already routes this section to
--   the dedicated /requisitions page.
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_core_sections()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.company_sections WHERE company_id = NEW.id AND section_key = 'employee') THEN
      INSERT INTO public.company_sections
        (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
      VALUES
        (NEW.id, 'employee', 'Employees', 'employees', true, 'table', 1, 'EMP-{YEAR}-{SEQ4}');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.company_sections WHERE company_id = NEW.id AND section_key = 'candidate') THEN
      INSERT INTO public.company_sections
        (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
      VALUES
        (NEW.id, 'candidate', 'Recruitment Pipeline', 'recruitment', false, 'both', 2, 'CAND-{YEAR}-{SEQ4}');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.company_sections WHERE company_id = NEW.id AND section_key = 'requisition') THEN
      INSERT INTO public.company_sections
        (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
      VALUES
        (NEW.id, 'requisition', 'Requisitions', 'requisitions', false, 'table', 3, 'REQ-{YEAR}-{SEQ4}');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: give every existing company the requisition section if it's missing.
INSERT INTO public.company_sections
  (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
SELECT cp.id, 'requisition', 'Requisitions', 'requisitions', false, 'table', 3, 'REQ-{YEAR}-{SEQ4}'
FROM public.company_profile cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_sections cs
  WHERE cs.company_id = cp.id AND cs.section_key = 'requisition'
);
