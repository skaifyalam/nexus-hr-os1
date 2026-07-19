import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import DepartmentsClient from './DepartmentsClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  if (!profile || !['super_admin', 'hr_director'].includes(profile.role)) redirect('/dashboard');

  const companyId = profile?.company_id;

  const [
    { data: sections },
    { data: departments },
    { data: legacyEmps },
    { data: empFields },
    { data: candFields },
    { data: mappings },
  ] = await Promise.all([
    supabase.from('company_sections').select('*').eq('company_id', companyId).order('sidebar_order'),
    supabase.from('departments').select('*').eq('company_id', companyId).order('name'),
    supabase.from('employees').select('department_id'),
    supabase.from('section_field_configs').select('field_key, links_to').eq('company_id', companyId).eq('section_key', 'employee'),
    supabase.from('section_field_configs').select('field_key, links_to').eq('company_id', companyId).eq('section_key', 'candidate'),
    supabase.from('entity_mappings').select('excel_value, mapped_id').eq('company_id', companyId).eq('entity_type', 'department'),
  ]);

  // Count members per department from BOTH sources:
  // 1) legacy employees.department_id
  // 2) universal employee/candidate section records whose department-linked field
  //    value matches a department name, or maps (via entity_mappings) to one.
  const counts: Record<string, number> = {};
  (departments || []).forEach((d: any) => { counts[d.id] = 0; });

  (legacyEmps || []).forEach((e: any) => {
    if (e.department_id && counts[e.department_id] !== undefined) counts[e.department_id]++;
  });

  const resolver: Record<string, string> = {};
  (departments || []).forEach((d: any) => { resolver[String(d.name).trim().toLowerCase()] = d.id; });
  (mappings || []).forEach((m: any) => { if (m.mapped_id) resolver[String(m.excel_value).trim().toLowerCase()] = m.mapped_id; });

  const countSection = async (sectionKey: string, fieldConfigs: any[]) => {
    const deptField = (fieldConfigs || []).find((f: any) => f.links_to === 'department');
    if (!deptField) return;
    let from = 0;
    for (;;) {
      const { data: recs } = await supabase.from('section_records')
        .select('data').eq('company_id', companyId).eq('section_key', sectionKey)
        .range(from, from + 999);
      if (!recs || recs.length === 0) break;
      recs.forEach((r: any) => {
        const v = r.data?.[deptField.field_key];
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
    <Shell current="/settings/departments" profile={profile} sections={sections || []} companyId={companyId || ''}>
      <DepartmentsClient initialDepartments={departments || []} memberCounts={counts} companyId={companyId || ''} />
    </Shell>
  );
}
