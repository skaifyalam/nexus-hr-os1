-- ============================================================
-- NEXUS HR — Multi-Company + Org Structure
-- Run AFTER 20_active_status.sql
-- ============================================================

-- 1) MEMBERSHIPS: one user can belong to many companies
CREATE TABLE IF NOT EXISTS company_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'super_admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memberships_own" ON company_memberships;
CREATE POLICY "memberships_own" ON company_memberships
  FOR ALL USING (user_id = auth.uid()::UUID);

-- Seed: every existing profile gets a membership for their current company
INSERT INTO company_memberships (user_id, company_id, role)
SELECT p.id, p.company_id, p.role FROM profiles p
WHERE p.company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- 2) SWITCH COMPANY: validates membership, moves the active pointer.
--    RLS everywhere reads profiles.company_id, so nothing else changes.
CREATE OR REPLACE FUNCTION public.switch_company(target_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user UUID;
  v_has BOOLEAN;
BEGIN
  v_user := auth.uid()::UUID;
  SELECT EXISTS(
    SELECT 1 FROM company_memberships
    WHERE user_id = v_user AND company_id = target_company_id::UUID
  ) INTO v_has;
  IF NOT v_has THEN RETURN FALSE; END IF;
  UPDATE profiles SET company_id = target_company_id::UUID WHERE id = v_user;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.switch_company TO authenticated;

-- 3) CREATE ADDITIONAL COMPANY: new company + membership + switch to it
CREATE OR REPLACE FUNCTION public.create_additional_company(p_name TEXT)
RETURNS UUID AS $$
DECLARE
  v_user UUID;
  v_company UUID;
BEGIN
  v_user := auth.uid()::UUID;
  INSERT INTO company_profile (name, onboarding_complete)
  VALUES (p_name, false) RETURNING id INTO v_company;
  INSERT INTO company_memberships (user_id, company_id, role)
  VALUES (v_user, v_company, 'super_admin');
  UPDATE profiles SET company_id = v_company WHERE id = v_user;
  RETURN v_company;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.create_additional_company TO authenticated;

-- 4) ORG STRUCTURE: user-defined hierarchy tree (companies, countries,
--    projects, departments, roles — any levels they want), drag-drop editable
CREATE TABLE IF NOT EXISTS org_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES org_nodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  node_type TEXT DEFAULT 'unit',   -- company | country | project | department | position | unit
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_nodes_company ON org_nodes(company_id);
CREATE INDEX IF NOT EXISTS idx_org_nodes_parent ON org_nodes(parent_id);

ALTER TABLE org_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_nodes_access" ON org_nodes;
CREATE POLICY "org_nodes_access" ON org_nodes
  FOR ALL USING (company_id = public.user_company_id());
