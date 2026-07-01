import { createServerClient } from './supabase/server';
export async function getShellData() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { profile: null, modules: [], customSections: [], user: null };
  const [{ data: profile }, { data: modules }, { data: customSections }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('installed_modules').select('*').order('sidebar_order'),
    supabase.from('custom_sections').select('*').order('sidebar_order'),
  ]);
  return { profile: profile || null, modules: modules || [], customSections: customSections || [], user };
}
