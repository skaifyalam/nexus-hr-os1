-- ============================================================
-- NEXUS HR — Custom Approval Chains (Build E). Self-healing.
-- Run AFTER 30_project_scoping.sql
-- ============================================================

-- A workflow = an ordered chain of approver roles for a given process (e.g. "leave")
DROP TABLE IF EXISTS approval_workflows CASCADE;
CREATE TABLE approval_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  process_key TEXT NOT NULL,           -- 'leave', 'requisition', or any custom process
  name TEXT NOT NULL,
  -- steps: ordered array [{ "role_id": "...", "role_name": "Project Manager" }, ...]
  steps JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_workflows_company ON approval_workflows(company_id);
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workflows_read" ON approval_workflows;
CREATE POLICY "workflows_read" ON approval_workflows
  FOR SELECT USING (company_id = public.user_company_id());
DROP POLICY IF EXISTS "workflows_write" ON approval_workflows;
CREATE POLICY "workflows_write" ON approval_workflows
  FOR ALL USING (
    company_id = public.user_company_id()
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()::UUID AND p.role = 'super_admin')
  );

-- An approval instance = one request moving through a workflow
DROP TABLE IF EXISTS approval_requests CASCADE;
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES approval_workflows(id) ON DELETE SET NULL,
  process_key TEXT NOT NULL,
  source_id UUID,                      -- e.g. the leave_request id
  title TEXT,                          -- "Leave — John Doe, 5 days"
  requested_by TEXT,
  current_step INT DEFAULT 0,          -- index into workflow steps
  status TEXT DEFAULT 'pending',       -- pending | approved | rejected
  -- history: [{ step, role_name, decided_by, decision, note, at }]
  history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_approval_req_company ON approval_requests(company_id);
CREATE INDEX idx_approval_req_status ON approval_requests(status);
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approval_req_access" ON approval_requests
  FOR ALL USING (company_id = public.user_company_id());
