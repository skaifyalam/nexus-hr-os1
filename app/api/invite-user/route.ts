import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { email, role, operation_ids, agency_id, custom_role_id } = await req.json();

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured in Vercel environment variables.' }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user?.id).single();

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admins can invite users.' }, { status: 403 });
    }

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { invited_by: user?.email, company_id: profile.company_id },
    });

    if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 400 });

    if (inviteData?.user) {
      await adminClient.from('profiles').update({
        role,
        company_id: profile.company_id,
        agency_id: agency_id || null,
        custom_role_id: custom_role_id || null,
      }).eq('id', inviteData.user.id);

      if (operation_ids?.length > 0) {
        const rows = operation_ids.map((opId: string) => ({ user_id: inviteData.user.id, operation_id: opId }));
        await adminClient.from('user_operations').insert(rows);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
