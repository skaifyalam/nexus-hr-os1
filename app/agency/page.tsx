import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import AgencyClient from './AgencyClient';

export default async function AgencyPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  // RLS automatically restricts this to only the logged-in agency's own candidates.
  const { data: candidates } = await supabase
    .from('candidates')
    .select('*, requisitions(position, requisition_id), operations(name, country_code), candidate_documents(*)')
    .order('created_at', { ascending: false });

  const { data: requisitions } = await supabase.from('requisitions').select('*').in('status', ['open', 'in_progress']);

  return (
    <Shell current="/agency" profile={profile}>
      <AgencyClient initialCandidates={candidates || []} requisitions={requisitions || []} profile={profile} />
    </Shell>
  );
}
