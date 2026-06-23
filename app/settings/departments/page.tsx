import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import DepartmentsClient from './DepartmentsClient';
import { redirect } from 'next/navigation';

export default async function DepartmentsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  if (!profile || !['super_admin', 'hr_director'].includes(profile.role)) redirect('/dashboard');

  const { data: departments } = await supabase.from('departments').select('*').order('name');
  const { data: empCounts } = await supabase.from('employees').select('department_id');

  return (
    <Shell current="/settings/departments" profile={profile}>
      <DepartmentsClient initialDepartments={departments || []} empCounts={empCounts || []} />
    </Shell>
  );
}
