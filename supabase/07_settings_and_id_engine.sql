-- ============================================================
-- NEXUS HR — Phase 2.5: Settings, ID Engine, User Management
-- Run this AFTER 06_recruitment_engine.sql (or the manual blocks)
-- ============================================================

-- ─── ID FORMAT CONFIGURATION ────────────────────────────────
-- Super Admin defines the format for every auto-generated ID.
-- Supported tokens: {SEQ3} {SEQ4} {SEQ5} {YEAR} {MONTH} {COUNTRY} {DEPT}
-- Example: 'NBTC-{COUNTRY}-{YEAR}-{SEQ4}' → 'NBTC-SA-2026-0047'

CREATE TABLE id_formats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT UNIQUE NOT NULL,
  -- Values: employee, requisition, candidate, transfer, leave, performance, disciplinary, exit
  format_string TEXT NOT NULL,
  -- e.g. 'EMP-{COUNTRY}-{YEAR}-{SEQ4}'
  last_sequence INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default formats — Super Admin can change these any time from the app
INSERT INTO id_formats (entity_type, format_string) VALUES
  ('employee',      'EMP-{YEAR}-{SEQ4}'),
  ('requisition',   'REQ-{COUNTRY}-{SEQ3}'),
  ('candidate',     'CAND-{YEAR}-{SEQ4}'),
  ('transfer',      'TRF-{SEQ4}'),
  ('leave',         'LV-{YEAR}-{SEQ4}'),
  ('performance',   'PR-{YEAR}-{SEQ3}'),
  ('disciplinary',  'DISC-{SEQ4}'),
  ('exit',          'EXIT-{YEAR}-{SEQ3}');

ALTER TABLE id_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read id formats" ON id_formats FOR SELECT USING (true);
CREATE POLICY "Admins manage id formats" ON id_formats FOR ALL
  USING (
    (SELECT role::TEXT FROM profiles WHERE id = auth.uid())
    IN ('super_admin', 'hr_director')
  )
  WITH CHECK (
    (SELECT role::TEXT FROM profiles WHERE id = auth.uid())
    IN ('super_admin', 'hr_director')
  );

-- ─── ID GENERATION FUNCTION ─────────────────────────────────
-- Called from the app API route to generate the next ID.
-- Increments the sequence atomically so two simultaneous
-- inserts never get the same ID.
CREATE OR REPLACE FUNCTION public.generate_next_id(
  p_entity_type TEXT,
  p_country_code TEXT DEFAULT '',
  p_dept_code TEXT DEFAULT ''
)
RETURNS TEXT AS $$
DECLARE
  v_format TEXT;
  v_seq INTEGER;
  v_result TEXT;
BEGIN
  -- Lock the row and increment sequence atomically
  UPDATE id_formats
  SET last_sequence = last_sequence + 1,
      updated_at = NOW()
  WHERE entity_type = p_entity_type
  RETURNING format_string, last_sequence
  INTO v_format, v_seq;

  IF v_format IS NULL THEN
    RETURN p_entity_type || '-' || v_seq;
  END IF;

  v_result := v_format;

  -- Replace tokens
  v_result := REPLACE(v_result, '{YEAR}',    TO_CHAR(NOW(), 'YYYY'));
  v_result := REPLACE(v_result, '{MONTH}',   TO_CHAR(NOW(), 'MM'));
  v_result := REPLACE(v_result, '{COUNTRY}', COALESCE(NULLIF(p_country_code, ''), 'XX'));
  v_result := REPLACE(v_result, '{DEPT}',    COALESCE(NULLIF(p_dept_code, ''), 'GEN'));
  v_result := REPLACE(v_result, '{SEQ3}',    LPAD(v_seq::TEXT, 3, '0'));
  v_result := REPLACE(v_result, '{SEQ4}',    LPAD(v_seq::TEXT, 4, '0'));
  v_result := REPLACE(v_result, '{SEQ5}',    LPAD(v_seq::TEXT, 5, '0'));

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow authenticated users to call the ID generator
GRANT EXECUTE ON FUNCTION public.generate_next_id TO authenticated;

-- ─── DEPARTMENTS: ADD CODE COLUMN (for ID tokens) ───────────
ALTER TABLE departments ADD COLUMN IF NOT EXISTS code TEXT;

-- Fill in codes for existing departments
UPDATE departments SET code = 'ENG'  WHERE name = 'Engineering'          AND code IS NULL;
UPDATE departments SET code = 'HR'   WHERE name = 'Human Resources'      AND code IS NULL;
UPDATE departments SET code = 'OPS'  WHERE name = 'Operations'           AND code IS NULL;
UPDATE departments SET code = 'FIN'  WHERE name = 'Finance'              AND code IS NULL;
UPDATE departments SET code = 'IT'   WHERE name = 'Information Technology' AND code IS NULL;
UPDATE departments SET code = 'PRO'  WHERE name = 'Procurement'          AND code IS NULL;
UPDATE departments SET code = 'HSE'  WHERE name = 'HSE'                  AND code IS NULL;

-- ─── DEPARTMENTS RLS (add write policies, read was already open) ─
CREATE POLICY "Admins insert departments" ON departments FOR INSERT
  WITH CHECK (
    (SELECT role::TEXT FROM profiles WHERE id = auth.uid())
    IN ('super_admin', 'hr_director')
  );
CREATE POLICY "Admins update departments" ON departments FOR UPDATE
  USING (
    (SELECT role::TEXT FROM profiles WHERE id = auth.uid())
    IN ('super_admin', 'hr_director')
  );
CREATE POLICY "Admins delete departments" ON departments FOR DELETE
  USING (
    (SELECT role::TEXT FROM profiles WHERE id = auth.uid())
    IN ('super_admin', 'hr_director')
  );

-- ─── PROFILES: ALLOW ADMINS TO UPDATE ANY PROFILE ───────────
-- Currently profiles can only update their own row.
-- We need admins to be able to change roles and assignments.
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (
    (SELECT role::TEXT FROM profiles p2 WHERE p2.id = auth.uid())
    IN ('super_admin', 'hr_director')
  );

-- Admins need to see all profiles for user management
DROP POLICY IF EXISTS "Users can view all profiles in org" ON profiles;
CREATE POLICY "Everyone can view profiles" ON profiles
  FOR SELECT USING (true);
