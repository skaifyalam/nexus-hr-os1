import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { loadPeopleForPicker } from '@/lib/people';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import GrievancesClient from './GrievancesClient';

export const dynamic = 'force-dynamic';

export default async function GrievancesPage() {
  const supabase = createServerClient();
  const { profile, sections, user } = await getShellData();
  const _access = await getFeatureAccess(profile, 'grievances');
  if (_access === 'none') redirect('/dashboard');
  const companyId = profile?.company_id || '';

  const [{ data: grievances }, { people: employees, fields: empFields }] = await Promise.all([
    supabase.from('grievances').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    loadPeopleForPicker(companyId, 'employee'),
  ]);

  return (
    <Shell current="/grievances" profile={profile} sections={sections} companyId={companyId}>
      <GrievancesClient initialGrievances={grievances || []} employees={employees} empFields={empFields} companyId={companyId} userEmail={user?.email || ''} />
    </Shell>
  );
}
