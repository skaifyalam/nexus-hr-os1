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

  const { data: operations } = await supabase.from('operations').select('*').eq('company_id', profile?.company_id).order('created_at');
  const { data: projects } = await supabase.from('projects').select('*').eq('company_id', profile?.company_id).order('created_at');
  const { data: employeeCounts } = await supabase.from('employees').select('operation_id, current_project_id');

  return (
    <Shell current="/settings/operations" profile={profile} sections={sections || []} companyId={profile?.company_id || ''}>
      <OperationsClient
        initialOperations={operations || []}
        initialProjects={projects || []}
        employeeCounts={employeeCounts || []}
        companyId={profile?.company_id || ''}
      />
    </Shell>
  );
}
