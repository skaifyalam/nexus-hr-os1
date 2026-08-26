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

    if (profile?.company_id) {
      // Has a company — send to the wizard only if it hasn't been set up yet
      // (a brand-new company starts with onboarding_complete = false; the
      // wizard flips it to true on Finish, so this never traps them after).
      const { data: company } = await supabase
        .from('company_profile')
        .select('onboarding_complete')
        .eq('id', profile.company_id)
        .single();
      if (company && !company.onboarding_complete) {
        return NextResponse.redirect(new URL('/onboarding', req.url));
      }
    } else if (profile) {
      // No company at all — onboard unless they can switch into an existing one.
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
