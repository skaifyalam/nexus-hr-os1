-- ============================================================
-- NEXUS HR — Multi-Country Operations, Projects & Transfer Tracking
-- Run this AFTER schema.sql and 02_auth_and_rbac.sql
-- ============================================================

-- ─── OPERATIONS (Countries) ────────────────────────────────
CREATE TABLE operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  country_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO operations (name, country_code) VALUES
  ('Saudi Arabia Operations', 'SA'),
  ('Kuwait Operations', 'KW');

-- ─── PROJECTS (belong to an operation/country) ─────────────
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_id UUID REFERENCES operations(id),
  project_code TEXT,
  project_name TEXT,
  client TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO projects (operation_id, project_code, project_name, client)
SELECT id, 'S.022', 'Fadhili', 'Saudi Aramco' FROM operations WHERE country_code = 'SA';

INSERT INTO projects (operation_id, project_code, project_name, client)
SELECT id, 'S.013', 'Marjan', 'Saudi Aramco' FROM operations WHERE country_code = 'SA';

-- ─── ADD COUNTRY/PROJECT TO EMPLOYEES ──────────────────────
ALTER TABLE employees ADD COLUMN operation_id UUID REFERENCES operations(id);
ALTER TABLE employees ADD COLUMN current_project_id UUID REFERENCES projects(id);

-- Assign existing sample employees to Saudi Arabia by default
UPDATE employees SET operation_id = (SELECT id FROM operations WHERE country_code = 'SA' LIMIT 1)
WHERE operation_id IS NULL;

-- Put two sample engineers on two different projects, to demo project-tracking
UPDATE employees SET current_project_id = (SELECT id FROM projects WHERE project_code = 'S.022')
WHERE employee_id = 'EMP-001';

UPDATE employees SET current_project_id = (SELECT id FROM projects WHERE project_code = 'S.013')
WHERE employee_id = 'EMP-004';

-- Add country scoping to recruitment tables too (ready for Phase 2)
ALTER TABLE requisitions ADD COLUMN operation_id UUID REFERENCES operations(id);
ALTER TABLE candidates ADD COLUMN operation_id UUID REFERENCES operations(id);

-- ─── WHO CAN SEE WHICH COUNTRY ─────────────────────────────
-- A user can be linked to one or more operations (countries).
-- super_admin and hr_director roles automatically see everything.
CREATE TABLE user_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id UUID REFERENCES operations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, operation_id)
);

-- ─── EMPLOYEE ASSIGNMENT HISTORY ───────────────────────────
-- Every country / project / department / title / salary an employee
-- has ever had, with start and end dates. This is the permanent record.
CREATE TABLE employee_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  operation_id UUID REFERENCES operations(id),
  project_id UUID REFERENCES projects(id),
  department_id UUID REFERENCES departments(id),
  job_title TEXT,
  salary NUMERIC(12,2),
  assignment_type TEXT DEFAULT 'initial_hire',
  -- initial_hire, transfer, project_change, department_change, role_change, salary_revision
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUTO-LOG: FIRST HIRE ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.track_employee_initial_assignment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.employee_assignments
    (employee_id, operation_id, project_id, department_id, job_title, salary, assignment_type, start_date)
  VALUES
    (NEW.id, NEW.operation_id, NEW.current_project_id, NEW.department_id, NEW.job_title, NEW.salary,
     'initial_hire', COALESCE(NEW.joining_date, CURRENT_DATE));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_employee_created
  AFTER INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.track_employee_initial_assignment();

-- ─── AUTO-LOG: ANY FUTURE CHANGE ────────────────────────────
-- This fires automatically whenever country, project, department,
-- title, or salary changes — from the app, a future mobile app,
-- or even a manual edit. History can never be forgotten.
CREATE OR REPLACE FUNCTION public.track_employee_assignment_change()
RETURNS TRIGGER AS $$
DECLARE
  change_type TEXT;
