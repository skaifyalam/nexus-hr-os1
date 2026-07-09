import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import RolesClient from './RolesClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function RolesPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  if (!profile || profile.role !== 'super_admin') redirect('/dashboard');
  const companyId = profile.company_id;

  const [{ data: roles }, { data: profiles }, { data: empFields }, { data: company }] = await Promise.all([
    supabase.from('custom_roles').select('*').eq('company_id', companyId).order('created_at'),
    supabase.from('profiles').select('id, email, full_name, role, custom_role_id, project_scope, created_at').eq('company_id', companyId).order('created_at'),
    supabase.from('section_field_configs').select('field_key, field_label').eq('company_id', companyId).eq('section_key', 'employee').order('display_order'),
    supabase.from('company_profile').select('project_field_key').eq('id', companyId).maybeSingle(),
  ]);

  // Distinct values of the chosen project field, for scope assignment
  let projectValues: string[] = [];
  if (company?.project_field_key) {
    let recs: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('section_records').select('data')
        .eq('company_id', companyId).eq('section_key', 'employee').range(from, from + 999);
      if (!data || data.length === 0) break;
      recs = recs.concat(data);
      if (data.length < 1000) break;
    }
    projectValues = Array.from(new Set(recs.map(r => r.data?.[company.project_field_key!]).filter(Boolean))).sort().slice(0, 100);
  }

  return (
    <Shell current="/settings/roles" profile={profile} sections={sections} companyId={companyId}>
      <RolesClient initialRoles={roles || []} initialProfiles={profiles || []} companyId={companyId} currentUserId={profile.id} sections={sections} empFields={empFields || []} projectField={company?.project_field_key || ''} projectValues={projectValues} />
    </Shell>
  );
}
