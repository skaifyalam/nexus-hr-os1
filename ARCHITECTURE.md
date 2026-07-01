# NEXUS HR — Core Architecture (DEFINITIVE)

## Product Vision
A blank, intelligent, multi-tenant HR platform. ANY company subscribes,
uploads their own files, and AI builds their workspace. No two companies
see the same app. Nothing is hardcoded to any specific company.

## The Universal Section Engine
EVERY section — Employees, Recruitment, and any custom section — uses the
SAME engine. There is no structural difference between a "built-in" and a
"custom" section. All of them:

1. Store their field definitions in `section_field_configs`
2. Store their actual records in a flexible JSONB `data` column
3. Are configured by uploading an Excel (AI detects fields) OR manually
4. Render their table, form, dropdowns, and ID format purely from config
5. Export back to the user's exact uploaded template format

## Onboarding Flow ("Pick Sections, Then Fill Each")
1. Company basics (name, industry, size, countries)
2. "What do you manage?" — pick core + optional + custom sections
3. Land in workspace — each section empty, showing "Upload your Excel →"
4. Open a section → upload file → AI builds it → data loads
5. Repeat per section, each independent

## Universal Records Table
All section data lives in ONE pattern:
- `section_records` table: { id, company_id, section_key, record_id, data JSONB, created_at, updated_at }
- section_key = 'employee' | 'candidate' | custom section UUID
- data = { field_key: value, ... } matching that section's field config

## AI Detection (works on ANY structure)
Given uploaded headers + sample rows, AI detects per column:
- is it an ID field? → suggest format
- is it a status/stage? → drives kanban/pipeline view
- is it a dropdown? → extract unique options
- type: text/number/date/email/phone/boolean/dropdown

## What Must NEVER Happen
- No hardcoded column names (no assuming "Status" or "Name" exists)
- No GCC-specific stages baked in as universal
- No company-specific structure anywhere in code
- Every company bends every section freely
