-- ============================================================
-- NEXUS HR — Smarter Transfer Checklist
-- Run this AFTER 04_operations_management_policies.sql
-- ============================================================
-- A same-country project move (e.g. Marjan → Fadhili, both in KSA)
-- doesn't need Medical, Biometric, or Visa steps — those only apply
-- when actually entering a new country. This updates the checklist
-- generator to give the right list depending on the type of move.

CREATE OR REPLACE FUNCTION public.create_default_transfer_checklist()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.from_operation_id = NEW.to_operation_id THEN
    -- Same-country project transfer — lighter checklist
    INSERT INTO public.transfer_checklist (transfer_request_id, stage) VALUES
      (NEW.id, 'Skill Test / Re-certification'),
      (NEW.id, 'Exit Clearance — Origin Project'),
      (NEW.id, 'Entry Processing — Destination Project');
  ELSE
    -- Cross-country transfer — full legal/medical checklist
    INSERT INTO public.transfer_checklist (transfer_request_id, stage) VALUES
      (NEW.id, 'Medical Examination'),
      (NEW.id, 'Biometric Enrollment'),
      (NEW.id, 'Skill Test / Re-certification'),
      (NEW.id, 'Visa / Iqama Transfer Processing'),
      (NEW.id, 'Exit Clearance — Origin Project'),
      (NEW.id, 'Entry Processing — Destination Project');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- No need to recreate the trigger — it already points to this function
-- by name, so replacing the function updates its behavior immediately
-- for all future transfers.
