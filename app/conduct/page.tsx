import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { loadPeopleForPicker } from '@/lib/people';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import ConductClient from './ConductClient';

export const dynamic = 'force-dynamic';

export default async function ConductPage() {
  const supabase = createServerClient();
  const { profile, sections, user } = await getShellData();
  const _access = await getFeatureAccess(profile, 'conduct');
  if (_access === 'none') redirect('/dashboard');
  const companyId = profile?.company_id || '';

  const [{ data: conduct }, { data: exits }, { data: empFields }, { data: empSection }] = await Promise.all([
    supabase.from('conduct_records').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('exit_records').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('section_field_configs').select('*').eq('company_id', companyId).eq('section_key', 'employee').order('display_order'),
    supabase.from('company_sections').select('active_field_key, active_values').eq('company_id', companyId).eq('section_key', 'employee').maybeSingle(),
  ]);

  const { people: employees } = await loadPeopleForPicker(companyId, 'employee');

  return (
    <Shell current="/conduct" profile={profile} sections={sections} companyId={companyId}>
      <ConductClient initialConduct={conduct || []} initialExits={exits || []} employees={employees} empFields={empFields || []} activeConfig={empSection || null} companyId={companyId} userEmail={user?.email || ''} />
    </Shell>
  );
}
