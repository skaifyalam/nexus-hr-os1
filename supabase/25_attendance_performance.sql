-- ============================================================
-- NEXUS HR — Attendance + Performance (self-healing)
-- Run AFTER 24_billing.sql
-- ============================================================

-- ATTENDANCE: daily records per employee
DROP TABLE IF EXISTS attendance_records CASCADE;
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  employee_record_id UUID,
  employee_name TEXT,
  employee_code TEXT,
  date DATE NOT NULL,
  status TEXT DEFAULT 'present',   -- present | absent | leave | half_day | holiday | remote
  check_in TEXT,                   -- "09:05"
  check_out TEXT,                  -- "18:10"
  hours NUMERIC(5,2),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_attendance_company ON attendance_records(company_id);
CREATE INDEX idx_attendance_emp ON attendance_records(employee_record_id);
CREATE INDEX idx_attendance_date ON attendance_records(date);
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_access" ON attendance_records
  FOR ALL USING (company_id = public.user_company_id());

-- PERFORMANCE: review cycles + individual reviews
DROP TABLE IF EXISTS performance_reviews CASCADE;
CREATE TABLE performance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  employee_record_id UUID,
  employee_name TEXT,
  employee_code TEXT,
  cycle TEXT,                      -- "2026 Annual", "Q1 2026"
  reviewer TEXT,
  rating NUMERIC(3,1),             -- e.g. 4.5 out of 5
  rating_scale INT DEFAULT 5,
  goals TEXT,
  strengths TEXT,
  improvements TEXT,
  status TEXT DEFAULT 'draft',     -- draft | submitted | acknowledged
  review_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_perf_company ON performance_reviews(company_id);
CREATE INDEX idx_perf_emp ON performance_reviews(employee_record_id);
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "performance_access" ON performance_reviews
  FOR ALL USING (company_id = public.user_company_id());
