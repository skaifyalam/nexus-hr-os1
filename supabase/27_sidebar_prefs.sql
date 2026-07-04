-- ============================================================
-- NEXUS HR — Sidebar Preferences
-- Feature labels = company-wide (shared). Feature order = per user.
-- Self-healing. Run AFTER 26_documents.sql
-- ============================================================

-- Company-wide feature labels (Super user renames → everyone sees it)
DROP TABLE IF EXISTS feature_labels CASCADE;
CREATE TABLE feature_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,          -- 'compliance', 'leave', etc.
  label TEXT NOT NULL,
  UNIQUE(company_id, feature_key)
);
ALTER TABLE feature_labels ENABLE ROW LEVEL SECURITY;
-- Everyone in the company can READ labels; only super_admin can WRITE
DROP POLICY IF EXISTS "feature_labels_read" ON feature_labels;
CREATE POLICY "feature_labels_read" ON feature_labels
  FOR SELECT USING (company_id = public.user_company_id());
DROP POLICY IF EXISTS "feature_labels_write" ON feature_labels;
CREATE POLICY "feature_labels_write" ON feature_labels
  FOR ALL USING (
    company_id = public.user_company_id()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()::UUID AND p.role = 'super_admin')
  );

-- Per-user feature order (follows the user across devices)
DROP TABLE IF EXISTS user_feature_order CASCADE;
CREATE TABLE user_feature_order (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  ordered_keys JSONB DEFAULT '[]',    -- ["leave","compliance",...]
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);
ALTER TABLE user_feature_order ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_feature_order_own" ON user_feature_order;
CREATE POLICY "user_feature_order_own" ON user_feature_order
  FOR ALL USING (user_id = auth.uid()::UUID);
