import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import DashboardClient from './DashboardClient';
import WelcomeGuide from '@/components/WelcomeGuide';

export default async function DashboardPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();

  const [{ data: widgets }, { data: allFields }, { count: recordCount }] = await Promise.all([
    supabase.from('dashboard_widgets').select('*')
      .eq('company_id', profile?.company_id).order('display_order'),
    supabase.from('section_field_configs').select('*')
      .eq('company_id', profile?.company_id).order('display_order'),
    supabase.from('section_records').select('id', { count: 'exact', head: true })
      .eq('company_id', profile?.company_id),
  ]);

  const hasData = (recordCount || 0) > 0;

  return (
    <Shell current="/dashboard" profile={profile} sections={sections} companyId={profile?.company_id || ''}>
      <WelcomeGuide sections={sections || []} hasData={hasData} companyName={profile?.company_name} />
      <DashboardClient
        initialWidgets={widgets || []}
        sections={sections || []}
        allFields={allFields || []}
        companyId={profile?.company_id || ''}
      />
    </Shell>
  );
}
