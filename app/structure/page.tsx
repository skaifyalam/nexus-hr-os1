import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import StructureClient from './StructureClient';

export default async function StructurePage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  const companyId = profile?.company_id || '';

  const { data: nodes } = await supabase.from('org_nodes')
    .select('*').eq('company_id', companyId).order('sort_order');

  return (
    <Shell current="/structure" profile={profile} sections={sections} companyId={companyId}>
      <StructureClient initialNodes={nodes || []} companyId={companyId} />
    </Shell>
  );
}
