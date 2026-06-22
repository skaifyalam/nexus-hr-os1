import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import CandidateProfileClient from './CandidateProfileClient';
import { notFound } from 'next/navigation';

export default async function CandidateProfilePage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  const { data: candidate } = await supabase
    .from('candidates')
    .select('*, requisitions(position, requisition_id), operations(name, country_code), agencies(name)')
    .eq('id', params.id)
    .single();

  if (!candidate) notFound();

  const { data: documents } = await supabase.from('candidate_documents').select('*').eq('candidate_id', params.id);
  const { data: history } = await supabase.from('mobilization_stages').select('*').eq('candidate_id', params.id).order('started_at', { ascending: true });
  const { data: messages } = await supabase.from('candidate_messages').select('*').eq('candidate_id', params.id).order('created_at', { ascending: true });

  return (
    <Shell current={profile?.role === 'agency_user' ? '/agency' : '/recruitment'} profile={profile}>
      <CandidateProfileClient
        candidate={candidate}
        documents={documents || []}
        history={history || []}
        messages={messages || []}
        profile={profile}
      />
    </Shell>
  );
}
