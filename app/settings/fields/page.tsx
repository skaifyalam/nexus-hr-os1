import { getShellData } from '@/lib/shellData';
import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import FieldsClient from './FieldsClient';
import { redirect } from 'next/navigation';

export default async function FieldsPage() {
  const supabase = createServerClient();
  const { profile, modules, customSections } = await getShellData();
  if (!profile || !['super_admin','hr_director'].includes(profile.role)) redirect('/dashboard');

  const { data: allFields } = await supabase
    .from('section_field_configs').select('*').order('section_key').order('display_order');

  return (
    <Shell current="/settings/fields" profile={profile} modules={modules}
      customSections={customSections} companyId={profile?.company_id || ''}>
      <FieldsClient
        initialFields={allFields || []}
        customSections={customSections}
        companyId={profile?.company_id || ''}
      />
    </Shell>
  );
}
