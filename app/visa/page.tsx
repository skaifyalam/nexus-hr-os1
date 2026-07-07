import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { loadPeopleForPicker } from '@/lib/people';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import VisaClient from './VisaClient';

export default async function VisaPage() {
  const supabase = createServerClient();
  const { profile, sections, user } = await getShellData();
  const _access = await getFeatureAccess(profile, 'visa');
  if (_access === 'none') redirect('/dashboard');
  const companyId = profile?.company_id || '';

  const [{ data: blocks }, { data: allocations }, { data: candFields }] = await Promise.all([
    supabase.from('visa_blocks').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('visa_allocations').select('*').eq('company_id', companyId),
    supabase.from('section_field_configs').select('*').eq('company_id', companyId).eq('section_key', 'candidate').order('display_order'),
  ]);

  // Load candidates + employees for allocation picker (trimmed — fast on large datasets)
  const [{ people: cands }, { people: emps }] = await Promise.all([
    loadPeopleForPicker(companyId, 'candidate'),
    loadPeopleForPicker(companyId, 'employee'),
  ]);
  const people = [...cands, ...emps];

  return (
    <Shell current="/visa" profile={profile} sections={sections} companyId={companyId}>
      <VisaClient initialBlocks={blocks || []} initialAllocations={allocations || []} people={people} candFields={candFields || []} companyId={companyId} />
    </Shell>
  );
}
