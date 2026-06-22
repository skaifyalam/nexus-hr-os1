import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import RequisitionsClient from './RequisitionsClient';

export default async function RequisitionsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  const { data: requisitions } = await supabase
    .from('requisitions')
    .select('*, departments(name), operations(name, country_code)')
    .order('created_at', { ascending: false });

  const { data: departments } = await supabase.from('departments').select('*');
  const { data: operations } = await supabase.from('operations').select('*');

  return (
    <Shell current="/requisitions" profile={profile}>
      <RequisitionsClient initialRequisitions={requisitions || []} departments={departments || []} operations={operations || []} />
    </Shell>
  );
}
