import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import RequisitionsClient from './RequisitionsClient';

export default async function RequisitionsPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();

  const [{ data: requisitions }, { data: departments }, { data: operations }] = await Promise.all([
    supabase.from('requisitions').select('*, departments(name), operations(name, country_code)').order('created_at', { ascending: false }),
    supabase.from('departments').select('*'),
    supabase.from('operations').select('*'),
  ]);

  return (
    <Shell current="/requisitions" profile={profile} sections={sections} companyId={profile?.company_id || ""}>
      <RequisitionsClient initialRequisitions={requisitions || []} departments={departments || []} operations={operations || []} />
    </Shell>
  );
}
