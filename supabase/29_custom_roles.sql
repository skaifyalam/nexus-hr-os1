-- ============================================================
-- NEXUS HR — Custom Roles (Build B)
-- Super user creates any role; each role holds a permission set.
-- Self-healing. Run AFTER 28_profiles.sql
-- ============================================================

DROP TABLE IF EXISTS custom_roles CASCADE;
CREATE TABLE custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- "Project Manager", "Site Admin" — any name
  description TEXT,
  -- Permissions stored as JSONB so it's fully flexible (Build C fills this in)
  -- Shape: { "features": {"leave":"approve","attendance":"apply",...}, "confidential_fields": ["salary"] }
  permissions JSONB DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,       -- true for the built-in super_admin role
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);
CREATE INDEX idx_custom_roles_company ON custom_roles(company_id);
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_roles_read" ON custom_roles;
CREATE POLICY "custom_roles_read" ON custom_roles
  FOR SELECT USING (company_id = public.user_company_id());
DROP POLICY IF EXISTS "custom_roles_write" ON custom_roles;
CREATE POLICY "custom_roles_write" ON custom_roles
  FOR ALL USING (
    company_id = public.user_company_id()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()::UUID AND p.role = 'super_admin')
  );

-- Link a profile to a custom role (in addition to the base 'role' text column)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_role_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS project_scope JSONB DEFAULT '[]';  -- for Build D
