-- ============================================================
-- NAIBUS — Username/Password Users (no email required)
-- Admin-created users log in with a username + password instead of email.
-- Under the hood they are real Supabase Auth users with a synthetic
-- internal email (username@companyref.naibus.local) they never see.
-- ============================================================

-- Store the username on the profile so login can map username → synthetic email
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Usernames are GLOBALLY unique (first-come-first-served across all companies),
-- so login by username is always unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_global_idx
  ON profiles (username) WHERE username IS NOT NULL;

-- Mark whether this profile is a username-based (admin-created) user
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_username_user BOOLEAN DEFAULT false;

-- Store the synthetic login email directly so login can resolve username → email
-- with a plain table read (no admin API needed).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_email TEXT;
