import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();

  const [{ data: widgets }, { data: allFields }] = await Promise.all([
    supabase.from('dashboard_widgets').select('*')
      .eq('company_id', profile?.company_id).order('display_order'),
    supabase.from('section_field_configs').select('*')
      .eq('company_id', profile?.company_id).order('display_order'),
  ]);

  return (
    <Shell current="/dashboard" profile={profile} sections={sections} companyId={profile?.company_id || ''}>
      <DashboardClient
        initialWidgets={widgets || []}
        sections={sections || []}
        allFields={allFields || []}
        companyId={profile?.company_id || ''}
      />
    </Shell>
  );
}
