-- ============================================================
-- NEXUS HR — User-Defined Fields (CAST-SAFE VERSION)
-- ============================================================

CREATE TABLE IF NOT EXISTS section_field_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT DEFAULT 'text',
  options JSONB DEFAULT '[]',
  is_id_field BOOLEAN DEFAULT FALSE,
  id_format TEXT,
  required BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, section_key, field_key)
);

CREATE TABLE IF NOT EXISTS field_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  field_key TEXT NOT NULL,
  option_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, section_key, field_key, option_value)
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_key TEXT NOT NULL,
  widget_label TEXT NOT NULL,
  widget_type TEXT DEFAULT 'count',
  config JSONB DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  visible BOOLEAN DEFAULT TRUE,
  UNIQUE(company_id, user_id, widget_key)
);

CREATE TABLE IF NOT EXISTS requisition_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id UUID REFERENCES requisitions(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  headcount INTEGER DEFAULT 1,
  department_id UUID REFERENCES departments(id),
  project_id UUID REFERENCES projects(id),
  budget_per_head NUMERIC(12,2),
  notes TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE section_field_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisition_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS UUID AS $$
DECLARE
  v_company UUID;
BEGIN
  SELECT company_id::UUID INTO v_company
  FROM public.profiles
  WHERE id = auth.uid()::UUID;
  RETURN v_company;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.user_company_id TO authenticated;

DROP POLICY IF EXISTS "field_configs_access" ON section_field_configs;
CREATE POLICY "field_configs_access" ON section_field_configs
  FOR ALL USING (company_id::UUID = public.user_company_id());

DROP POLICY IF EXISTS "field_options_access" ON field_options;
CREATE POLICY "field_options_access" ON field_options
  FOR ALL USING (company_id::UUID = public.user_company_id());

DROP POLICY IF EXISTS "dashboard_widgets_access" ON dashboard_widgets;
CREATE POLICY "dashboard_widgets_access" ON dashboard_widgets
  FOR ALL USING (company_id::UUID = public.user_company_id());

DROP POLICY IF EXISTS "req_items_access" ON requisition_items;
CREATE POLICY "req_items_access" ON requisition_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM requisitions r
      WHERE r.id::uuid = requisition_items.requisition_id::uuid
      AND public.user_can_access_operation(r.operation_id::uuid)
    )
  );
