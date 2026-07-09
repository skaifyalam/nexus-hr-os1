import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import IdFormatsClient from './IdFormatsClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function IdFormatsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
  const { data: sections } = await supabase.from('company_sections').select('*').eq('company_id', profile?.company_id).order('sidebar_order');

  if (!profile || profile.role !== 'super_admin') redirect('/dashboard');

  return (
    <Shell current="/settings/id-formats" profile={profile} sections={sections || []} companyId={profile?.company_id || ''}>
      <IdFormatsClient initialSections={sections || []} companyId={profile?.company_id || ''} />
    </Shell>
  );
}
