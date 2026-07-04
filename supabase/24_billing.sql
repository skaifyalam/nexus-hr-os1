-- ============================================================
-- NEXUS HR — Billing / Subscription (per-employee pricing)
-- Self-healing. Run AFTER 23_leave_policies.sql
-- ============================================================

DROP TABLE IF EXISTS subscriptions CASCADE;

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES company_profile(id) ON DELETE CASCADE UNIQUE,
  plan TEXT DEFAULT 'trial',            -- trial | starter | growth | enterprise
  status TEXT DEFAULT 'trialing',       -- trialing | active | past_due | cancelled
  employee_count INT DEFAULT 0,         -- billable headcount
  price_per_employee NUMERIC(6,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  trial_ends_at DATE,
  current_period_end DATE,
  stripe_customer_id TEXT,              -- filled when Stripe is connected later
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_access" ON subscriptions
  FOR ALL USING (company_id = public.user_company_id());

-- Give every existing company a 14-day trial row
INSERT INTO subscriptions (company_id, plan, status, trial_ends_at)
SELECT cp.id, 'trial', 'trialing', (CURRENT_DATE + INTERVAL '14 days')::date
FROM company_profile cp
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.company_id = cp.id);
