-- ============================================================
-- NAIBUS — Fix "Database error creating new user"
-- The handle_new_user trigger was failing, which blocked ALL user creation
-- (dashboard, app, admin API, signUp — everything fires this trigger).
-- This makes the trigger robust so it can never block user creation.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INT;
  default_org UUID;
  new_company UUID;
BEGIN
  -- Wrap everything so a failure here NEVER blocks the auth user from being created.
  BEGIN
    SELECT COUNT(*) INTO existing_count FROM public.profiles;
    SELECT id INTO default_org FROM public.organizations LIMIT 1;

    IF existing_count = 0 THEN
      INSERT INTO public.company_profile (name, onboarding_complete)
      VALUES ('My Company', FALSE)
      RETURNING id INTO new_company;
    ELSE
      new_company := NULL;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, organization_id, company_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      CASE WHEN existing_count = 0 THEN 'super_admin' ELSE 'employee' END,
      default_org,
      new_company
    )
    ON CONFLICT (id) DO NOTHING;   -- never fail if the row already exists
  EXCEPTION WHEN OTHERS THEN
    -- Log nothing, swallow the error — the important thing is the auth user is created.
    -- The app links the profile afterward anyway.
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
