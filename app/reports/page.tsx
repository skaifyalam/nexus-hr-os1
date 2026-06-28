import { getShellData } from '@/lib/shellData';
import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const supabase = createServerClient();
  const { profile, modules, customSections, user } = await getShellData();

  const { data: reports } = await supabase
    .from('ai_reports')
    .select('id, title, prompt, report_type, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <Shell current="/reports" profile={profile} modules={modules} customSections={customSections}>
      <ReportsClient
        initialReports={reports || []}
        companyId={profile?.company_id || ''}
        userEmail={user?.email || ''}
      />
    </Shell>
  );
}
