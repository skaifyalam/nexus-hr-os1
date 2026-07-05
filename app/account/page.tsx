import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import AccountClient from './AccountClient';

export default async function AccountPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  const companyId = profile?.company_id || '';
  const isSuper = profile?.role === 'super_admin';

  // Super user also sees billing + usage here
  let sub = null, empCount = 0;
  if (isSuper) {
    const [{ data: s }, { count }] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('company_id', companyId).maybeSingle(),
      supabase.from('section_records').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('section_key', 'employee'),
    ]);
    sub = s; empCount = count || 0;
  }

  return (
    <Shell current="/account" profile={profile} sections={sections} companyId={companyId}>
      <AccountClient profile={profile} isSuper={isSuper} subscription={sub} employeeCount={empCount} />
    </Shell>
  );
}
