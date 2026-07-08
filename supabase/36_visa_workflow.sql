-- ============================================================
-- NEXUS HR — Visa Workflow (Layer 1: status spine). Self-healing.
-- Run AFTER 35_grievances.sql
-- Extends visa_allocations with the real Saudi workflow:
-- allocate → ewakala pending → ewakala issued → passport submitted → stamped
-- Over-allocation is allowed (more candidates than visas); first to stamp wins.
-- ============================================================

-- Agency + type on each allocation
ALTER TABLE visa_allocations ADD COLUMN IF NOT EXISTS agency_id UUID;
ALTER TABLE visa_allocations ADD COLUMN IF NOT EXISTS agency_name TEXT;
ALTER TABLE visa_allocations ADD COLUMN IF NOT EXISTS visa_type TEXT;

-- Workflow stage (replaces the simple allocated|used|cancelled meaning)
-- stage: allocated | ewakala_pending | ewakala_issued | passport_submitted | stamped | missed | cancelled
ALTER TABLE visa_allocations ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'allocated';

-- Two-stage completion dates
ALTER TABLE visa_allocations ADD COLUMN IF NOT EXISTS ewakala_issued_date DATE;
ALTER TABLE visa_allocations ADD COLUMN IF NOT EXISTS passport_submitted_date DATE;
ALTER TABLE visa_allocations ADD COLUMN IF NOT EXISTS stamped_date DATE;

-- Which block this pertains to already exists (visa_block_id).
-- Backfill stage from old status where possible
UPDATE visa_allocations SET stage = 'stamped' WHERE status = 'used' AND (stage IS NULL OR stage = 'allocated');
UPDATE visa_allocations SET stage = 'cancelled' WHERE status = 'cancelled' AND (stage IS NULL OR stage = 'allocated');
