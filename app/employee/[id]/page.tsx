import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import Employee360 from './Employee360';
import { notFound } from 'next/navigation';

export default async function EmployeeProfilePage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  const companyId = profile?.company_id || '';
  const id = params.id;

  // The employee record
  const { data: emp } = await supabase.from('section_records').select('*').eq('id', id).maybeSingle();
  if (!emp) notFound();

  const { data: empFields } = await supabase.from('section_field_configs')
    .select('*').eq('company_id', companyId).eq('section_key', 'employee').order('display_order');

  // Everything linked to this person
  const [leave, attendance, performance, documents, visaAllocs, conduct, exits, grievances] = await Promise.all([
    supabase.from('leave_requests').select('*').eq('company_id', companyId).eq('employee_record_id', id).order('start_date', { ascending: false }),
    supabase.from('attendance_records').select('*').eq('company_id', companyId).eq('employee_record_id', id).order('date', { ascending: false }).limit(60),
    supabase.from('performance_reviews').select('*').eq('company_id', companyId).eq('employee_record_id', id).order('created_at', { ascending: false }),
    supabase.from('document_records').select('*').eq('company_id', companyId).eq('employee_record_id', id).order('expiry_date', { ascending: true }),
    supabase.from('visa_allocations').select('*, visa_blocks(*)').eq('company_id', companyId).eq('person_record_id', id),
    supabase.from('conduct_records').select('*').eq('company_id', companyId).eq('person_record_id', id).order('created_at', { ascending: false }),
    supabase.from('exit_records').select('*').eq('company_id', companyId).eq('person_record_id', id).order('created_at', { ascending: false }),
    supabase.from('grievances').select('*').eq('company_id', companyId).eq('person_record_id', id).order('created_at', { ascending: false }),
  ]);

  return (
    <Shell current="/s/employee" profile={profile} sections={sections} companyId={companyId}>
      <Employee360
        emp={emp} empFields={empFields || []}
        leave={leave.data || []} attendance={attendance.data || []} performance={performance.data || []}
        documents={documents.data || []} visaAllocs={visaAllocs.data || []}
        conduct={conduct.data || []} exits={exits.data || []} grievances={grievances.data || []}
      />
    </Shell>
  );
}
