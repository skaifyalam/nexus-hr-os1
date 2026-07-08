import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;
  const isAuthPage = path.startsWith('/login');
  const isOnboarding = path.startsWith('/onboarding');
  // Public routes that do NOT require login (landing page + its chat API)
  const isPublic = path === '/' || path.startsWith('/api/landing-chat');

  // Not logged in — send to login (except public routes and the login page itself)
  if (!session && !isAuthPage && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Logged in and on login page — send to dashboard
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Logged in — check if onboarding needed.
  // Only FORCE onboarding for genuinely new users who have NO company at all.
  // If the user has a company but it's mid-setup, we do NOT trap them — they can
  // still reach the dashboard and other companies (escape is always possible).
  if (session && !isOnboarding) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', session.user.id)
      .single();

    // Only redirect to onboarding if the user has NO company assigned at all.
    if (profile && !profile.company_id) {
      // Does the user belong to any company via memberships they could switch into?
      const { data: memberships } = await supabase
        .from('company_memberships')
        .select('company_id')
        .eq('user_id', session.user.id)
        .limit(1);
      if (!memberships || memberships.length === 0) {
        return NextResponse.redirect(new URL('/onboarding', req.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
