import { getShellData } from '@/lib/shellData';
import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import FieldsClient from './FieldsClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function FieldsPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  if (!profile || !['super_admin','hr_director'].includes(profile.role)) redirect('/dashboard');

  const { data: allFields } = await supabase
    .from('section_field_configs').select('*').order('section_key').order('display_order');

  // Custom sections = non-core sections for the configurator dropdown
  const customSections = (sections || []).filter((s: any) => !s.is_core).map((s: any) => ({ id: s.section_key, name: s.label }));

  return (
    <Shell current="/settings/fields" profile={profile} sections={sections} companyId={profile?.company_id || ''}>
      <FieldsClient
        initialFields={allFields || []}
        customSections={customSections}
        companyId={profile?.company_id || ''}
      />
    </Shell>
  );
}
