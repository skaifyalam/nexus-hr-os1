import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import ProfileClient from './ProfileClient';
import { notFound } from 'next/navigation';

export default async function EmployeeProfilePage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  const { data: employee } = await supabase
    .from('employees')
    .select('*, departments(name), operations(name, country_code), projects(project_code, project_name)')
    .eq('id', params.id)
    .single();

  if (!employee) notFound();

  const { data: history } = await supabase
    .from('employee_assignments')
    .select('*')
    .eq('employee_id', params.id)
    .order('start_date', { ascending: false });

  const { data: transfers } = await supabase
    .from('transfer_requests')
    .select('*, checklist:transfer_checklist(*)')
    .eq('employee_id', params.id)
    .order('created_at', { ascending: false });

  const { data: operations } = await supabase.from('operations').select('*');
  const { data: projects } = await supabase.from('projects').select('*');
  const { data: departments } = await supabase.from('departments').select('*');

  return (
    <Shell current="/employees" profile={profile}>
      <ProfileClient
        employee={employee}
        history={history || []}
        transfers={transfers || []}
        operations={operations || []}
        projects={projects || []}
        departments={departments || []}
      />
    </Shell>
  );
}
