-- ============================================================
-- NEXUS HR PLATFORM — Multi-tenant foundation
-- Safe to re-run — uses IF NOT EXISTS and drops old policies
-- ============================================================

CREATE TABLE IF NOT EXISTS company_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  industry TEXT,
  size_range TEXT,
  headquarters_country TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES company_profile(id);

CREATE TABLE IF NOT EXISTS installed_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT DEFAULT 'layout',
  sidebar_order INTEGER DEFAULT 99,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, module_key)
);

CREATE TABLE IF NOT EXISTS custom_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  sidebar_order INTEGER DEFAULT 99,
  id_format TEXT DEFAULT '{SEQ4}',
  id_last_sequence INTEGER DEFAULT 0,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID REFERENCES custom_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options JSONB,
  required BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID REFERENCES custom_sections(id) ON DELETE CASCADE,
  record_id TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sidebar_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT DEFAULT 'layout',
  sidebar_order INTEGER DEFAULT 99,
  visible BOOLEAN DEFAULT TRUE,
  UNIQUE(company_id, item_type, item_key)
);

CREATE TABLE IF NOT EXISTS onboarding_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS — drop all first, then recreate safely ─────────────
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE installed_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sidebar_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company data access" ON company_profile;
DROP POLICY IF EXISTS "Company modules access" ON installed_modules;
DROP POLICY IF EXISTS "Company sections access" ON custom_sections;
DROP POLICY IF EXISTS "Company fields access" ON custom_fields;
DROP POLICY IF EXISTS "Company records access" ON custom_records;
DROP POLICY IF EXISTS "Company sidebar access" ON sidebar_config;
DROP POLICY IF EXISTS "Company onboarding access" ON onboarding_messages;

CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()::UUID;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.user_company_id TO authenticated;

CREATE POLICY "Company data access" ON company_profile
  FOR ALL USING (id = public.user_company_id());

CREATE POLICY "Company modules access" ON installed_modules
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "Company sections access" ON custom_sections
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "Company fields access" ON custom_fields
  FOR ALL USING (
    section_id IN (
      SELECT id FROM custom_sections WHERE company_id = public.user_company_id()
    )
  );

CREATE POLICY "Company records access" ON custom_records
  FOR ALL USING (
    section_id IN (
      SELECT id FROM custom_sections WHERE company_id = public.user_company_id()
    )
  );

CREATE POLICY "Company sidebar access" ON sidebar_config
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "Company onboarding access" ON onboarding_messages
  FOR ALL USING (company_id = public.user_company_id());

-- ─── ID generator for custom sections ───────────────────────
CREATE OR REPLACE FUNCTION public.generate_custom_record_id(p_section_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_format TEXT;
  v_seq INTEGER;
  v_result TEXT;
BEGIN
  UPDATE custom_sections
  SET id_last_sequence = id_last_sequence + 1
  WHERE id = p_section_id
  RETURNING id_format, id_last_sequence INTO v_format, v_seq;
  v_result := COALESCE(v_format, '{SEQ4}');
  v_result := REPLACE(v_result, '{YEAR}',  TO_CHAR(NOW(), 'YYYY'));
  v_result := REPLACE(v_result, '{MONTH}', TO_CHAR(NOW(), 'MM'));
  v_result := REPLACE(v_result, '{SEQ3}',  LPAD(v_seq::TEXT, 3, '0'));
  v_result := REPLACE(v_result, '{SEQ4}',  LPAD(v_seq::TEXT, 4, '0'));
  v_result := REPLACE(v_result, '{SEQ5}',  LPAD(v_seq::TEXT, 5, '0'));
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.generate_custom_record_id TO authenticated;

-- ─── Update handle_new_user to create company ───────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INT;
  default_org UUID;
  new_company UUID;
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
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Allow anyone authenticated to insert their own company ──
-- The RLS policy blocks insert because company_id isn't set yet
-- when a new company is being created for the first time.
-- We fix this by allowing authenticated users to insert,
-- then the SELECT/UPDATE/DELETE remain scoped to their company.
DROP POLICY IF EXISTS "Company data access" ON company_profile;

CREATE POLICY "Company select" ON company_profile
  FOR SELECT USING (id = public.user_company_id());

CREATE POLICY "Company insert" ON company_profile
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Company update" ON company_profile
  FOR UPDATE USING (id = public.user_company_id());

CREATE POLICY "Company delete" ON company_profile
  FOR DELETE USING (id = public.user_company_id());

-- Same fix for installed_modules and custom_sections
DROP POLICY IF EXISTS "Company modules access" ON installed_modules;
CREATE POLICY "Company modules select" ON installed_modules FOR SELECT USING (company_id = public.user_company_id());
CREATE POLICY "Company modules insert" ON installed_modules FOR INSERT WITH CHECK (true);
CREATE POLICY "Company modules update" ON installed_modules FOR UPDATE USING (company_id = public.user_company_id());
CREATE POLICY "Company modules delete" ON installed_modules FOR DELETE USING (company_id = public.user_company_id());

DROP POLICY IF EXISTS "Company sections access" ON custom_sections;
CREATE POLICY "Company sections select" ON custom_sections FOR SELECT USING (company_id = public.user_company_id());
CREATE POLICY "Company sections insert" ON custom_sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Company sections update" ON custom_sections FOR UPDATE USING (company_id = public.user_company_id());
CREATE POLICY "Company sections delete" ON custom_sections FOR DELETE USING (company_id = public.user_company_id());
