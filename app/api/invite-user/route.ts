import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { email, role, agency_id, custom_role_id } = await req.json();

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
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admins can invite users.' }, { status: 403 });
    }

    // Try the email invite. This needs SMTP configured in Supabase Auth settings.
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { invited_by: user.email, company_id: profile.company_id },
    });

    if (inviteError) {
      // Common case: no SMTP configured, or user already exists. Give a clear message + fallback.
      const msg = inviteError.message || 'Invite failed.';
      // Fallback: if email can't be sent, create the user directly with a temp password the admin can share
      if (/smtp|email|not.*configured|sending/i.test(msg)) {
        const tempPw = 'Naibus@' + Math.random().toString(36).slice(2, 8);
        const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
          email, password: tempPw, email_confirm: true,
          user_metadata: { company_id: profile.company_id },
        });
        if (createErr) return NextResponse.json({ error: createErr.message || 'Could not create user.' }, { status: 400 });
        if (created?.user) {
          await adminClient.from('profiles').update({
            role: role || 'employee', company_id: profile.company_id,
            agency_id: agency_id || null, custom_role_id: custom_role_id || null,
          }).eq('id', created.user.id);
        }
        return NextResponse.json({ success: true, tempPassword: tempPw, note: 'Email sending is not set up, so we created the account directly. Share this temporary password with the user.' });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (inviteData?.user) {
      await adminClient.from('profiles').update({
        role: role || 'employee',
        company_id: profile.company_id,
        agency_id: agency_id || null,
        custom_role_id: custom_role_id || null,
      }).eq('id', inviteData.user.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) || 'Unexpected error.' }, { status: 500 });
  }
}
