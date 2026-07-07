import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { loadPeopleForPicker } from '@/lib/people';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import AttendanceClient from './AttendanceClient';

export default async function AttendancePage() {
  const supabase = createServerClient();
  const { profile, sections, user } = await getShellData();
  const _access = await getFeatureAccess(profile, 'attendance');
  if (_access === 'none') redirect('/dashboard');
  const companyId = profile?.company_id || '';

  const [{ data: records }, { data: empFields }] = await Promise.all([
    supabase.from('attendance_records').select('*').eq('company_id', companyId).order('date', { ascending: false }).limit(2000),
    supabase.from('section_field_configs').select('*').eq('company_id', companyId).eq('section_key', 'employee').order('display_order'),
  ]);

  const { people: employees } = await loadPeopleForPicker(companyId, 'employee');

  return (
    <Shell current="/attendance" profile={profile} sections={sections} companyId={companyId}>
      <AttendanceClient initialRecords={records || []} employees={employees} empFields={empFields || []} companyId={companyId} userEmail={user?.email || ''} />
    </Shell>
  );
}
