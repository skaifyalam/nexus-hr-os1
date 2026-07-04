import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import AttendanceClient from './AttendanceClient';

export default async function AttendancePage() {
  const supabase = createServerClient();
  const { profile, sections, user } = await getShellData();
  const companyId = profile?.company_id || '';

  const [{ data: records }, { data: empFields }] = await Promise.all([
    supabase.from('attendance_records').select('*').eq('company_id', companyId).order('date', { ascending: false }).limit(2000),
    supabase.from('section_field_configs').select('*').eq('company_id', companyId).eq('section_key', 'employee').order('display_order'),
  ]);

  let employees: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('section_records').select('id, record_id, data')
      .eq('company_id', companyId).eq('section_key', 'employee').range(from, from + 999);
    if (!data || data.length === 0) break;
    employees = employees.concat(data);
    if (data.length < 1000) break;
  }

  return (
    <Shell current="/attendance" profile={profile} sections={sections} companyId={companyId}>
      <AttendanceClient initialRecords={records || []} employees={employees} empFields={empFields || []} companyId={companyId} userEmail={user?.email || ''} />
    </Shell>
  );
}
