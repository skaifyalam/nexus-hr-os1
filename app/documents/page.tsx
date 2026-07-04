import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import DocumentsClient from './DocumentsClient';

export default async function DocumentsPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  const companyId = profile?.company_id || '';

  const [{ data: docs }, { data: empFields }] = await Promise.all([
    supabase.from('document_records').select('*').eq('company_id', companyId).order('expiry_date', { ascending: true }),
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
    <Shell current="/documents" profile={profile} sections={sections} companyId={companyId}>
      <DocumentsClient initialDocs={docs || []} employees={employees} empFields={empFields || []} companyId={companyId} />
    </Shell>
  );
}
