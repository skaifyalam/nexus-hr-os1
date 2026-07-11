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

  // Projects come from the dedicated Projects list (Countries & Projects admin)
  const { data: projectRows } = await supabase.from('projects')
    .select('project_name, project_code').eq('company_id', companyId).order('project_name');
  const projectValues: string[] = Array.from(new Set(
    (projectRows || []).map((p: any) => p.project_name).filter(Boolean)
  ));

  return (
    <Shell current="/settings/roles" profile={profile} sections={sections} companyId={companyId}>
      <RolesClient initialRoles={roles || []} initialProfiles={profiles || []} companyId={companyId} currentUserId={profile.id} sections={sections} empFields={empFields || []} projectField={company?.project_field_key || ''} projectValues={projectValues} />
    </Shell>
  );
}
