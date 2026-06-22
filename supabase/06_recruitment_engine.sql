-- ============================================================
-- NEXUS HR — Phase 2: Recruitment Engine
-- Run this AFTER 05_smart_transfer_checklist.sql
-- ============================================================

-- ─── AGENCIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  country TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO agencies (name, country, contact_email)
SELECT 'Gulf Manpower Sourcing', 'India', 'ops@gulfmanpower.example'
WHERE NOT EXISTS (SELECT 1 FROM agencies WHERE name = 'Gulf Manpower Sourcing');

-- Add agency_id to profiles (safe — skips if already exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id);

-- Add agency_id to candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id);

-- Update default stage for new candidates
ALTER TABLE candidates ALTER COLUMN stage SET DEFAULT 'selection';

-- ─── CANDIDATE MESSAGES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  sender_name TEXT,
  sender_role TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUTO-LOG: CANDIDATE STAGE HISTORY ──────────────────────
CREATE OR REPLACE FUNCTION public.track_candidate_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.mobilization_stages (candidate_id, stage, status, started_at)
    VALUES (NEW.id, NEW.stage, 'in_progress', NOW());

  ELSIF TG_OP = 'UPDATE' AND (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    UPDATE public.mobilization_stages
    SET status = 'completed', completed_at = NOW()
    WHERE candidate_id = NEW.id
      AND stage = OLD.stage
      AND completed_at IS NULL;

    INSERT INTO public.mobilization_stages (candidate_id, stage, status, started_at)
    VALUES (NEW.id, NEW.stage, 'in_progress', NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_candidate_created ON public.candidates;
CREATE TRIGGER on_candidate_created
  AFTER INSERT ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.track_candidate_stage_change();

DROP TRIGGER IF EXISTS on_candidate_stage_change ON public.candidates;
CREATE TRIGGER on_candidate_stage_change
  AFTER UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.track_candidate_stage_change();

-- ─── CANDIDATE ACCESS FUNCTION ──────────────────────────────
-- Explicit UUID casts throughout to avoid the uuid = text error.
CREATE OR REPLACE FUNCTION public.user_can_access_candidate(
  op_id UUID,
  cand_agency_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_agency UUID;
BEGIN
  SELECT role::TEXT, agency_id::UUID
  INTO v_role, v_agency
  FROM public.profiles
  WHERE id = auth.uid()::UUID;

  -- Super admin and HR director see everything
  IF v_role IN ('super_admin', 'hr_director') THEN
    RETURN TRUE;
  END IF;

  -- Agency users see only their own agency's candidates
  IF v_role = 'agency_user' THEN
    RETURN (
      cand_agency_id IS NOT NULL
      AND v_agency IS NOT NULL
      AND cand_agency_id::UUID = v_agency::UUID
    );
  END IF;

  -- All other HR roles: scoped by country
  RETURN public.user_can_access_operation(op_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── RLS POLICIES ───────────────────────────────────────────
-- Drop old catch-all policies safely before replacing
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable all" ON requisitions;
  DROP POLICY IF EXISTS "Enable all for authenticated" ON requisitions;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Country scoped requisitions" ON requisitions
  FOR ALL USING (public.user_can_access_operation(operation_id::UUID));

DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable all" ON candidates;
  DROP POLICY IF EXISTS "Enable all for authenticated" ON candidates;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Scoped candidate access" ON candidates
  FOR ALL USING (
    public.user_can_access_candidate(operation_id::UUID, agency_id::UUID)
  );

DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable all" ON mobilization_stages;
  DROP POLICY IF EXISTS "Enable all for authenticated" ON mobilization_stages;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE mobilization_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scoped stage history" ON mobilization_stages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = candidate_id
      AND public.user_can_access_candidate(c.operation_id::UUID, c.agency_id::UUID)
    )
  );

DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable all" ON candidate_documents;
  DROP POLICY IF EXISTS "Enable all for authenticated" ON candidate_documents;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE candidate_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scoped candidate documents" ON candidate_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = candidate_id
      AND public.user_can_access_candidate(c.operation_id::UUID, c.agency_id::UUID)
    )
  );

ALTER TABLE candidate_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scoped candidate messages" ON candidate_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = candidate_id
      AND public.user_can_access_candidate(c.operation_id::UUID, c.agency_id::UUID)
    )
  );

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view agencies" ON agencies
  FOR SELECT USING (true);
CREATE POLICY "Admins insert agencies" ON agencies
  FOR INSERT WITH CHECK (
    (SELECT role::TEXT FROM profiles WHERE id = auth.uid()::UUID)
    IN ('super_admin', 'hr_director')
  );
CREATE POLICY "Admins update agencies" ON agencies
  FOR UPDATE USING (
    (SELECT role::TEXT FROM profiles WHERE id = auth.uid()::UUID)
    IN ('super_admin', 'hr_director')
  );
CREATE POLICY "Admins delete agencies" ON agencies
  FOR DELETE USING (
    (SELECT role::TEXT FROM profiles WHERE id = auth.uid()::UUID)
    IN ('super_admin', 'hr_director')
  );
