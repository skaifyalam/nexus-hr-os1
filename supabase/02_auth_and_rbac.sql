-- ============================================================
-- NEXUS HR — Auth & RBAC Layer
-- Run this AFTER schema.sql, in Supabase SQL Editor
-- ============================================================

-- ─── ORGANIZATIONS ────────────────────────────────────────
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO organizations (name) VALUES ('My Company');

-- ─── PROFILES (extends Supabase Auth users) ───────────────
-- Roles: super_admin, hr_director, hr_manager, recruitment_manager,
--        agency_user, finance_manager, department_manager, employee
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'employee',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────
-- The FIRST person to ever sign up automatically becomes Super Admin.
-- Everyone after that defaults to 'employee' until promoted.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INT;
  default_org UUID;
BEGIN
  SELECT COUNT(*) INTO existing_count FROM public.profiles;
  SELECT id INTO default_org FROM public.organizations LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN existing_count = 0 THEN 'super_admin' ELSE 'employee' END,
    default_org
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles in org" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Authenticated can view organizations" ON organizations FOR SELECT USING (true);

-- ─── PROMOTE YOURSELF MANUALLY (backup option) ────────────
-- If for any reason you are not auto-promoted to super_admin,
-- run this after signing up, replacing the email:
--
-- UPDATE profiles SET role = 'super_admin' WHERE email = 'you@example.com';
