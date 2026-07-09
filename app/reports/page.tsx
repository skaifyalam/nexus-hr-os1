import { getShellData } from '@/lib/shellData';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import ReportsClient from './ReportsClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const supabase = createServerClient();
  const { profile, sections, user } = await getShellData();
  const _access = await getFeatureAccess(profile, 'reports');
  if (_access === 'none') redirect('/dashboard');

  const { data: reports } = await supabase
    .from('ai_reports')
    .select('id, title, prompt, report_type, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <Shell current="/reports" profile={profile} sections={sections}>
      <ReportsClient
        initialReports={reports || []}
        companyId={profile?.company_id || ''}
        userEmail={user?.email || ''}
      />
    </Shell>
  );
}
