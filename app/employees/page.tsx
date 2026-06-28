import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import EmployeesClient from './EmployeesClient';

export default async function EmployeesPage() {
  const supabase = createServerClient();
  const { profile, modules, customSections } = await getShellData();

  const [{ data: employees }, { data: departments }, { data: operations }, { data: projects }] = await Promise.all([
    supabase.from('employees').select('*, departments(name), operations(name, country_code), projects(project_code, project_name)').order('created_at', { ascending: false }),
    supabase.from('departments').select('*'),
    supabase.from('operations').select('*'),
    supabase.from('projects').select('*'),
  ]);

  return (
    <Shell current="/employees" profile={profile} modules={modules} customSections={customSections}>
      <EmployeesClient initialEmployees={employees || []} departments={departments || []} operations={operations || []} projects={projects || []} />
    </Shell>
  );
}
