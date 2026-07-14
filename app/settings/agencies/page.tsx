import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import AgenciesSettingsClient from './AgenciesSettingsClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AgenciesSettingsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  if (!profile || !['super_admin', 'hr_director'].includes(profile.role)) redirect('/dashboard');

  const companyId = profile?.company_id;

  const [
    { data: sections },
    { data: agencies },
    { data: candFields },
    { data: empFields },
    { data: mappings },
  ] = await Promise.all([
    supabase.from('company_sections').select('*').eq('company_id', companyId).order('sidebar_order'),
    supabase.from('agencies').select('*').eq('company_id', companyId).order('name'),
    supabase.from('section_field_configs').select('field_key, links_to').eq('company_id', companyId).eq('section_key', 'candidate'),
    supabase.from('section_field_configs').select('field_key, links_to').eq('company_id', companyId).eq('section_key', 'employee'),
    supabase.from('entity_mappings').select('excel_value, mapped_id').eq('company_id', companyId).eq('entity_type', 'agency'),
  ]);

  // Build a value → agency_id resolver (by agency name, and by saved mapping).
  const resolver: Record<string, string> = {};
  (agencies || []).forEach((a: any) => { resolver[String(a.name).trim().toLowerCase()] = a.id; });
  (mappings || []).forEach((m: any) => { if (m.mapped_id) resolver[String(m.excel_value).trim().toLowerCase()] = m.mapped_id; });

  // Helper: count records in a section per agency, using that section's agency-linked field.
  const countSection = async (sectionKey: string, fieldConfigs: any[], target: Record<string, number>) => {
    const agencyField = (fieldConfigs || []).find((f: any) => f.links_to === 'agency');
    if (!agencyField) return;
    let from = 0;
    for (;;) {
      const { data: recs } = await supabase.from('section_records')
        .select('data').eq('company_id', companyId).eq('section_key', sectionKey)
        .range(from, from + 999);
      if (!recs || recs.length === 0) break;
      recs.forEach((r: any) => {
        const v = r.data?.[agencyField.field_key];
        if (!v) return;
        const id = resolver[String(v).trim().toLowerCase()];
        if (id && target[id] !== undefined) target[id]++;
      });
      if (recs.length < 1000) break;
      from += 1000;
    }
  };

  // Active = candidates in the recruitment pipeline. History = joined employees.
  const activeCounts: Record<string, number> = {};
  const historyCounts: Record<string, number> = {};
  (agencies || []).forEach((a: any) => { activeCounts[a.id] = 0; historyCounts[a.id] = 0; });

  await countSection('candidate', candFields || [], activeCounts);
  await countSection('employee', empFields || [], historyCounts);

  return (
    <Shell current="/settings/agencies" profile={profile} sections={sections || []} companyId={companyId || ''}>
      <AgenciesSettingsClient
        initialAgencies={agencies || []}
        activeCounts={activeCounts}
        historyCounts={historyCounts}
        companyId={companyId || ''}
      />
    </Shell>
  );
}
