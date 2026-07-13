import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import DepartmentsClient from './DepartmentsClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  if (!profile || !['super_admin', 'hr_director'].includes(profile.role)) redirect('/dashboard');

  // Fetch the rest in parallel (was sequential).
  const [{ data: sections }, { data: departments }, { data: empCounts }] = await Promise.all([
    supabase.from('company_sections').select('*').eq('company_id', profile?.company_id).order('sidebar_order'),
    supabase.from('departments').select('*').eq('company_id', profile?.company_id).order('name'),
    supabase.from('employees').select('department_id'),
  ]);

  return (
    <Shell current="/settings/departments" profile={profile} sections={sections || []} companyId={profile?.company_id || ''}>
      <DepartmentsClient initialDepartments={departments || []} empCounts={empCounts || []} companyId={profile?.company_id || ''} />
    </Shell>
  );
}
