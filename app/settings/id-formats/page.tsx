import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import IdFormatsClient from './IdFormatsClient';
import { redirect } from 'next/navigation';

export default async function IdFormatsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  if (!profile || profile.role !== 'super_admin') redirect('/dashboard');

  const { data: formats } = await supabase.from('id_formats').select('*').order('entity_type');

  return (
    <Shell current="/settings/id-formats" profile={profile}>
      <IdFormatsClient initialFormats={formats || []} />
    </Shell>
  );
}
