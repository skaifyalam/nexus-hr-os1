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

  // Logged in — check if onboarding needed
  if (session && !isOnboarding) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', session.user.id)
      .single();

    if (profile) {
      let needsOnboarding = false;
      if (profile.company_id) {
        const { data: company } = await supabase
          .from('company_profile')
          .select('onboarding_complete')
          .eq('id', profile.company_id)
          .single();
        needsOnboarding = !company?.onboarding_complete;
      } else {
        needsOnboarding = true;
      }
      if (needsOnboarding) {
        return NextResponse.redirect(new URL('/onboarding', req.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
