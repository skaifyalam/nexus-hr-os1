import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import EmployeesClient from './EmployeesClient';

export default async function EmployeesPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  const { data: employees } = await supabase
    .from('employees')
    .select('*, departments(name), operations(name, country_code), projects(project_code, project_name)')
    .order('created_at', { ascending: false });

  const { data: departments } = await supabase.from('departments').select('*');
  const { data: operations } = await supabase.from('operations').select('*');
  const { data: projects } = await supabase.from('projects').select('*');

  return (
    <Shell current="/employees" profile={profile}>
      <EmployeesClient
        initialEmployees={employees || []}
        departments={departments || []}
        operations={operations || []}
        projects={projects || []}
      />
    </Shell>
  );
}
