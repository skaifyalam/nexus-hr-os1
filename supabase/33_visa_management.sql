-- ============================================================
-- NEXUS HR — Visa Management. Self-healing.
-- Run AFTER 32_legacy_cleanup.sql
-- A "visa block" = a visa authorization with a quantity you allocate people to.
-- Balance = total_quantity - active allocations.
-- ============================================================

DROP TABLE IF EXISTS visa_allocations CASCADE;
DROP TABLE IF EXISTS visa_blocks CASCADE;

CREATE TABLE visa_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  authority_number TEXT,               -- visa authority / block number
  visa_type TEXT,                      -- Work Visa, TCV, Block Visa, etc. (company-defined)
  profession TEXT,                     -- profession the visa is for
  nationality TEXT,                    -- nationality restriction, if any
  sponsor TEXT,                        -- sponsor / company name
  total_quantity INT DEFAULT 1,        -- how many people this visa covers
  issue_date DATE,
  expiry_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_visa_blocks_company ON visa_blocks(company_id);
ALTER TABLE visa_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visa_blocks_access" ON visa_blocks
  FOR ALL USING (company_id = public.user_company_id());

CREATE TABLE visa_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE,
  visa_block_id UUID REFERENCES visa_blocks(id) ON DELETE CASCADE,
  person_record_id UUID,               -- link to section_records (candidate/employee)
  person_name TEXT,
  person_code TEXT,
  passport_number TEXT,
  status TEXT DEFAULT 'allocated',     -- allocated | used | cancelled
  allocated_date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_visa_alloc_company ON visa_allocations(company_id);
CREATE INDEX idx_visa_alloc_block ON visa_allocations(visa_block_id);
ALTER TABLE visa_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visa_alloc_access" ON visa_allocations
  FOR ALL USING (company_id = public.user_company_id());
