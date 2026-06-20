-- ============================================================
-- NEXUS HR — Complete Supabase Database Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── DEPARTMENTS ──────────────────────────────────────────
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO departments (name, code) VALUES
  ('Engineering', 'ENG'),
  ('Human Resources', 'HR'),
  ('Operations', 'OPS'),
  ('Finance', 'FIN'),
  ('Information Technology', 'IT'),
  ('Procurement', 'PRO'),
  ('HSE', 'HSE');

-- ─── EMPLOYEES ────────────────────────────────────────────
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nationality TEXT,
  passport_number TEXT,
  passport_expiry DATE,
  iqama_number TEXT,
  iqama_expiry DATE,
  visa_number TEXT,
  department_id UUID REFERENCES departments(id),
  job_title TEXT,
  contract_type TEXT DEFAULT 'direct',
  salary NUMERIC(12,2),
  joining_date DATE,
  status TEXT DEFAULT 'active',
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EMPLOYEE DOCUMENTS ───────────────────────────────────
CREATE TABLE employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url TEXT,
  expiry_date DATE,
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EMPLOYEE STATUS HISTORY ──────────────────────────────
CREATE TABLE employee_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  reason TEXT,
  effective_date DATE,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RECRUITMENT REQUISITIONS ─────────────────────────────
CREATE TABLE requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id TEXT UNIQUE NOT NULL,
  position TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  headcount INTEGER DEFAULT 1,
  budget NUMERIC(12,2),
  required_by DATE,
  job_description TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CANDIDATES ───────────────────────────────────────────
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id TEXT UNIQUE NOT NULL,
  requisition_id UUID REFERENCES requisitions(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nationality TEXT,
  passport_number TEXT,
  phone TEXT,
  email TEXT,
  stage TEXT DEFAULT 'sourcing',
  agency TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MOBILIZATION STAGES ──────────────────────────────────
CREATE TABLE mobilization_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CANDIDATE DOCUMENTS ──────────────────────────────────
CREATE TABLE candidate_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE
);

-- ─── LEAVE TYPES ──────────────────────────────────────────
CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  annual_entitlement INTEGER DEFAULT 21,
  description TEXT
);

INSERT INTO leave_types (name, annual_entitlement) VALUES
  ('Annual', 21),
  ('Sick', 14),
  ('Emergency', 5),
  ('Unpaid', 0),
  ('Maternity', 60),
  ('Paternity', 3);

-- ─── LEAVE REQUESTS ───────────────────────────────────────
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leave_id TEXT UNIQUE NOT NULL,
  employee_id UUID REFERENCES employees(id),
  leave_type_id UUID REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PERFORMANCE REVIEWS ──────────────────────────────────
CREATE TABLE performance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id TEXT UNIQUE NOT NULL,
  employee_id UUID REFERENCES employees(id),
  review_period TEXT,
  kpi_score NUMERIC(4,2),
  manager_rating NUMERIC(4,2),
  manager_comments TEXT,
  ai_summary TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DISCIPLINARY RECORDS ─────────────────────────────────
CREATE TABLE disciplinary_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  employee_id UUID REFERENCES employees(id),
  incident_date DATE,
  severity TEXT,
  description TEXT,
  warning_letter TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EXIT RECORDS ─────────────────────────────────────────
CREATE TABLE exit_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exit_id TEXT UNIQUE NOT NULL,
  employee_id UUID REFERENCES employees(id),
  exit_type TEXT,
  notice_date DATE,
  last_working_day DATE,
  reason TEXT,
  ai_summary TEXT,
  clearance_it BOOLEAN DEFAULT FALSE,
  clearance_finance BOOLEAN DEFAULT FALSE,
  clearance_admin BOOLEAN DEFAULT FALSE,
  clearance_hr BOOLEAN DEFAULT FALSE,
  final_settlement NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── KNOWLEDGE DOCUMENTS ──────────────────────────────────
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  document_type TEXT DEFAULT 'policy',
  content TEXT,
  ai_summary TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MEETINGS ─────────────────────────────────────────────
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  attendees TEXT,
  agenda TEXT,
  notes TEXT,
  action_items JSONB DEFAULT '[]',
  ai_summary TEXT,
  minutes TEXT,
  status TEXT DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AI REPORTS ───────────────────────────────────────────
