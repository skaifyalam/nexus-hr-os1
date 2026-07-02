import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import AgenciesSettingsClient from './AgenciesSettingsClient';
import { redirect } from 'next/navigation';

export default async function AgenciesSettingsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
  const { data: sections } = await supabase.from('company_sections').select('*').eq('company_id', profile?.company_id).order('sidebar_order');

  if (!profile || !['super_admin', 'hr_director'].includes(profile.role)) redirect('/dashboard');

  const { data: agencies } = await supabase.from('agencies').select('*').order('name');
  const { data: candCounts } = await supabase.from('candidates').select('agency_id');

  return (
    <Shell current="/settings/agencies" profile={profile} sections={sections || []} companyId={profile?.company_id || ''}>
      <AgenciesSettingsClient initialAgencies={agencies || []} candCounts={candCounts || []} />
    </Shell>
  );
}
