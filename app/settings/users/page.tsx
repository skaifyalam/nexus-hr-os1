import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import UsersClient from './UsersClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
  const { data: sections } = await supabase.from('company_sections').select('*').eq('company_id', profile?.company_id).order('sidebar_order');

  if (!profile || profile.role !== 'super_admin') redirect('/dashboard');

  const { data: profiles } = await supabase.from('profiles').select('*').order('created_at');
  const { data: operations } = await supabase.from('operations').select('*');
  const { data: agencies } = await supabase.from('agencies').select('*');
  const { data: userOps } = await supabase.from('user_operations').select('*');

  return (
    <Shell current="/settings/users" profile={profile} sections={sections || []} companyId={profile?.company_id || ''}>
      <UsersClient
        initialProfiles={profiles || []}
        operations={operations || []}
        agencies={agencies || []}
        userOps={userOps || []}
        currentUserId={user?.id || ''}
      />
    </Shell>
  );
}
