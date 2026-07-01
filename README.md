# NEXUS HR — Setup Guide (No Coding Required)

You will only ever do two things in this guide: **paste text into a box and click a
button**, or **drag files into a website**. You never write code. Follow every step
in order — don't skip ahead.

---

## WHAT GOES WHERE (read this first)

This package has two different kinds of files. They go to two different places:

| File type | Where it goes | How |
|---|---|---|
| The 3 files inside the `supabase` folder (`.sql` files) | **Supabase** website | Copy the text inside them and **paste** into a box on the Supabase website. You never upload these files anywhere. |
| Everything else (the `app`, `lib`, `components` folders, `package.json`, etc.) | **GitHub**, then **Vercel** | You **upload/drag** these files as-is. You never open or edit them. |

That's the whole confusion last time — some things get pasted, some things get
uploaded. Now let's go step by step.

---

## STEP 1 — Build Your Database (Supabase)

1. Go to **supabase.com** → open your project.
2. On the left-hand menu, click **SQL Editor**.
3. Click the **New Query** button.
4. On your computer, open the file `supabase/schema.sql` from this package
   using Notepad, TextEdit, or by opening it on GitHub — anything that shows
   you plain text.
5. Select all the text in that file (Ctrl+A or Cmd+A) and copy it (Ctrl+C or Cmd+C).
6. Go back to the Supabase SQL Editor box and paste it in (Ctrl+V or Cmd+V).
7. Click the **Run** button (bottom right, or Ctrl+Enter). You should see a
   green "Success" message.
8. Click **New Query** again (top of the SQL Editor).
9. Open `supabase/02_auth_and_rbac.sql`, copy all its text, paste it in, click **Run**.
10. Click **New Query** one more time.
11. Open `supabase/03_multi_country_operations.sql`, copy all its text, paste it in, click **Run**.
12. Click **New Query** one final time.
13. Open `supabase/04_operations_management_policies.sql`, copy all its text, paste it in, click **Run**.
14. Click **New Query** once more.
15. Open `supabase/05_smart_transfer_checklist.sql`, copy all its text, paste it in, click **Run**.
16. Click **New Query** one final time.
17. Open `supabase/06_recruitment_engine.sql` — run each of the 8 blocks separately as described in the troubleshooting notes below if it fails as one file.
18. Click **New Query**.
19. Open `supabase/07_settings_and_id_engine.sql`, copy all its text, paste it in, click **Run**.

You have now created your entire database: employees, countries, projects,
recruitment, leave, performance, and the transfer-tracking system — all in one go.

### Copy your Supabase keys (you'll need these in Step 3)
1. Still in Supabase, click **Settings** (gear icon, bottom left) → **API**.
2. You'll see two values — keep this page open or copy both into a notes app:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (a long string of letters and numbers)

---

## STEP 2 — Get Your Free AI Key (Google Gemini)

1. Go to **aistudio.google.com**.
2. Sign in with any Google account.
3. Click **Get API Key** → **Create API Key**.
4. Copy the key that appears — keep it in your notes app too.

This is completely free, no credit card needed. The only AI feature right now
(Excel column matching when you bulk-import employees) sends only column
names like "Emp Name" or "DOB" to Google — never real employee data — so this
is safe to use on the free tier.

---

## STEP 3 — Put the Code on GitHub

