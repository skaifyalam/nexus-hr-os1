import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import BrainClient from './BrainClient';

export const dynamic = 'force-dynamic';

export default async function BrainPage() {
  const supabase = createServerClient();
  const { profile, sections, user } = await getShellData();
  const _access = await getFeatureAccess(profile, 'brain');
  if (_access === 'none') redirect('/dashboard');

  const [{ data: documents }, { data: conversations }] = await Promise.all([
    supabase.from('brain_documents').select('*').order('uploaded_at', { ascending: false }),
    supabase.from('brain_conversations').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  return (
    <Shell current="/brain" profile={profile} sections={sections}>
      <BrainClient initialDocs={documents || []} initialConvs={conversations || []} companyId={profile?.company_id || ''} userEmail={user?.email || ''} />
    </Shell>
  );
}
