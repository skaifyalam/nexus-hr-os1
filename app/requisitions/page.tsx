import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import RequisitionsClient from './RequisitionsClient';

export const dynamic = 'force-dynamic';

export default async function RequisitionsPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();

  const [{ data: headerFields }, { data: lineFields }, { data: headers }] = await Promise.all([
    supabase.from('section_field_configs').select('*')
      .eq('company_id', profile?.company_id).eq('section_key', 'requisition').order('display_order'),
    supabase.from('section_field_configs').select('*')
      .eq('company_id', profile?.company_id).eq('section_key', 'requisition_line').order('display_order'),
    supabase.from('req_headers').select('*, req_lines(*)')
      .eq('company_id', profile?.company_id).order('created_at', { ascending: false }),
  ]);

  return (
    <Shell current="/requisitions" profile={profile} sections={sections} companyId={profile?.company_id || ''}>
      <RequisitionsClient
        headerFields={headerFields || []}
        lineFields={lineFields || []}
        initialHeaders={headers || []}
        companyId={profile?.company_id || ''}
      />
    </Shell>
  );
}
