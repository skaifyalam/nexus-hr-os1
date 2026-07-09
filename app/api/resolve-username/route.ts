import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Resolves a username to its login email (plain table read, no admin API).
export async function POST(req: Request) {
  try {
    const { username } = await req.json().catch(() => ({}));
    if (!username || !username.trim()) return NextResponse.json({ email: null });

    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const svc = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    const key = svc || anon;
    if (!url || !key) return NextResponse.json({ email: null });

    const client = createClient(url, key, { auth: { persistSession: false } });
    const clean = username.trim().toLowerCase();

    const { data: profiles } = await client.from('profiles')
      .select('login_email').eq('username', clean).not('login_email', 'is', null).limit(1);
    if (profiles && profiles.length > 0 && profiles[0].login_email) {
      return NextResponse.json({ email: profiles[0].login_email });
    }
    return NextResponse.json({ email: null });
  } catch {
    return NextResponse.json({ email: null });
  }
}