1. Go to **github.com** and open your repository (or click **New** to create one
   if you don't have one yet — name it anything, e.g. `nexus-hr-os`).
2. Inside the repository, click **Add file** → **Upload files**.
3. On your computer, open the unzipped `nexus-hr` folder.
4. Select everything inside it (all folders and files) and **drag them all**
   into the GitHub upload box at once. GitHub will keep the folder structure
   automatically — you don't need to create folders yourself.
5. Scroll down and click the green **Commit changes** button.

Do not upload `.env.local.example` with real keys typed into it — leave that
file exactly as it is. Your real keys go into Vercel directly in the next step.

---

## STEP 4 — Make It Live (Vercel)

1. Go to **vercel.com** → click **Add New** → **Project**.
2. Find your `nexus-hr-os` repository in the list and click **Import**.
3. Before clicking the final Deploy button, look for **Environment Variables**
   on the same screen. Add these three, one at a time — type the Name exactly
   as shown, then paste the Value you saved earlier:

   | Name (type exactly) | Value (paste from your notes) |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon public key |
   | `GEMINI_API_KEY` | your Gemini API key |

4. Click **Deploy**.
5. Wait about 1-2 minutes. When it's done, you'll see a **Visit** button —
   that's your live, working app, at an address like `nexus-hr-os.vercel.app`.

---

## STEP 5 — Create Your Account

1. Open your live link from Step 4.
2. Click **Create one**, enter your name, your email, and a password.
3. Check your email inbox for a confirmation link from Supabase and click it.
4. Go back to the app and log in.

**You are automatically made Super Admin** — the system gives that role to
whoever signs up first. You don't need to set anything manually.

---

## What's Working Right Now

**Phase 1 — Core HR**
- Real login, real database, nothing fake or hardcoded
- Employee Master: add, edit, delete — permanently saved
- Excel bulk import with AI-suggested column matching
- Multi-country structure with database-level access control
- Employee Profile with full history timeline
- Transfer tracking (cross-country and same-country project moves) with checklist
- Countries & Projects management screen (Admin)
- Audit log recording every create/edit/delete/import

**Phase 2.5 — Admin Settings (Zero Supabase Dependency)**
- Departments: add, edit, delete from inside the app — with department codes used in ID formats
- Agencies: full management from inside the app — name, country, contact, status
- User Management (Super Admin only): see all signed-up users, assign roles, assign country access, assign to agency — no SQL ever again
- ID Format Engine (Super Admin only): define the format of every auto-generated ID in the system using tokens like {YEAR}, {COUNTRY}, {DEPT}, {SEQ4} — with a live preview before saving. Applies to Employee IDs, Requisition IDs, Candidate IDs, Transfer IDs, and more.
- Manpower Requisitions: real CRUD, country-aware, AI job description generator
- Recruitment Pipeline (Company HR view): Kanban across all 13 real GCC mobilization
  stages — Selection → Offer Issued → Offer Accepted → Visa Pending → Visa Allocated
  → Medical → Biometric → Skill Test → Visa Stamping (ECR/ECNR) → Visa Stamped →
  Ticket Booked → Mobilized → Onboarded
- Agency Pipeline: a separate portal for overseas agencies, automatically restricted
  to only their own candidates — they cannot see another agency's people, or
  candidates outside their access, even by guessing a link
- Candidate Profile: document checklist (CV, Passport, Medical, Police Clearance,
  Visa), full mobilization history timeline (auto-logged, same philosophy as
  employee transfers), and a two-way communication log between Agency and Company HR
- Tracked throughout by Candidate ID and Passport Number, exactly as specified

## A Correction From Earlier

The sidebar previously showed "Leave" and "Compliance" links — these were
placeholders that didn't actually have real pages behind them yet (an oversight
on my part). I've removed them from the menu for now rather than leave broken
links. They'll return, fully real, in a later phase — just wanted to be upfront
that nothing was secretly broken on your end.

## How to Set Up an Agency

1. Have the agency contact sign up normally on your live app (they'll default
   to "employee" role, seeing nothing yet)
2. In Supabase → **Table Editor** → `agencies` table → add a new row with
   their agency's name (or use the sample "Gulf Manpower Sourcing" row already there)
3. In Supabase → **Table Editor** → `profiles` table → find their row →
   set `role` to `agency_user` and `agency_id` to the agency's row ID (copy
   it from the `agencies` table)
4. They refresh the app — they now see only their own agency's candidates,
   automatically, in the "Agency Pipeline" screen

## Managing Countries & Projects (No SQL — It's a Real Screen Now)

