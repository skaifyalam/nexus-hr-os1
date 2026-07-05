import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { getConfidentialFields } from '@/lib/permissions';
import Shell from '@/components/Shell';
import UniversalSection from './UniversalSection';
import { notFound } from 'next/navigation';

export default async function SectionPage({ params }: { params: { key: string } }) {
  const supabase = createServerClient();
  const { profile, sections, user } = await getShellData();

  const { data: section } = await supabase
    .from('company_sections')
    .select('*')
    .eq('company_id', profile?.company_id)
    .eq('section_key', params.key)
    .single();

  if (!section) notFound();

  const [{ data: fields }, { data: stageFlows }] = await Promise.all([
    supabase.from('section_field_configs').select('*')
      .eq('company_id', profile?.company_id).eq('section_key', params.key).order('display_order'),
    supabase.from('stage_flows').select('*')
      .eq('company_id', profile?.company_id).eq('section_key', params.key),
  ]);

  // Batched fetch — Supabase caps at 1000 rows per query, so loop until all loaded
  let records: any[] = [];
  const CHUNK = 1000;
  for (let from = 0; ; from += CHUNK) {
    const { data: batch } = await supabase.from('section_records').select('*')
      .eq('company_id', profile?.company_id).eq('section_key', params.key)
      .order('created_at', { ascending: false })
      .range(from, from + CHUNK - 1);
    if (!batch || batch.length === 0) break;
    records = records.concat(batch);
    if (batch.length < CHUNK) break;
  }

  // Confidential-field enforcement: strip fields this role may not see
  const confidential = await getConfidentialFields(profile);
  const visibleFields = (fields || []).filter((f: any) => !confidential.includes(f.field_key));
  const safeRecords = confidential.length === 0 ? records : records.map((r: any) => {
    const d = { ...(r.data || {}) };
    confidential.forEach(k => { delete d[k]; });
    return { ...r, data: d };
  });

  return (
    <Shell current={`/s/${params.key}`} profile={profile} sections={sections} companyId={profile?.company_id || ''}>
      <UniversalSection
        section={section}
        initialFields={visibleFields}
        initialRecords={safeRecords}
        initialStageFlows={stageFlows || []}
        companyId={profile?.company_id || ''}
        userEmail={user?.email || ''}
      />
    </Shell>
  );
}
