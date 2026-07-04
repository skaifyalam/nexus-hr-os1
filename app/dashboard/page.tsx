import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import DashboardClient from './DashboardClient';
import WelcomeGuide from '@/components/WelcomeGuide';

export default async function DashboardPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();

  const [{ data: widgets }, { data: allFields }, { count: recordCount }, { data: pendingLeave }, { data: openReqs }] = await Promise.all([
    supabase.from('dashboard_widgets').select('*')
      .eq('company_id', profile?.company_id).order('display_order'),
    supabase.from('section_field_configs').select('*')
      .eq('company_id', profile?.company_id).order('display_order'),
    supabase.from('section_records').select('id', { count: 'exact', head: true })
      .eq('company_id', profile?.company_id),
    supabase.from('leave_requests').select('id, employee_name, leave_type_name, start_date, days_count')
      .eq('company_id', profile?.company_id).eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
    supabase.from('req_headers').select('id, req_id, status, req_lines(id)')
      .eq('company_id', profile?.company_id).eq('status', 'open').limit(20),
  ]);

  const openReqPositions = (openReqs || []).reduce((s: number, r: any) => s + (r.req_lines?.length || 0), 0);
  const actions = {
    pendingLeave: pendingLeave || [],
    openReqCount: (openReqs || []).length,
    openReqPositions,
  };

  const hasData = (recordCount || 0) > 0;

  return (
    <Shell current="/dashboard" profile={profile} sections={sections} companyId={profile?.company_id || ''}>
      <WelcomeGuide sections={sections || []} hasData={hasData} companyName={profile?.company_name} />
      <DashboardClient
        initialWidgets={widgets || []}
        sections={sections || []}
        allFields={allFields || []}
        actions={actions}
        companyId={profile?.company_id || ''}
      />
    </Shell>
  );
}
