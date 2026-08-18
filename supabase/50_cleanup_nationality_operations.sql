-- ============================================================
-- NAIBUS — Clean up nationalities wrongly created as Country Operations
--
-- CAUSE: a "Nationality" column was linked to "country", and the country link
-- entity writes to the `operations` table. So people's nationalities (INDIAN,
-- SAUDI, NEPALESE, …) were auto-created as business Operations.
--
-- `operations` is the COMPANY'S COUNTRY OF OPERATION — it owns projects
-- (projects.operation_id) and carries a country_code. Nationality is a person
-- attribute and belongs in a plain dropdown field, not here.
--
-- SAFETY: this ONLY deletes rows that have NO country_code AND NO projects
-- attached. Real operations (KSA Operation / KWT Operation) are untouched.
-- STEP 1 previews exactly what will go; run it and eyeball the list first.
-- ============================================================

-- ── STEP 1: PREVIEW (run this alone first, delete nothing) ──
SELECT o.id, o.name, o.country_code,
       (SELECT count(*) FROM projects p WHERE p.operation_id = o.id) AS project_count
FROM operations o
WHERE o.country_code IS NULL
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.operation_id = o.id)
ORDER BY o.name;

-- ── STEP 2: DELETE the bogus operations ─────────────────────
-- Only after STEP 1 shows nothing you want to keep.
DELETE FROM operations o
WHERE o.country_code IS NULL
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.operation_id = o.id);

-- ── STEP 3: Remove the mappings that pointed at them ────────
-- These told the importer to rewrite nationality values to those fake
-- operations. Without this, auto-normalize would keep re-applying them.
DELETE FROM entity_mappings
WHERE entity_type = 'country';

-- ── STEP 4: Unlink any Nationality column ───────────────────
-- Nationality stays a normal dropdown field; it just stops being an entity link.
UPDATE section_field_configs
SET links_to = NULL
WHERE links_to = 'country'
  AND field_label ~* '(nationality|citizenship)';

-- ── STEP 5: Verify — should show ONLY real operations ───────
SELECT id, name, country_code,
       (SELECT count(*) FROM projects p WHERE p.operation_id = operations.id) AS project_count
FROM operations
ORDER BY name;