CREATE TABLE ai_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt TEXT NOT NULL,
  report_type TEXT DEFAULT 'narrative',
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUDIT LOGS ───────────────────────────────────────────
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  actor TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SAMPLE DATA ──────────────────────────────────────────
INSERT INTO employees (employee_id, first_name, last_name, email, nationality, passport_number, passport_expiry, iqama_number, iqama_expiry, job_title, contract_type, salary, joining_date, status) 
SELECT 
  'EMP-001', 'Ahmed', 'Al-Rashid', 'ahmed@company.com', 'Saudi', 'P123456', CURRENT_DATE + 180, 'IQ-100001', CURRENT_DATE + 36, 'Senior Engineer', 'direct', 18000, '2022-03-01', 'active'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE employee_id = 'EMP-001');

UPDATE employees SET department_id = (SELECT id FROM departments WHERE code = 'ENG' LIMIT 1) WHERE employee_id = 'EMP-001';

INSERT INTO employees (employee_id, first_name, last_name, email, nationality, passport_number, passport_expiry, iqama_number, iqama_expiry, job_title, contract_type, salary, joining_date, status)
SELECT 'EMP-002', 'Sarah', 'Johnson', 'sarah@company.com', 'British', 'P654321', CURRENT_DATE + 400, 'IQ-100002', CURRENT_DATE + 51, 'HR Director', 'direct', 22000, '2021-06-15', 'active'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE employee_id = 'EMP-002');

UPDATE employees SET department_id = (SELECT id FROM departments WHERE code = 'HR' LIMIT 1) WHERE employee_id = 'EMP-002';

INSERT INTO employees (employee_id, first_name, last_name, email, nationality, passport_number, passport_expiry, iqama_number, iqama_expiry, job_title, contract_type, salary, joining_date, status)
SELECT 'EMP-003', 'Mohammed', 'Khan', 'mkhan@company.com', 'Pakistani', 'P789012', CURRENT_DATE + 16, 'IQ-100003', CURRENT_DATE + 16, 'Operations Manager', 'agency', 16000, '2020-01-10', 'active'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE employee_id = 'EMP-003');

UPDATE employees SET department_id = (SELECT id FROM departments WHERE code = 'OPS' LIMIT 1) WHERE employee_id = 'EMP-003';

INSERT INTO employees (employee_id, first_name, last_name, email, nationality, passport_number, passport_expiry, iqama_number, iqama_expiry, job_title, contract_type, salary, joining_date, status)
SELECT 'EMP-004', 'Omar', 'Hassan', 'omar@company.com', 'Egyptian', 'P345678', CURRENT_DATE + 280, 'IQ-100004', CURRENT_DATE + 25, 'Civil Engineer', 'agency', 12000, '2023-05-15', 'active'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE employee_id = 'EMP-004');

UPDATE employees SET department_id = (SELECT id FROM departments WHERE code = 'ENG' LIMIT 1) WHERE employee_id = 'EMP-004';

-- ─── ROW LEVEL SECURITY ───────────────────────────────────
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (lock down per role later)
CREATE POLICY "Enable all for authenticated" ON employees FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON leave_requests FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON performance_reviews FOR ALL USING (true);
CREATE POLICY "Enable all for authenticated" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Enable all" ON departments FOR ALL USING (true);
CREATE POLICY "Enable all" ON requisitions FOR ALL USING (true);
CREATE POLICY "Enable all" ON candidates FOR ALL USING (true);
CREATE POLICY "Enable all" ON candidate_documents FOR ALL USING (true);
CREATE POLICY "Enable all" ON mobilization_stages FOR ALL USING (true);
CREATE POLICY "Enable all" ON disciplinary_records FOR ALL USING (true);
CREATE POLICY "Enable all" ON exit_records FOR ALL USING (true);
CREATE POLICY "Enable all" ON knowledge_documents FOR ALL USING (true);
CREATE POLICY "Enable all" ON meetings FOR ALL USING (true);
CREATE POLICY "Enable all" ON ai_reports FOR ALL USING (true);
CREATE POLICY "Enable all" ON leave_types FOR ALL USING (true);
CREATE POLICY "Enable all" ON employee_documents FOR ALL USING (true);
CREATE POLICY "Enable all" ON employee_status_history FOR ALL USING (true);
