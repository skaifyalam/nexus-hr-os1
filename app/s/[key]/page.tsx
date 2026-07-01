import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import UniversalSection from './UniversalSection';
import { notFound } from 'next/navigation';

export default async function SectionPage({ params }: { params: { key: string } }) {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();

  // Find the section definition
  const { data: section } = await supabase
    .from('company_sections')
    .select('*')
    .eq('company_id', profile?.company_id)
    .eq('section_key', params.key)
    .single();

  if (!section) notFound();

  // Load field config + records for this section
  const [{ data: fields }, { data: records }] = await Promise.all([
    supabase.from('section_field_configs').select('*')
      .eq('company_id', profile?.company_id).eq('section_key', params.key).order('display_order'),
    supabase.from('section_records').select('*')
      .eq('company_id', profile?.company_id).eq('section_key', params.key)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <Shell current={`/s/${params.key}`} profile={profile} sections={sections} companyId={profile?.company_id || ''}>
      <UniversalSection
        section={section}
        initialFields={fields || []}
        initialRecords={records || []}
        companyId={profile?.company_id || ''}
      />
    </Shell>
  );
}
