import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import OperationsClient from './OperationsClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OperationsSettingsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
  const { data: sections } = await supabase.from('company_sections').select('*').eq('company_id', profile?.company_id).order('sidebar_order');

  if (!profile || !['super_admin', 'hr_director'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const companyId = profile?.company_id;
  const [
    { data: operations },
    { data: projects },
    { data: legacyEmpCounts },
    { data: empFields },
    { data: candFields },
    { data: mappings },
  ] = await Promise.all([
    supabase.from('operations').select('*').eq('company_id', companyId).order('created_at'),
    supabase.from('projects').select('*').eq('company_id', companyId).order('created_at'),
    supabase.from('employees').select('operation_id, current_project_id'),
    supabase.from('section_field_configs').select('field_key, links_to').eq('company_id', companyId).eq('section_key', 'employee'),
    supabase.from('section_field_configs').select('field_key, links_to').eq('company_id', companyId).eq('section_key', 'candidate'),
    supabase.from('entity_mappings').select('excel_value, mapped_id').eq('company_id', companyId).eq('entity_type', 'country'),
  ]);

  // Count people per COUNTRY (operations) from the universal sections too,
  // matching by operation name or saved country mapping.
  const countryCounts: Record<string, number> = {};
  (operations || []).forEach((o: any) => { countryCounts[o.id] = 0; });
  const resolver: Record<string, string> = {};
  (operations || []).forEach((o: any) => { resolver[String(o.name).trim().toLowerCase()] = o.id; });
  (mappings || []).forEach((m: any) => { if (m.mapped_id) resolver[String(m.excel_value).trim().toLowerCase()] = m.mapped_id; });

  const countCountryIn = async (sectionKey: string, fieldConfigs: any[]) => {
    const cf = (fieldConfigs || []).find((f: any) => f.links_to === 'country');
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
        if (id && countryCounts[id] !== undefined) countryCounts[id]++;
      });
      if (recs.length < 1000) break;
      from += 1000;
    }
  };
  await countCountryIn('employee', empFields || []);
  await countCountryIn('candidate', candFields || []);

  return (
    <Shell current="/settings/operations" profile={profile} sections={sections || []} companyId={companyId || ''}>
      <OperationsClient
        initialOperations={operations || []}
        initialProjects={projects || []}
        employeeCounts={legacyEmpCounts || []}
        countryCounts={countryCounts}
        companyId={companyId || ''}
      />
    </Shell>
  );
}
