'use client';
import { useState } from 'react';
import { Check, Zap, Building2, Rocket, Users, Calendar, CreditCard, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Per-employee monthly pricing — deliberately undercutting BambooHR/Workday.
const PLANS = [
  {
    key: 'starter', name: 'Starter', icon: Zap, price: 2,
    tagline: 'Small teams getting started',
    features: ['Up to 50 employees', 'All core HR modules', 'Excel import & AI setup', 'Leave management', 'Email support'],
    color: 'indigo',
  },
  {
    key: 'growth', name: 'Growth', icon: Rocket, price: 3.5,
    tagline: 'Scaling companies',
    features: ['Unlimited employees', 'Everything in Starter', 'Compliance & localization', 'Delay analytics', 'Multi-company', 'Priority support'],
    color: 'violet', popular: true,
  },
  {
    key: 'enterprise', name: 'Enterprise', icon: Building2, price: 5,
    tagline: 'Large multi-entity groups',
    features: ['Everything in Growth', 'Dedicated onboarding', 'Custom integrations', 'SLA guarantee', 'Account manager'],
    color: 'slate',
  },
];

const CBG: Record<string, string> = {
  indigo: 'bg-indigo-600', violet: 'bg-violet-600', slate: 'bg-slate-800',
};
const CLIGHT: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600', violet: 'bg-violet-50 text-violet-600', slate: 'bg-slate-100 text-slate-700',
};

export default function BillingClient({ subscription, employeeCount, companyId }: {
  subscription: any; employeeCount: number; companyId: string;
}) {
  const [sub, setSub] = useState(subscription);
  const [selecting, setSelecting] = useState<string | null>(null);
  const supabase = createClient();

  const trialDaysLeft = sub?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;

  const billable = Math.max(employeeCount, 1);

  const selectPlan = async (planKey: string) => {
    const plan = PLANS.find(p => p.key === planKey);
    if (!plan) return;
    setSelecting(planKey);
    // For now this records the intended plan. Stripe checkout plugs in here later.
    const { data } = await supabase.from('subscriptions').update({
      plan: planKey,
      price_per_employee: plan.price,
      employee_count: billable,
      status: 'active',
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }).eq('company_id', companyId).select().single();
    if (data) setSub(data);
    setSelecting(null);
  };

  const currentPlan = PLANS.find(p => p.key === sub?.plan);
  const monthlyEstimate = currentPlan ? (currentPlan.price * billable).toFixed(2) : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Billing & Plans</h1>
        <p className="text-sm text-slate-500 mt-0.5">Simple per-employee pricing. No setup fees, no contracts.</p>
      </div>

      {/* Current status */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3"><Users size={17} /></div>
          <p className="text-2xl font-bold text-slate-900">{employeeCount.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Billable employees</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3"><CreditCard size={17} /></div>
          <p className="text-2xl font-bold text-slate-900 capitalize">{sub?.plan || 'Trial'}</p>
          <p className="text-xs text-slate-500 capitalize">{sub?.status || 'trialing'}{monthlyEstimate ? ` · ~$${monthlyEstimate}/mo` : ''}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3"><Calendar size={17} /></div>
          {sub?.status === 'trialing' ? (
            <>
              <p className="text-2xl font-bold text-slate-900">{trialDaysLeft}</p>
              <p className="text-xs text-slate-500">Days left in trial</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-900">{sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
              <p className="text-xs text-slate-500">Next billing date</p>
            </>
          )}
        </div>
      </div>

      {/* Trial banner */}
      {sub?.status === 'trialing' && (
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white mb-6 flex items-center gap-3">
          <Sparkles size={20} />
          <div>
            <p className="text-sm font-semibold">You're on a free trial — {trialDaysLeft} days left</p>
            <p className="text-xs text-white/80">Pick a plan below to keep your workspace active after the trial. You won't be charged until you confirm payment.</p>
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const isCurrent = sub?.plan === plan.key;
          const est = (plan.price * billable).toFixed(0);
          return (
            <div key={plan.key} className={`relative bg-white rounded-2xl border-2 shadow-sm p-6 flex flex-col ${plan.popular ? 'border-violet-300' : 'border-slate-100'}`}>
              {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${CLIGHT[plan.color]}`}><plan.icon size={18} /></div>
              <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
              <p className="text-xs text-slate-500 mb-4">{plan.tagline}</p>
              <div className="mb-1">
                <span className="text-3xl font-bold text-slate-900">${plan.price}</span>
                <span className="text-sm text-slate-400"> /employee/mo</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">≈ ${est}/mo for your {billable} employee{billable !== 1 ? 's' : ''}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <Check size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => selectPlan(plan.key)}
                disabled={isCurrent || selecting === plan.key}
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${isCurrent ? 'bg-emerald-50 text-emerald-700 cursor-default' : `${CBG[plan.color]} text-white hover:opacity-90`}`}
              >
                {isCurrent ? '✓ Current Plan' : selecting === plan.key ? 'Selecting…' : 'Choose ' + plan.name}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-slate-50 rounded-2xl p-5 text-center">
        <p className="text-xs text-slate-500">
          Prices in USD, billed monthly per active employee. Cancel anytime. Payment processing via Stripe will be enabled at checkout —
          selecting a plan here reserves it without charging you yet.
        </p>
      </div>
    </div>
  );
}
