-- ============================================================
-- NEXUS HR — Leave Management
-- Company-defined leave types, requests, approvals, balances
-- Run AFTER 21_multi_company_structure.sql
-- ============================================================

-- 1) LEAVE TYPES — each company defines their own (Annual, Sick, Hajj, etc.)
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- "Annual Leave", "Sick Leave", "Hajj Leave"
  days_per_year NUMERIC(5,1) DEFAULT 0,  -- default annual entitlement
  color TEXT DEFAULT 'indigo',
  paid BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  employee_record_id UUID,               -- section_records.id of the employee
  employee_name TEXT,                    -- denormalized for display
  employee_code TEXT,                    -- denormalized ID
  leave_type_id UUID REFERENCES leave_types(id) ON DELETE SET NULL,
  leave_type_name TEXT,                  -- denormalized
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(5,1) NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT DEFAULT 'pending',         -- pending | approved | rejected | cancelled
  approver_note TEXT,
  requested_by TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_company ON leave_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_record_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_company ON leave_types(company_id);

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_types_access" ON leave_types;
CREATE POLICY "leave_types_access" ON leave_types
  FOR ALL USING (company_id = public.user_company_id());

DROP POLICY IF EXISTS "leave_requests_access" ON leave_requests;
CREATE POLICY "leave_requests_access" ON leave_requests
  FOR ALL USING (company_id = public.user_company_id());

-- Seed a few common leave types for existing companies (only if none exist)
INSERT INTO leave_types (company_id, name, days_per_year, color, sort_order)
SELECT cp.id, t.name, t.days, t.color, t.ord
FROM company_profile cp
CROSS JOIN (VALUES
  ('Annual Leave', 30, 'indigo', 1),
  ('Sick Leave', 15, 'amber', 2),
  ('Unpaid Leave', 0, 'slate', 3)
) AS t(name, days, color, ord)
WHERE NOT EXISTS (SELECT 1 FROM leave_types lt WHERE lt.company_id = cp.id);
