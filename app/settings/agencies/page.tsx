import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import AgenciesSettingsClient from './AgenciesSettingsClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AgenciesSettingsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  if (!profile || !['super_admin', 'hr_director'].includes(profile.role)) redirect('/dashboard');

  // Fetch the rest in parallel (was sequential). Scope candidate count to this company.
  const [{ data: sections }, { data: agencies }, { data: candCounts }] = await Promise.all([
    supabase.from('company_sections').select('*').eq('company_id', profile?.company_id).order('sidebar_order'),
    supabase.from('agencies').select('*').eq('company_id', profile?.company_id).order('name'),
    supabase.from('candidates').select('agency_id').eq('company_id', profile?.company_id),
  ]);

  return (
    <Shell current="/settings/agencies" profile={profile} sections={sections || []} companyId={profile?.company_id || ''}>
      <AgenciesSettingsClient initialAgencies={agencies || []} candCounts={candCounts || []} companyId={profile?.company_id || ''} />
    </Shell>
  );
}
