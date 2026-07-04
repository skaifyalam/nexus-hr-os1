-- ============================================================
-- NEXUS HR — Leave Policies (criteria-based entitlements)
-- Self-healing. Run AFTER 22_leave_management.sql
-- ============================================================

DROP TABLE IF EXISTS leave_policies CASCADE;

CREATE TABLE leave_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                 -- "Staff Annual", "Labor Annual"
  days_per_year NUMERIC(5,1) DEFAULT 0,
  -- Criteria: which employees this policy applies to.
  -- Matches against employee section_records.data fields.
  criteria_field TEXT,               -- e.g. "category" (employee field key)
  criteria_values JSONB DEFAULT '[]',-- e.g. ["Staff","Management"] — empty = applies to all
  accrual_after_days INT DEFAULT 0,  -- eligible only after N days from joining
  joining_field TEXT,                -- employee field holding joining date (for accrual)
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_policies_company ON leave_policies(company_id);
CREATE INDEX idx_leave_policies_type ON leave_policies(leave_type_id);

ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_policies_access" ON leave_policies
  FOR ALL USING (company_id = public.user_company_id());
