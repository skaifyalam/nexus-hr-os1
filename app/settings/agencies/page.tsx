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

  // Fetch everything in parallel.
  const [
    { data: sections },
    { data: agencies },
    { data: legacyCands },
    { data: candFields },
    { data: mappings },
  ] = await Promise.all([
    supabase.from('company_sections').select('*').eq('company_id', profile?.company_id).order('sidebar_order'),
    supabase.from('agencies').select('*').eq('company_id', profile?.company_id).order('name'),
    supabase.from('candidates').select('agency_id').eq('company_id', profile?.company_id),
    supabase.from('section_field_configs').select('field_key, links_to')
      .eq('company_id', profile?.company_id).eq('section_key', 'candidate'),
    supabase.from('entity_mappings').select('excel_value, mapped_id, mapped_name')
      .eq('company_id', profile?.company_id).eq('entity_type', 'agency'),
  ]);

  // Count candidates per agency from BOTH sources:
  // 1) legacy candidates.agency_id
  // 2) universal candidate section_records whose agency-field value matches an
  //    agency name, or maps (via entity_mappings) to an agency id.
  const counts: Record<string, number> = {};
  (agencies || []).forEach((a: any) => { counts[a.id] = 0; });

  (legacyCands || []).forEach((c: any) => {
    if (c.agency_id && counts[c.agency_id] !== undefined) counts[c.agency_id]++;
  });

  const agencyField = (candFields || []).find((f: any) => f.links_to === 'agency');
  if (agencyField) {
    const valueToAgencyId: Record<string, string> = {};
    (agencies || []).forEach((a: any) => { valueToAgencyId[String(a.name).trim().toLowerCase()] = a.id; });
    (mappings || []).forEach((m: any) => {
      if (m.mapped_id) valueToAgencyId[String(m.excel_value).trim().toLowerCase()] = m.mapped_id;
    });

    let from = 0;
    for (;;) {
      const { data: recs } = await supabase.from('section_records')
        .select('data').eq('company_id', profile?.company_id).eq('section_key', 'candidate')
        .range(from, from + 999);
      if (!recs || recs.length === 0) break;
      recs.forEach((r: any) => {
        const v = r.data?.[agencyField.field_key];
        if (!v) return;
        const id = valueToAgencyId[String(v).trim().toLowerCase()];
        if (id && counts[id] !== undefined) counts[id]++;
      });
      if (recs.length < 1000) break;
      from += 1000;
    }
  }

  return (
    <Shell current="/settings/agencies" profile={profile} sections={sections || []} companyId={profile?.company_id || ''}>
      <AgenciesSettingsClient initialAgencies={agencies || []} candCounts={counts} companyId={profile?.company_id || ''} />
    </Shell>
  );
}
