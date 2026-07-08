import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import LandingPage from './LandingPage';

export default async function Home() {
  // Logged-in users go straight to the app; visitors see the landing page.
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect('/dashboard');
  } catch { /* not logged in — show landing */ }
  return <LandingPage />;
}
