-- 56_create_membership_on_signup.sql
-- ============================================================
-- ROOT CAUSE of the sidebar showing "My Company" even though the company is
-- correctly named:
--
-- The company switcher/sidebar resolves the current company's name from the
-- user's company_memberships rows:
--     memberships.find(m => m.company_id === companyId)?.company_profile?.name
--       || 'My Company'
-- The signup trigger created the company_profile and set profiles.company_id,
-- but NEVER created a company_memberships row. With no membership to match,
-- the switcher falls back to the literal string "My Company".
--
-- This makes handle_new_user also create the membership, and backfills a
-- membership for every existing profile that has a company but no membership.
-- (company_memberships cascades on company delete, so no orphan risk.)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INT;
  new_company UUID;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO existing_count FROM public.profiles;

    IF existing_count = 0 THEN
      INSERT INTO public.company_profile (name, onboarding_complete)
      VALUES ('My Company', FALSE)
      RETURNING id INTO new_company;
    ELSE
      new_company := NULL;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, company_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      CASE WHEN existing_count = 0 THEN 'super_admin' ELSE 'employee' END,
      new_company
    )
    ON CONFLICT (id) DO NOTHING;

    -- Give the first user a membership to their company so the switcher/sidebar
    -- can resolve the company name (otherwise it falls back to "My Company").
    IF new_company IS NOT NULL THEN
      INSERT INTO public.company_memberships (user_id, company_id, role)
      VALUES (NEW.id, new_company, 'super_admin')
      ON CONFLICT (user_id, company_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- Backfill: create a membership for every profile that has a company but no
-- membership row yet (fixes the current account immediately).
-- ------------------------------------------------------------
INSERT INTO public.company_memberships (user_id, company_id, role)
SELECT p.id, p.company_id, COALESCE(p.role, 'super_admin')
FROM public.profiles p
WHERE p.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.company_memberships m
    WHERE m.user_id = p.id AND m.company_id = p.company_id
  )
ON CONFLICT (user_id, company_id) DO NOTHING;
