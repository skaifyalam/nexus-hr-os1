import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import ApprovalsClient from './ApprovalsClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  if (!profile || profile.role !== 'super_admin') redirect('/dashboard');
  const companyId = profile.company_id;

  const [{ data: workflows }, { data: roles }] = await Promise.all([
    supabase.from('approval_workflows').select('*').eq('company_id', companyId).order('created_at'),
    supabase.from('custom_roles').select('id, name').eq('company_id', companyId).order('name'),
  ]);

  return (
    <Shell current="/settings/approvals" profile={profile} sections={sections} companyId={companyId}>
      <ApprovalsClient initialWorkflows={workflows || []} roles={roles || []} sections={sections} companyId={companyId} />
    </Shell>
  );
}
