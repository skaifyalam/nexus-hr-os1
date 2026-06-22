'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Briefcase, GitBranch, Building2, User, LogOut, Globe,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/requisitions', label: 'Requisitions', icon: Briefcase },
];

const ADMIN_NAV = [
  { href: '/settings/operations', label: 'Countries & Projects', icon: Globe },
];

export default function Shell({
  current,
  profile,
  children,
}: {
  current: string;
  profile: { full_name?: string; email?: string; role?: string } | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  };

  const roleLabel = (profile?.role || 'employee').replace(/_/g, ' ');

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="w-56 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0">
        <div className="px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">NEXUS HR</p>
              <p className="text-xs text-slate-400">Enterprise Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                current === item.href
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <item.icon size={14} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}

          {profile?.role === 'agency_user' ? (
            <Link
              href="/agency"
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                current === '/agency' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Building2 size={14} />
              <span className="text-xs font-medium">Agency Pipeline</span>
            </Link>
          ) : (
            <Link
              href="/recruitment"
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                current === '/recruitment' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <GitBranch size={14} />
              <span className="text-xs font-medium">Recruitment Pipeline</span>
            </Link>
          )}

          {profile?.role && ['super_admin', 'hr_director'].includes(profile.role) && (
            <>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-slate-300 uppercase tracking-wider">Admin</p>
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                    current === item.href
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <item.icon size={14} />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
              <User size={13} className="text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-slate-400 capitalize">{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="p-7 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
