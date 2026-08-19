import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import CompaniesClient from './CompaniesClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  if (!profile || !['super_admin', 'hr_director'].includes(profile.role)) redirect('/dashboard');

  const companyId = profile?.company_id;

  const [
    { data: sections },
    { data: companies },
    { data: empFields },
    { data: candFields },
    { data: mappings },
  ] = await Promise.all([
    supabase.from('company_sections').select('*').eq('company_id', companyId).order('sidebar_order'),
    supabase.from('sub_companies').select('*').eq('company_id', companyId).order('name'),
    supabase.from('section_field_configs').select('field_key, links_to').eq('company_id', companyId).eq('section_key', 'employee'),
    supabase.from('section_field_configs').select('field_key, links_to').eq('company_id', companyId).eq('section_key', 'candidate'),
    supabase.from('entity_mappings').select('excel_value, mapped_id').eq('company_id', companyId).eq('entity_type', 'company'),
  ]);

  // Count people per sub-company from the universal sections, matching by name or
  // saved mapping — identical to how Departments counts.
  const counts: Record<string, number> = {};
  (companies || []).forEach((c: any) => { counts[c.id] = 0; });

  const resolver: Record<string, string> = {};
  (companies || []).forEach((c: any) => { resolver[String(c.name).trim().toLowerCase()] = c.id; });
  (mappings || []).forEach((m: any) => { if (m.mapped_id) resolver[String(m.excel_value).trim().toLowerCase()] = m.mapped_id; });

  const countSection = async (sectionKey: string, fieldConfigs: any[]) => {
    const cf = (fieldConfigs || []).find((f: any) => f.links_to === 'company');
    if (!cf) return;
    let from = 0;
    for (;;) {
      const { data: recs } = await supabase.from('section_records')
        .select('data').eq('company_id', companyId).eq('section_key', sectionKey).range(from, from + 999);
      if (!recs || recs.length === 0) break;
      recs.forEach((r: any) => {
        const v = r.data?.[cf.field_key];
        if (!v) return;
        const id = resolver[String(v).trim().toLowerCase()];
        if (id && counts[id] !== undefined) counts[id]++;
      });
      if (recs.length < 1000) break;
      from += 1000;
    }
  };
  await countSection('employee', empFields || []);
  await countSection('candidate', candFields || []);

  return (
    <Shell current="/settings/companies" profile={profile} sections={sections || []} companyId={companyId || ''}>
      <CompaniesClient
        initialCompanies={companies || []}
        counts={counts}
        companyId={companyId || ''}
      />
    </Shell>
  );
}
