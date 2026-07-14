-- ============================================================
-- NAIBUS — Remobilization (bringing back an exited employee)
-- Triggered from an exit record. Decision tree based on original visa
-- type + how they left decides the path: NEW VISA or QIWA TRANSFER.
-- Fully generic — works for any company.
-- ============================================================

DROP TABLE IF EXISTS remobilizations CASCADE;
CREATE TABLE remobilizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  exit_record_id UUID,                 -- the exit this remobilization came from (optional)
  person_record_id UUID,               -- the employee record
  person_name TEXT,
  person_code TEXT,

  -- Decision-tree inputs (the system asks these when remobilizing)
  original_visa_type TEXT,             -- Work Visa | Temporary Visa | Business Visa | Visit Visa
  how_left TEXT,                       -- exited | local_transfer

  -- Derived path from the decision tree
  path TEXT,                           -- new_visa | qiwa_transfer

  -- Status of the remobilization itself
  status TEXT DEFAULT 'pending',       -- pending | visa_allocated | qiwa_allocated | completed | cancelled

  -- Links into visa management (when a visa or QIWA is allocated for this person)
  visa_allocation_id UUID,             -- if new_visa path → the visa_allocations row
  qiwa_transfer_id UUID,               -- if qiwa_transfer path → the qiwa_transfers row

  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_remob_company ON remobilizations(company_id);
CREATE INDEX idx_remob_status ON remobilizations(company_id, status);

-- QIWA transfers — parallel to visa allocations, for the local-transfer path.
DROP TABLE IF EXISTS qiwa_transfers CASCADE;
CREATE TABLE qiwa_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  person_record_id UUID,
  person_name TEXT,
  person_code TEXT,
  iqama_number TEXT,
  from_sponsor TEXT,                   -- current/previous sponsor
  stage TEXT DEFAULT 'requested',      -- requested | submitted | approved | completed | cancelled
  requested_date DATE,
  submitted_date DATE,
  approved_date DATE,
  completed_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_qiwa_company ON qiwa_transfers(company_id);

-- RLS: company isolation
ALTER TABLE remobilizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS remob_isolation ON remobilizations;
CREATE POLICY remob_isolation ON remobilizations
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE qiwa_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qiwa_isolation ON qiwa_transfers;
CREATE POLICY qiwa_isolation ON qiwa_transfers
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
