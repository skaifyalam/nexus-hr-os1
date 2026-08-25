-- 54_seed_sections_on_company_create.sql
-- ============================================================
-- Every new company must receive its core sections (employee, candidate).
--
-- Until now these were seeded ONLY by one-time migrations (14/38), which ran
-- against companies that existed at that moment. Any company created AFTER
-- those migrations — via signup, create_additional_company, or onboarding —
-- launched with NO Employees/Recruitment section: the "Go to Employees" link
-- dead-ended and the sidebar had no Employees item.
--
-- This adds a trigger so core sections are seeded automatically whenever a
-- company_profile row is created, and backfills any existing company missing
-- them. Definitions mirror 14_seed_core_sections.sql exactly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_core_sections()
RETURNS TRIGGER AS $$
BEGIN
  -- Defensive: seeding must NEVER block company creation. Swallow on error;
  -- the one-time backfill below (and re-running it) catches anything missed.
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.company_sections
      WHERE company_id = NEW.id AND section_key = 'employee'
    ) THEN
      INSERT INTO public.company_sections
        (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
      VALUES
        (NEW.id, 'employee', 'Employees', 'employees', true, 'table', 1, 'EMP-{YEAR}-{SEQ4}');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.company_sections
      WHERE company_id = NEW.id AND section_key = 'candidate'
    ) THEN
      INSERT INTO public.company_sections
        (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
      VALUES
        (NEW.id, 'candidate', 'Recruitment Pipeline', 'recruitment', false, 'both', 2, 'CAND-{YEAR}-{SEQ4}');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seed_core_sections ON public.company_profile;
CREATE TRIGGER trg_seed_core_sections
  AFTER INSERT ON public.company_profile
  FOR EACH ROW EXECUTE FUNCTION public.seed_core_sections();

-- One-time backfill: seed core sections for any existing company missing them
-- (fixes the current freshly-created workspace immediately).
INSERT INTO public.company_sections
  (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
SELECT cp.id, 'employee', 'Employees', 'employees', true, 'table', 1, 'EMP-{YEAR}-{SEQ4}'
FROM public.company_profile cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_sections cs
  WHERE cs.company_id = cp.id AND cs.section_key = 'employee'
);

INSERT INTO public.company_sections
  (company_id, section_key, label, icon, is_core, view_type, sidebar_order, id_format)
SELECT cp.id, 'candidate', 'Recruitment Pipeline', 'recruitment', false, 'both', 2, 'CAND-{YEAR}-{SEQ4}'
FROM public.company_profile cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_sections cs
  WHERE cs.company_id = cp.id AND cs.section_key = 'candidate'
);