BEGIN
  IF (OLD.operation_id IS DISTINCT FROM NEW.operation_id OR
      OLD.current_project_id IS DISTINCT FROM NEW.current_project_id OR
      OLD.department_id IS DISTINCT FROM NEW.department_id OR
      OLD.job_title IS DISTINCT FROM NEW.job_title OR
      OLD.salary IS DISTINCT FROM NEW.salary)
  THEN
    change_type := CASE
      WHEN OLD.operation_id IS DISTINCT FROM NEW.operation_id THEN 'transfer'
      WHEN OLD.current_project_id IS DISTINCT FROM NEW.current_project_id THEN 'project_change'
      WHEN OLD.job_title IS DISTINCT FROM NEW.job_title THEN 'role_change'
      WHEN OLD.salary IS DISTINCT FROM NEW.salary THEN 'salary_revision'
      WHEN OLD.department_id IS DISTINCT FROM NEW.department_id THEN 'department_change'
      ELSE 'update'
    END;

    UPDATE public.employee_assignments
    SET end_date = CURRENT_DATE
    WHERE employee_id = NEW.id AND end_date IS NULL;

    INSERT INTO public.employee_assignments
      (employee_id, operation_id, project_id, department_id, job_title, salary, assignment_type, start_date)
    VALUES
      (NEW.id, NEW.operation_id, NEW.current_project_id, NEW.department_id, NEW.job_title, NEW.salary,
       change_type, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_employee_change
  AFTER UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.track_employee_assignment_change();

-- ─── TRANSFER REQUESTS (cross-country / cross-project moves) ─
CREATE TABLE transfer_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id TEXT UNIQUE NOT NULL,
  employee_id UUID REFERENCES employees(id),
  from_operation_id UUID REFERENCES operations(id),
  to_operation_id UUID REFERENCES operations(id),
  from_project_id UUID REFERENCES projects(id),
  to_project_id UUID REFERENCES projects(id),
  reason TEXT,
  target_join_date DATE,
  status TEXT DEFAULT 'requested', -- requested, in_progress, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ─── TRANSFER CHECKLIST ─────────────────────────────────────
CREATE TABLE transfer_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_request_id UUID REFERENCES transfer_requests(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  completed_date DATE,
  notes TEXT
);

-- Auto-create the standard checklist when a transfer is requested.
-- Same stages apply whether it's a cross-country or same-country project move;
-- unnecessary steps can simply be marked complete immediately by HR.
CREATE OR REPLACE FUNCTION public.create_default_transfer_checklist()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.transfer_checklist (transfer_request_id, stage) VALUES
    (NEW.id, 'Medical Examination'),
    (NEW.id, 'Biometric Enrollment'),
    (NEW.id, 'Skill Test / Re-certification'),
    (NEW.id, 'Visa / Iqama Transfer Processing'),
    (NEW.id, 'Exit Clearance — Origin Project'),
    (NEW.id, 'Entry Processing — Destination Project');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_transfer_created
  AFTER INSERT ON public.transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.create_default_transfer_checklist();

-- ─── ROW LEVEL SECURITY: THE ACTUAL COUNTRY-LOCK ────────────
-- This function is the single source of truth for "can this logged-in
-- user see this country's data?" — used by every scoped table below.
CREATE OR REPLACE FUNCTION public.user_can_access_operation(op_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF op_id IS NULL THEN RETURN TRUE; END IF;
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  IF user_role IN ('super_admin', 'hr_director') THEN
    RETURN TRUE; -- these two roles always see every country
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_operations
    WHERE user_id = auth.uid() AND operation_id = op_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- IMPORTANT: remove the old "see everything" rule from Phase 1
-- so the new country-scoped rule actually takes effect.
DROP POLICY IF EXISTS "Enable all for authenticated" ON employees;

CREATE POLICY "Country scoped employee access" ON employees
  FOR ALL USING (public.user_can_access_operation(operation_id));

ALTER TABLE employee_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Country scoped assignment history" ON employee_assignments
  FOR ALL USING (public.user_can_access_operation(operation_id));

ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Country scoped transfer access" ON transfer_requests
  FOR ALL USING (
    public.user_can_access_operation(from_operation_id)
    OR public.user_can_access_operation(to_operation_id)
  );

ALTER TABLE transfer_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Transfer checklist access" ON transfer_checklist
  FOR ALL USING (EXISTS (
    SELECT 1 FROM transfer_requests tr WHERE tr.id = transfer_request_id
    AND (public.user_can_access_operation(tr.from_operation_id)
         OR public.user_can_access_operation(tr.to_operation_id))
  ));

ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view the country list" ON operations FOR SELECT USING (true);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view the project list" ON projects FOR SELECT USING (true);

ALTER TABLE user_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View operation assignments" ON user_operations FOR SELECT USING (true);
CREATE POLICY "Admins manage operation assignments" ON user_operations FOR ALL USING (true);

-- ─── HOW TO GIVE SOMEONE ACCESS TO ONE COUNTRY ONLY ─────────
-- Example: restrict a Kuwait HR Manager to Kuwait data only.
-- Run this manually after they sign up (Super Admin/HR Director skip this — they see everything):
--
-- UPDATE profiles SET role = 'hr_manager' WHERE email = 'kuwait.hr@company.com';
-- INSERT INTO user_operations (user_id, operation_id)
-- SELECT id, (SELECT id FROM operations WHERE country_code = 'KW')
-- FROM auth.users WHERE email = 'kuwait.hr@company.com';
