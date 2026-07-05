import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { user_id, new_password } = await req.json();
    if (!new_password || new_password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured.' }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is super_admin
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user?.id).single();
    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admins can reset passwords.' }, { status: 403 });
    }

    // Verify target user is in the same company
    const { data: target } = await adminClient.from('profiles').select('company_id').eq('id', user_id).single();
    if (!target || target.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'User not found in your company.' }, { status: 404 });
    }

    const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
