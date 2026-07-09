import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import BillingClient from './BillingClient';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  const companyId = profile?.company_id || '';

  // Count billable employees (active employee records)
  const { count: empCount } = await supabase.from('section_records')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('section_key', 'employee');

  let { data: sub } = await supabase.from('subscriptions')
    .select('*').eq('company_id', companyId).single();

  // If no subscription row yet, create a trial
  if (!sub) {
    const { data: created } = await supabase.from('subscriptions').insert({
      company_id: companyId, plan: 'trial', status: 'trialing',
      trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    }).select().single();
    sub = created;
  }

  return (
    <Shell current="/billing" profile={profile} sections={sections} companyId={companyId}>
      <BillingClient subscription={sub} employeeCount={empCount || 0} companyId={companyId} />
    </Shell>
  );
}
