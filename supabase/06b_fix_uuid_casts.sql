-- ============================================================
-- NEXUS HR — UUID Cast Fix
-- Run this if 06_recruitment_engine.sql failed with:
-- "operator does not exist: uuid = text"
--
-- This replaces both access-control functions with versions
-- that explicitly cast auth.uid() to UUID everywhere.
-- ============================================================

-- Fix the base operation-access function from file 03
CREATE OR REPLACE FUNCTION public.user_can_access_operation(op_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF op_id IS NULL THEN RETURN TRUE; END IF;
  SELECT role::TEXT INTO v_role
  FROM public.profiles
  WHERE id = auth.uid()::UUID;
  IF v_role IN ('super_admin', 'hr_director') THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_operations
    WHERE user_id = auth.uid()::UUID
      AND operation_id = op_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Fix the candidate-access function from file 06
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

  IF v_role IN ('super_admin', 'hr_director') THEN
    RETURN TRUE;
  END IF;

  IF v_role = 'agency_user' THEN
    RETURN (
      cand_agency_id IS NOT NULL
      AND v_agency IS NOT NULL
      AND cand_agency_id = v_agency
    );
  END IF;

  RETURN public.user_can_access_operation(op_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
