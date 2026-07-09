import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import StructureClient from './StructureClient';

export const dynamic = 'force-dynamic';

export default async function StructurePage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  const _access = await getFeatureAccess(profile, 'structure');
  if (_access === 'none') redirect('/dashboard');
  const companyId = profile?.company_id || '';

  const { data: nodes } = await supabase.from('org_nodes')
    .select('*').eq('company_id', companyId).order('sort_order');

  return (
    <Shell current="/structure" profile={profile} sections={sections} companyId={companyId}>
      <StructureClient initialNodes={nodes || []} companyId={companyId} />
    </Shell>
  );
}
