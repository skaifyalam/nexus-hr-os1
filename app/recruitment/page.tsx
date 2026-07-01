import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import RecruitmentClient from './RecruitmentClient';
import DynamicPipeline from './DynamicPipeline';
import { redirect } from 'next/navigation';

export default async function RecruitmentPage() {
  const supabase = createServerClient();
  const { profile, modules, customSections } = await getShellData();

  if (profile?.role === 'agency_user') redirect('/agency');

  // Load user-defined field config for candidates
  const { data: fieldConfig } = await supabase
    .from('section_field_configs')
    .select('*')
    .eq('company_id', profile?.company_id)
    .eq('section_key', 'candidate')
    .order('display_order');

  const { data: candidates } = await supabase
    .from('candidates')
    .select('*, requisitions(position, requisition_id), operations(name, country_code), agencies(name)')
    .order('created_at', { ascending: false });

  const { data: requisitions } = await supabase.from('requisitions').select('*').in('status', ['open', 'in_progress']);
  const { data: operations } = await supabase.from('operations').select('*');
  const { data: agencies } = await supabase.from('agencies').select('*');

  const hasCustomFields = (fieldConfig || []).length > 0;

  return (
    <Shell current="/recruitment" profile={profile} modules={modules} customSections={customSections} companyId={profile?.company_id || ''}>
      {hasCustomFields ? (
        <DynamicPipeline
          fields={fieldConfig || []}
          initialCandidates={candidates || []}
          companyId={profile?.company_id || ''}
        />
      ) : (
        <RecruitmentClient
          initialCandidates={candidates || []}
          requisitions={requisitions || []}
          operations={operations || []}
          agencies={agencies || []}
        />
      )}
    </Shell>
  );
}
