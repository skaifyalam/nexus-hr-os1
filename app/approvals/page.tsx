import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import ApprovalsInbox from './ApprovalsInbox';

export default async function ApprovalsInboxPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  const companyId = profile?.company_id || '';

  // Pending approval requests for this company
  const { data: requests } = await supabase.from('approval_requests')
    .select('*').eq('company_id', companyId).order('created_at', { ascending: false });

  // Workflows (to know each step's role) + this user's role
  const { data: workflows } = await supabase.from('approval_workflows').select('id, steps').eq('company_id', companyId);

  return (
    <Shell current="/approvals" profile={profile} sections={sections} companyId={companyId}>
      <ApprovalsInbox
        initialRequests={requests || []}
        workflows={workflows || []}
        myRoleId={(profile as any)?.custom_role_id || null}
        isSuper={profile?.role === 'super_admin'}
        myName={profile?.full_name || profile?.email || ''}
      />
    </Shell>
  );
}