As Super Admin, you'll see a **Countries & Projects** link in the sidebar
under "Admin" (only admins see this). There you can:

- Add a new country any time (e.g. Qatar, UAE) — just type the name and click Add
- Add a new project under any country (e.g. a new Aramco project code)
- Edit or delete either — the app will stop you if employees are still
  assigned to something you're trying to delete, so you can't break data by accident

Saudi Arabia, Kuwait, and the sample projects (S.022 Fadhili, S.013 Marjan)
were just a starting example — add or remove as many as your real operations need.

## How to Give Someone Access to Only One Country

Right now you're the only user, so this doesn't matter yet. When you invite
a Kuwait-based HR person later:

1. They sign up normally on your live app (they'll default to "employee" role,
   seeing nothing yet).
2. In Supabase → **Table Editor** → `profiles` table, find their row and
   change `role` to `hr_manager`.
3. In Supabase → **SQL Editor**, run this (replace the email):
   ```sql
   INSERT INTO user_operations (user_id, operation_id)
   SELECT id, (SELECT id FROM operations WHERE country_code = 'KW')
   FROM auth.users WHERE email = 'their-email@company.com';
   ```
4. They refresh the app — they now see only Kuwait employees.

(A point-and-click screen for assigning *people* to countries — not just
managing the countries themselves — is coming in a later phase. For now,
this is the real, working mechanism underneath it.)

## What's NOT Built Yet (by design — see roadmap)

- Leave Management, Performance Reviews, Disciplinary, Exit Management (Phase 2.5)
- Company Brain / document AI (Phase 3)
- AI Report Studio (Phase 4)
- AI Boardroom (Phase 5)
- Finance module (Phase 6)

Tell me once this is live and you've tested adding a requisition, moving a
candidate through a few stages, and trying the Agency portal with a second
test account. Then I'll build the next phase.

---

## If Something Goes Wrong

- **Can't log in / "Invalid path specified in request URL"** → almost always
  means `NEXT_PUBLIC_SUPABASE_URL` has something extra after `.supabase.co`
  (like `/rest/v1`) or is missing/blank. It should be exactly the bare domain,
  nothing after `.co`.
- **AI features say "not configured"** → check `GEMINI_API_KEY` is correctly
  set in Vercel, then in Vercel click **Deployments** → **Redeploy**.
- **You're not Super Admin after signup** → Supabase → Table Editor →
  `profiles` table → find your row → change `role` to `super_admin` manually.
- **Page shows an error after pasting SQL** → make sure you ran all six
  SQL files in the exact order: `schema.sql`, `02_auth_and_rbac.sql`,
  `03_multi_country_operations.sql`, `04_operations_management_policies.sql`,
  `05_smart_transfer_checklist.sql`, `06_recruitment_engine.sql`. Running them
  out of order will fail because later files depend on tables created earlier.

## Phase 4.5 — Customization Update

### New SQL to run (Supabase → SQL Editor → New Query, run in order):
1. `supabase/11_user_defined_fields.sql`

### New Vercel Environment Variable Required
The "Invite User" feature needs admin access to Supabase Auth:
- Name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: Supabase → Settings → API → `service_role` key (keep this secret, never expose to client)

### What's New
- **Field Configurator** (sidebar → Admin → Field Configurator): Upload an Excel
  template or add fields manually for Employees, Recruitment, or any custom
  section. AI detects field types, dropdown options, and ID patterns automatically
  from your uploaded file — no predefined columns anymore.
- **Multi-format report export**: AI Reports can now be downloaded as Excel (.csv),
  Word (.doc), PowerPoint-ready HTML slides, or plain text — not just .txt.
- **Add Section fix**: The sidebar "+ Add Section" button now works correctly
  (previously failed silently due to a missing company ID).

### Still To Build (told to user, in progress)
- Dashboard customizable widget picker (add/remove cards)
- AI auto-populated dropdowns reflected live in Admin Panel after upload
- Bulk requisition entry (one REQ ID, multiple position line items)
- Section data export in original uploaded template format
