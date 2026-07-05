import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import LeaveClient from './LeaveClient';

export default async function LeavePage() {
  const supabase = createServerClient();
  const { profile, sections, user } = await getShellData();
  const _access = await getFeatureAccess(profile, 'leave');
  if (_access === 'none') redirect('/dashboard');
  const companyId = profile?.company_id || '';

  const [{ data: types }, { data: requests }, { data: empFields }, { data: policies }] = await Promise.all([
    supabase.from('leave_types').select('*').eq('company_id', companyId).order('sort_order'),
    supabase.from('leave_requests').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('section_field_configs').select('*').eq('company_id', companyId).eq('section_key', 'employee').order('display_order'),
    supabase.from('leave_policies').select('*').eq('company_id', companyId).order('sort_order'),
  ]);

  // Load employees (batched) for the picker — id + name field only
  let employees: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('section_records').select('id, record_id, data')
      .eq('company_id', companyId).eq('section_key', 'employee').range(from, from + 999);
    if (!data || data.length === 0) break;
    employees = employees.concat(data);
    if (data.length < 1000) break;
  }

  return (
    <Shell current="/leave" profile={profile} sections={sections} companyId={companyId}>
      <LeaveClient
        initialTypes={types || []}
        initialRequests={requests || []}
        initialPolicies={policies || []}
        employees={employees}
        empFields={empFields || []}
        companyId={companyId}
        userEmail={user?.email || ''}
      />
    </Shell>
  );
}
