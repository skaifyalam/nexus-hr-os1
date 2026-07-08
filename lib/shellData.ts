import { createServerClient } from './supabase/server';

export async function getShellData() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { profile: null, sections: [], user: null };

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const { data: sections } = await supabase
    .from('company_sections')
    .select('*')
    .eq('company_id', profile?.company_id)
    .order('sidebar_order', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });

  return {
    profile: profile || null,
    sections: sections || [],
    user,
  };
}
