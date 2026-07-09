import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Creates an admin-provisioned user who logs in with USERNAME + PASSWORD (no email).
// Uses signUp (a normal call) instead of the admin API, which avoids the
// AuthRetryableFetchError seen with auth.admin.createUser.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password, role, agency_id, custom_role_id } = body;

    if (!username || !username.trim()) return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
    if (!password || password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });

    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    if (!url || !anon) return NextResponse.json({ error: 'Supabase env vars missing.' }, { status: 500 });

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 400 });
    if (profile.role !== 'super_admin') return NextResponse.json({ error: 'Only Super Admins can create users.' }, { status: 403 });

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!cleanUsername) return NextResponse.json({ error: 'Username must contain letters or numbers.' }, { status: 400 });

    // Global uniqueness: no two users anywhere can share a username.
    const { data: taken } = await supabase.from('profiles').select('id').eq('username', cleanUsername).limit(1);
    if (taken && taken.length > 0) {
      return NextResponse.json({ error: `The username "${cleanUsername}" is already taken. Please choose another.` }, { status: 400 });
    }

    const companyRef = String(profile.company_id).slice(0, 8);
    const syntheticEmail = `${cleanUsername}.${companyRef}@naibus.local`;

    const freshClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signUpData, error: signUpErr } = await freshClient.auth.signUp({
      email: syntheticEmail,
      password,
      options: { data: { username: cleanUsername, company_id: profile.company_id } },
    });

    if (signUpErr) {
      const m = signUpErr.message || 'Signup failed.';
      if (/already|registered|exists/i.test(m)) return NextResponse.json({ error: 'That username is already taken.' }, { status: 400 });
      return NextResponse.json({ error: m }, { status: 400 });
    }
    if (!signUpData?.user) return NextResponse.json({ error: 'User was not created.' }, { status: 400 });

    await new Promise(r => setTimeout(r, 400));
    const { error: linkErr } = await supabase.from('profiles').update({
      company_id: profile.company_id,
      role: role || 'employee',
      username: cleanUsername,
      login_email: syntheticEmail,
      is_username_user: true,
      agency_id: agency_id || null,
      custom_role_id: custom_role_id || null,
    }).eq('id', signUpData.user.id);

    if (linkErr) {
      return NextResponse.json({ success: true, username: cleanUsername, note: `User created, but role link had an issue: ${linkErr.message}. Set it from the Users list.` });
    }

    return NextResponse.json({ success: true, username: cleanUsername });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error creating user.' }, { status: 500 });
  }
}
