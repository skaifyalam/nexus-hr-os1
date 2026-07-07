import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { loadPeopleForPicker } from '@/lib/people';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import DocumentsClient from './DocumentsClient';

export default async function DocumentsPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  const _access = await getFeatureAccess(profile, 'documents');
  if (_access === 'none') redirect('/dashboard');
  const companyId = profile?.company_id || '';

  const [{ data: docs }, { data: empFields }] = await Promise.all([
    supabase.from('document_records').select('*').eq('company_id', companyId).order('expiry_date', { ascending: true }),
    supabase.from('section_field_configs').select('*').eq('company_id', companyId).eq('section_key', 'employee').order('display_order'),
  ]);

  const { people: employees } = await loadPeopleForPicker(companyId, 'employee');

  return (
    <Shell current="/documents" profile={profile} sections={sections} companyId={companyId}>
      <DocumentsClient initialDocs={docs || []} employees={employees} empFields={empFields || []} companyId={companyId} />
    </Shell>
  );
}
