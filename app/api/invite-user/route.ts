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
      process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Use the password the admin set; fall back to a generated one if none provided.
    const tempPw = (body.password && String(body.password).length >= 6)
      ? String(body.password)
      : 'Naibus@' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password: tempPw,
      email_confirm: true,
      user_metadata: { company_id: profile.company_id, invited_by: user.email },
    });

    if (createErr) {
      // Supabase AuthError often has status/code even when message is empty.
      const anyErr = createErr as any;
      const parts = [
        anyErr.message,
        anyErr.code && `code=${anyErr.code}`,
        anyErr.status && `status=${anyErr.status}`,
        anyErr.name && `name=${anyErr.name}`,
        anyErr.__isAuthError && 'authError',
      ].filter(Boolean);
      const detail = parts.length ? parts.join(' ') : (Object.keys(anyErr).length ? JSON.stringify(anyErr, Object.getOwnPropertyNames(anyErr)) : 'empty error object');
      if (/already.*registered|already.*exists|duplicate|been registered/i.test(detail)) {
        return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 });
      }
      // AuthRetryableFetchError = network fetch to Supabase auth failed. Add config hints.
      if (/retryable|fetch/i.test(detail)) {
        const urlHost = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/https?:\/\//, '').split('.')[0];
        return NextResponse.json({ error: `Cannot reach Supabase Auth (${detail}). URL project ref appears to be "${urlHost}". Verify the service_role key belongs to THIS project and has not been rotated.` }, { status: 400 });
      }
      return NextResponse.json({ error: `Create failed: ${detail}` }, { status: 400 });
    }

    if (!created?.user) {
      return NextResponse.json({ error: 'User creation returned no result.' }, { status: 400 });
    }

    // A database trigger auto-creates the profile row on user creation.
    // Wait a moment for it, then UPDATE that row with company + role.
    await new Promise(r => setTimeout(r, 400));
    const { error: linkErr } = await adminClient.from('profiles').update({
      email: email.trim(),
      company_id: profile.company_id,
      role: role || 'employee',
      agency_id: agency_id || null,
      custom_role_id: custom_role_id || null,
    }).eq('id', created.user.id);

    if (linkErr) {
      // Not fatal — the user exists; just report it so the admin knows.
      return NextResponse.json({
        success: true,
        tempPassword: tempPw,
        note: `Account created, but role/company link had an issue: ${linkErr.message}. You can set their role from the Users list.`,
      });
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
