import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import RecruitmentClient from './RecruitmentClient';
import { redirect } from 'next/navigation';

export default async function RecruitmentPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  if (profile?.role === 'agency_user') redirect('/agency');

  const { data: candidates } = await supabase
    .from('candidates')
    .select('*, requisitions(position, requisition_id), operations(name, country_code), agencies(name)')
    .order('created_at', { ascending: false });

  const { data: requisitions } = await supabase.from('requisitions').select('*').in('status', ['open', 'in_progress']);
  const { data: operations } = await supabase.from('operations').select('*');
  const { data: agencies } = await supabase.from('agencies').select('*');

  return (
    <Shell current="/recruitment" profile={profile}>
      <RecruitmentClient
        initialCandidates={candidates || []}
        requisitions={requisitions || []}
        operations={operations || []}
        agencies={agencies || []}
      />
    </Shell>
  );
}
