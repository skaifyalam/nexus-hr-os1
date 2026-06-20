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

- Real login, real database, nothing fake or hardcoded
- Employee Master: add, edit, delete — permanently saved
- Excel bulk import with AI-suggested column matching
- Downloadable Excel template
- **Multi-country structure**: Saudi Arabia and Kuwait are already set up as
  separate operations, with sample KSA projects S.022 Fadhili and S.013 Marjan
- **Country-based access control**: built at the database level. Once you
  invite other HR staff and assign them to a single country (instructions
  below), they will only ever be able to see that country's employees — not
  because the app hides it, but because the database itself won't return it.
  You as Super Admin always see everything.
- **Employee Profile page** (click the eye icon next to any employee): shows
  their current country, project, department, salary — and a full timeline
  of everything that has ever changed about them.
- **Transfer tracking**: click "Initiate Transfer" on an employee's profile to
  move them between countries or projects. This creates a checklist (Medical,
  Biometric, Skill Test, Visa Transfer, Exit/Entry Clearance). The employee
  only actually moves once every checklist item is ticked — and the moment
  they do, it's permanently recorded in their history automatically.
- Audit log recording every create/edit/delete/import in the database

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

- Recruitment pipeline / mobilization tracking (Phase 2) — the database is
  already country-ready for this (`requisitions` and `candidates` tables
  have an `operation_id` column waiting)
- Company Brain / document AI (Phase 3)
- AI Report Studio (Phase 4)
- AI Boardroom (Phase 5)
- Finance module (Phase 6)

Tell me once Phase 1 is live and you've confirmed employees save for real,
Excel import works, and the transfer flow makes sense to you. Then I'll build
Phase 2 — the Recruitment Engine with your exact GCC mobilization stages,
already country- and project-aware from day one.

---

## If Something Goes Wrong

- **Can't log in / "Invalid API key"** → double-check you copied the full
  Supabase anon key with no extra spaces, in Vercel's Environment Variables.
- **AI import says "not configured"** → check `GEMINI_API_KEY` is correctly
  set in Vercel, then in Vercel click **Deployments** → **Redeploy**.
- **You're not Super Admin after signup** → Supabase → Table Editor →
  `profiles` table → find your row → change `role` to `super_admin` manually.
- **Page shows an error after pasting SQL** → make sure you ran all five
  SQL files in the exact order: `schema.sql`, then `02_auth_and_rbac.sql`,
  then `03_multi_country_operations.sql`, then `04_operations_management_policies.sql`,
  then `05_smart_transfer_checklist.sql`. Running them out of order will fail
  because later files depend on tables created in earlier ones.
