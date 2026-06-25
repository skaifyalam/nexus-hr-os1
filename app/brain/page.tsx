import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import BrainClient from './BrainClient';

export default async function BrainPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
  const { data: documents } = await supabase
    .from('brain_documents')
    .select('*')
    .order('uploaded_at', { ascending: false });
  const { data: conversations } = await supabase
    .from('brain_conversations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <Shell current="/brain" profile={profile}>
      <BrainClient
        initialDocs={documents || []}
        initialConvs={conversations || []}
        companyId={profile?.company_id || ''}
        userEmail={user?.email || ''}
      />
    </Shell>
  );
}
