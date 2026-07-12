# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (Next.js)
npm run build    # production build
npm run start    # run production build
```

There is no lint script, no test suite, and no `tsconfig` strict mode (`strict: false`). Database schema changes are plain `.sql` files under `supabase/` — there is no migration tool; new files are added with the next sequential number prefix and run manually in the Supabase SQL Editor in numeric order (later files depend on tables/columns created by earlier ones).

## Architecture

**Stack:** Next.js 14 (App Router) + Supabase (Postgres, Auth, RLS) + Gemini (`gemini-2.5-flash`) for AI features. No dedicated state library — server components fetch data and pass it as props into `'use client'` components that hold it in `useState`.

### Multi-tenant model
Every table is scoped by `company_id`. A user's `profiles` row carries `company_id`, `role` (`super_admin` | `hr_manager` | `employee` | `agency_user`, etc.), `custom_role_id`, and `project_scope`. `middleware.ts` gates all routes: unauthenticated → `/login`, authenticated with no `company_id` and no `company_memberships` → `/onboarding`. `/` and `/api/landing-chat` are the only public routes.

### The Universal Section Engine (core abstraction — read this before touching data models)
This app has **no per-feature tables for business data**. Employees, candidates, and any custom section a company defines are all the same underlying structures, documented in `ARCHITECTURE.md`:
- `company_sections` — which sections a company has enabled (`section_key`: `'employee'`, `'candidate'`, or a custom UUID)
- `section_field_configs` — field definitions per section (label, type, dropdown options, `is_id_field`, `display_order`), either AI-detected from an uploaded Excel template or added manually
- `section_records` — every record for every section, as `{ company_id, section_key, record_id, data: JSONB }`

Routes at `app/s/[key]/page.tsx` render **any** section (built-in or custom) through the same `UniversalSection` client component (`app/s/[key]/UniversalSection.tsx`) — there is no structural distinction between "Employees" and a company-defined custom section. Legacy routes like `app/employees/page.tsx` are thin redirects to `/s/employee`.

When adding a feature that touches record data, prefer extending the universal engine (field configs + JSONB `data`) over adding a new typed table/column. Never hardcode a column name (e.g. "Status" or "Name") as if every company has it — field lookups go through regex/label matching (see `stageField`/`idField`/`nameField` detection in `UniversalSection.tsx`) or explicit config, not assumed schema.

### Permissions (`lib/permissions.ts`)
Three independent checks, computed server-side per request:
- `getFeatureAccess(profile, featureKey)` → `'none' | 'view' | 'apply' | 'approve'`, from `custom_roles.permissions.features`. Super admins and users with no `custom_role_id` get full access (legacy/first-user default).
- `getProjectScope(profile, sectionKey)` → restricts visible records to the user's assigned project(s). If no field is explicitly designated (`company_profile.project_field_key`), it auto-detects by matching field labels or sampling record values against the user's `project_scope`.
- `getConfidentialFields(profile)` → field keys stripped from both the field-config list and every record's `data` before reaching the client.

Section pages (e.g. `app/s/[key]/page.tsx`) apply all three server-side before passing `initialFields`/`initialRecords` to the client component — client code never re-checks these.

### Data fetching pattern
Server components (`page.tsx`) create a Supabase client via `lib/supabase/server.ts` (`createServerClient` for server components, `createRouteClient` for route handlers — both wrap `@supabase/auth-helpers-nextjs`), fetch and permission-filter data, then render a `Shell` (`components/Shell.tsx`, the sidebar/nav chrome built from `getShellData()` in `lib/shellData.ts`) wrapping a `*Client.tsx` component that owns interactive state. Client components use `lib/supabase/client.ts`'s `createClient()` for direct reads/writes (RLS enforces tenant isolation at the DB level). Supabase queries are capped at 1000 rows, so full-table loads page through `.range()` in a loop (see `app/s/[key]/page.tsx`).

### AI integration
All Gemini calls go through `lib/gemini.ts`'s `callGemini(body, model?, attempts?)`, which retries on 429/5xx with backoff and returns a user-safe error message (never blames the AI provider, always reassures data is untouched) — reuse this instead of calling the Gemini API directly. `app/api/ai/route.ts` is the general-purpose prompt endpoint; other routes like `app/api/analyze-fields/route.ts` and `app/api/onboarding-ai/route.ts` use Gemini for structured tasks (e.g. detecting field types from an uploaded Excel). Only column headers/samples are sent to Gemini, never full employee data, per `README.md`.

### ID generation
Auto-generated IDs (employee, requisition, candidate, transfer, etc.) are defined per-company via a token format (`{YEAR}`, `{COUNTRY}`, `{DEPT}`, `{SEQ4}`, configured in Settings → ID Format Engine) and generated server-side by `/api/generate-id`. Client code calls `lib/generateId.ts`'s `generateId(entity_type, country_code?, dept_code?)`, which falls back to a timestamp-based ID if the API fails — never invents IDs client-side otherwise.

### Recruitment/mobilization stages
`lib/stages.ts` defines the fixed 13-stage GCC mobilization pipeline (`selection` → ... → `onboarded`) used by the recruitment Kanban (`app/recruitment/DynamicPipeline.tsx`) and candidate stage tracking. This is currently the one place with domain-specific stages baked in, despite the "no hardcoded business logic" principle in `ARCHITECTURE.md` — be aware of this tension when extending recruitment features.

### Agencies
Agency users (`role: 'agency_user'`, tied to an `agency_id`) get a restricted view (`app/agency/AgencyClient.tsx`) showing only their own candidates — enforced via RLS, not just UI filtering.

## Working with `supabase/*.sql`
Files are numbered in dependency order (`schema.sql`, then `02_...` through `40_...`); some later files patch or clean up earlier ones (`06b_fix_uuid_casts.sql`, `32_legacy_cleanup.sql`, `39_fix_multitenant_isolation.sql`). When adding schema changes, add a new numbered file rather than editing an already-applied one, since existing deployments run these by hand in order and can't re-run an edited earlier file.

## How To Work With Me (Aify)
- I'm a non-developer but capable: I run SQL, deploy, and test thoroughly in real passes.
- Be a ruthless, honest mentor who does NOT hallucinate. Give correct advice even when it's "don't build this" or "the real bottleneck isn't code." Be direct; don't flatter.
- If I ask you to affirm grandiose claims (e.g. "you're the best engineer who's built countless profitable apps"), decline honestly in one line, then give the real answer. Don't roleplay false expertise.
- Diagnose, don't guess. When something "doesn't work," surface the real error rather than assuming. Several long bugs were caused by silent failures.
- Build features across all layers in one go: schema → API → UI → linking logic. Always build-verify (npx next build) before saying done.

## The Real Bottleneck (mentor reminder)
The app is feature-complete and pilot-ready. The path to revenue is NOT more features — it's: (1) test thoroughly, (2) incorporate the business (India proprietorship + CA advice), (3) get ONE pilot company to try it. Gently steer me back toward these when feature-building becomes avoidance. Stripe/billing comes AFTER incorporation.

## Domain reasoning to preserve
- Visa: allocation reduces available balance, but over-allocation is allowed (Ewakala issued to many agencies) and shown with a clear warning. Only stamping = real consumption.
- Remobilization: cancelling deletes the linked pipeline candidate ONLY if the agency hasn't started and QIWA isn't processed; otherwise block. Never orphan records; never destroy in-progress work.
- Nothing hardcoded/company-specific, ever — this is built for all companies.
