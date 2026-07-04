-- ============================================================
-- NEXUS HR — Document Expiry Tracking (no file storage)
-- Tracks Iqama/passport/visa/contract expiry with alerts
-- Self-healing. Run AFTER 25_attendance_performance.sql
-- ============================================================

DROP TABLE IF EXISTS document_records CASCADE;
CREATE TABLE document_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  employee_record_id UUID,
  employee_name TEXT,
  employee_code TEXT,
  doc_type TEXT NOT NULL,          -- "Iqama", "Passport", "Visa", "Contract" (company-defined)
  doc_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_documents_company ON document_records(company_id);
CREATE INDEX idx_documents_expiry ON document_records(expiry_date);
ALTER TABLE document_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_access" ON document_records
  FOR ALL USING (company_id = public.user_company_id());
