import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Adds a user to the current company by creating their account directly with a
// temporary password (no SMTP/email needed). The admin shares the password.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, role, agency_id, custom_role_id } = body;

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables. Add it in Vercel → Settings → Environment Variables, then redeploy.' }, { status: 500 });
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: 'Missing NEXT_PUBLIC_SUPABASE_URL in environment variables.' }, { status: 500 });
    }

    // Who is making the request?
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated. Please log in again.' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Your profile could not be loaded.' }, { status: 400 });
    if (profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admins can add users.' }, { status: 403 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create the user directly with a temp password (reliable, no email needed).
    const tempPw = 'Naibus@' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password: tempPw,
      email_confirm: true,
      user_metadata: { company_id: profile.company_id, invited_by: user.email },
    });

    if (createErr) {
      const m = createErr.message || 'Could not create the user.';
      // Friendlier message for the most common case
      if (/already.*registered|already.*exists|duplicate/i.test(m)) {
        return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 });
      }
      return NextResponse.json({ error: m }, { status: 400 });
    }

    if (!created?.user) {
      return NextResponse.json({ error: 'User creation returned no result.' }, { status: 400 });
    }

    // Link the new user to this company + role
    const { error: linkErr } = await adminClient.from('profiles').upsert({
      id: created.user.id,
      email: email.trim(),
      company_id: profile.company_id,
      role: role || 'employee',
      agency_id: agency_id || null,
      custom_role_id: custom_role_id || null,
    }, { onConflict: 'id' });

    if (linkErr) {
      return NextResponse.json({ error: `User created but linking to company failed: ${linkErr.message}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      tempPassword: tempPw,
      note: 'Account created. Share this temporary password with the user — they can change it after logging in.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected server error while adding the user.' }, { status: 500 });
  }
}
