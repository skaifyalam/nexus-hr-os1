import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import PerformanceClient from './PerformanceClient';

export default async function PerformancePage() {
  const supabase = createServerClient();
  const { profile, sections, user } = await getShellData();
  const _access = await getFeatureAccess(profile, 'performance');
  if (_access === 'none') redirect('/dashboard');
  const companyId = profile?.company_id || '';

  const [{ data: reviews }, { data: empFields }] = await Promise.all([
    supabase.from('performance_reviews').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('section_field_configs').select('*').eq('company_id', companyId).eq('section_key', 'employee').order('display_order'),
  ]);

  let employees: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('section_records').select('id, record_id, data')
      .eq('company_id', companyId).eq('section_key', 'employee').range(from, from + 999);
    if (!data || data.length === 0) break;
    employees = employees.concat(data);
    if (data.length < 1000) break;
  }

  return (
    <Shell current="/performance" profile={profile} sections={sections} companyId={companyId}>
      <PerformanceClient initialReviews={reviews || []} employees={employees} empFields={empFields || []} companyId={companyId} userEmail={user?.email || ''} />
    </Shell>
  );
}
