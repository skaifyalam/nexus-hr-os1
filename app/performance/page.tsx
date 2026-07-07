import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { loadPeopleForPicker } from '@/lib/people';
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

  const { people: employees } = await loadPeopleForPicker(companyId, 'employee');

  return (
    <Shell current="/performance" profile={profile} sections={sections} companyId={companyId}>
      <PerformanceClient initialReviews={reviews || []} employees={employees} empFields={empFields || []} companyId={companyId} userEmail={user?.email || ''} />
    </Shell>
  );
}
