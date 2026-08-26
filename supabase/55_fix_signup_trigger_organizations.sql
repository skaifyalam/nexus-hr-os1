-- 55_fix_signup_trigger_organizations.sql
-- ============================================================
-- ROOT CAUSE of "new signups have no profile / no super_admin / no name":
--
-- Migration 32 dropped the `organizations` table (DROP TABLE ... CASCADE),
-- but handle_new_user (migration 41) still ran:
--     SELECT id INTO default_org FROM public.organizations LIMIT 1;
-- That query throws "relation organizations does not exist". The trigger's
-- EXCEPTION WHEN OTHERS THEN NULL swallowed it, so the entire trigger body
-- aborted WITHOUT creating a profile or company. Every real form-signup
-- silently produced an auth user with no profile. (App-created users worked
-- because the invite/username APIs insert the profile directly.)
--
-- This rewrite removes the dead `organizations` dependency, logs failures
-- instead of hiding them, and backfills the current profile-less user.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INT;
  new_company UUID;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO existing_count FROM public.profiles;

    -- First user of an empty database gets a fresh company + super_admin.
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
  EXCEPTION WHEN OTHERS THEN
    -- Do NOT block auth-user creation, but LOG the failure (visible in
    -- Supabase → Logs → Postgres) instead of swallowing it silently.
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- One-time backfill: the user you just signed up as has an auth row but no
-- profile (because the trigger was broken). If there are zero profiles,
-- promote the earliest auth user to super_admin with a fresh company.
-- The company insert fires the 54 section-seeding trigger automatically.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_user   auth.users%ROWTYPE;
  v_company UUID;
BEGIN
  IF (SELECT COUNT(*) FROM public.profiles) = 0 THEN
    SELECT * INTO v_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
    IF v_user.id IS NOT NULL THEN
      INSERT INTO public.company_profile (name, onboarding_complete)
      VALUES ('My Company', FALSE)
      RETURNING id INTO v_company;

      INSERT INTO public.profiles (id, email, full_name, role, company_id)
      VALUES (
        v_user.id,
        v_user.email,
        COALESCE(v_user.raw_user_meta_data->>'full_name', split_part(v_user.email, '@', 1)),
        'super_admin',
        v_company
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;
END $$;
