import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import UsersClient from './UsersClient';
import { redirect } from 'next/navigation';

export default async function UsersPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  if (!profile || profile.role !== 'super_admin') redirect('/dashboard');

  const { data: profiles } = await supabase.from('profiles').select('*').order('created_at');
  const { data: operations } = await supabase.from('operations').select('*');
  const { data: agencies } = await supabase.from('agencies').select('*');
  const { data: userOps } = await supabase.from('user_operations').select('*');

  return (
    <Shell current="/settings/users" profile={profile}>
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
