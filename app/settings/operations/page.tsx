import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import OperationsClient from './OperationsClient';
import { redirect } from 'next/navigation';

export default async function OperationsSettingsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  if (!profile || !['super_admin', 'hr_director'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const { data: operations } = await supabase.from('operations').select('*').order('created_at');
  const { data: projects } = await supabase.from('projects').select('*').order('created_at');
  const { data: employeeCounts } = await supabase.from('employees').select('operation_id, current_project_id');

  return (
    <Shell current="/settings/operations" profile={profile}>
      <OperationsClient
        initialOperations={operations || []}
        initialProjects={projects || []}
        employeeCounts={employeeCounts || []}
      />
    </Shell>
  );
}
