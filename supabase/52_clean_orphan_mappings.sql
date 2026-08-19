-- ============================================================
-- NAIBUS — Remove orphaned entity mappings
--
-- CAUSE: deleting an entity (e.g. clearing the projects list) left its rows in
-- entity_mappings behind. Detection treats an already-mapped value as "known",
-- so it silently STOPPED asking to link those values, and counts resolved to
-- ids that no longer exist and showed 0.
--
-- The app is now self-healing (it ignores mappings whose target is gone), but
-- these dead rows should still be cleared out of the table.
--
-- '_field_memory' rows are deliberately excluded — they intentionally have no
-- mapped_id and store deleted-field settings for restore on re-import.
-- ============================================================

-- ── STEP 1: PREVIEW the orphans (run alone first) ──
SELECT em.entity_type, em.excel_value, em.mapped_name, em.mapped_id
FROM entity_mappings em
WHERE em.entity_type <> '_field_memory'
  AND em.mapped_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM agencies      a WHERE a.id = em.mapped_id)
  AND NOT EXISTS (SELECT 1 FROM departments   d WHERE d.id = em.mapped_id)
  AND NOT EXISTS (SELECT 1 FROM operations    o WHERE o.id = em.mapped_id)
  AND NOT EXISTS (SELECT 1 FROM projects      p WHERE p.id = em.mapped_id)
  AND NOT EXISTS (SELECT 1 FROM sub_companies s WHERE s.id = em.mapped_id)
ORDER BY em.entity_type, em.excel_value;

-- ── STEP 2: DELETE them ──
DELETE FROM entity_mappings em
WHERE em.entity_type <> '_field_memory'
  AND em.mapped_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM agencies      a WHERE a.id = em.mapped_id)
  AND NOT EXISTS (SELECT 1 FROM departments   d WHERE d.id = em.mapped_id)
  AND NOT EXISTS (SELECT 1 FROM operations    o WHERE o.id = em.mapped_id)
  AND NOT EXISTS (SELECT 1 FROM projects      p WHERE p.id = em.mapped_id)
  AND NOT EXISTS (SELECT 1 FROM sub_companies s WHERE s.id = em.mapped_id);

-- ── STEP 3: VERIFY — what mappings remain, by type ──
SELECT entity_type, count(*) AS remaining
FROM entity_mappings
GROUP BY entity_type
ORDER BY entity_type;
