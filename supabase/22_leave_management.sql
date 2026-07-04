-- ============================================================
-- NEXUS HR — Leave Management (self-healing)
-- Drops any partial/broken versions, then rebuilds clean.
-- Safe: these tables hold no data until this migration succeeds.
-- Run AFTER 21_multi_company_structure.sql
-- ============================================================

-- Remove any partially-created versions from failed runs
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS leave_types CASCADE;

-- 1) LEAVE TYPES
CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_per_year NUMERIC(5,1) DEFAULT 0,
  color TEXT DEFAULT 'indigo',
  paid BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) LEAVE REQUESTS
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  employee_record_id UUID,
  employee_name TEXT,
  employee_code TEXT,
  leave_type_id UUID REFERENCES leave_types(id) ON DELETE SET NULL,
  leave_type_name TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(5,1) NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  approver_note TEXT,
  requested_by TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_requests_company ON leave_requests(company_id);
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_record_id);
CREATE INDEX idx_leave_types_company ON leave_types(company_id);

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_types_access" ON leave_types
  FOR ALL USING (company_id = public.user_company_id());

CREATE POLICY "leave_requests_access" ON leave_requests
  FOR ALL USING (company_id = public.user_company_id());
