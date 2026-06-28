import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import BrainClient from './BrainClient';

export default async function BrainPage() {
  const supabase = createServerClient();
  const { profile, modules, customSections, user } = await getShellData();

  const [{ data: documents }, { data: conversations }] = await Promise.all([
    supabase.from('brain_documents').select('*').order('uploaded_at', { ascending: false }),
    supabase.from('brain_conversations').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  return (
    <Shell current="/brain" profile={profile} modules={modules} customSections={customSections}>
      <BrainClient initialDocs={documents || []} initialConvs={conversations || []} companyId={profile?.company_id || ''} userEmail={user?.email || ''} />
    </Shell>
  );
}
