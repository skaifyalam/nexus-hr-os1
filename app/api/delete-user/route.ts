import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: 'Missing user_id.' }, { status: 400 });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured.' }, { status: 500 });
    }

    const adminClient = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
      (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Caller must be super_admin
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admins can remove users.' }, { status: 403 });
    }
    // Cannot remove yourself
    if (user_id === user.id) {
      return NextResponse.json({ error: 'You cannot remove your own account here.' }, { status: 400 });
    }

    // Target must be in the same company
    const { data: target } = await adminClient.from('profiles').select('company_id, role').eq('id', user_id).single();
    if (!target || target.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'User not found in your company.' }, { status: 404 });
    }
    if (target.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot remove a Super Admin.' }, { status: 400 });
    }

    // Delete the profile, then the auth user
    await adminClient.from('profiles').delete().eq('id', user_id);
    const { error } = await adminClient.auth.admin.deleteUser(user_id);
    if (error) {
      // Profile already gone; report but don't fail hard
      return NextResponse.json({ success: true, note: `Profile removed; auth deletion: ${error.message}` });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error removing user.' }, { status: 500 });
  }
}
