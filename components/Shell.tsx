'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Briefcase, GitBranch, Building2,
  User, LogOut, Globe, Hash, UserCog, Settings, Brain,
  BarChart3, Presentation, Plus, X, Folder, Check,
  Calendar, TrendingUp, AlertTriangle, DoorOpen, Loader,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const ICON_MAP: Record<string, any> = {
  dashboard: LayoutDashboard, employees: Users, requisitions: Briefcase,
  recruitment: GitBranch, agency: Building2, brain: Brain,
  reports: BarChart3, boardroom: Presentation, leave: Calendar,
  performance: TrendingUp, disciplinary: AlertTriangle, exit: DoorOpen,
  folder: Folder, building: Building2, globe: Globe, users: Users,
  settings: Settings, default: Folder,
};

const CORE_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/employees', label: 'Employees', icon: 'employees' },
];

const MODULE_ROUTES: Record<string, string> = {
  recruitment: '/recruitment',
  leave: '/leaves',
  performance: '/performance',
  disciplinary: '/disciplinary',
  exit: '/exits',
};

const ADMIN_NAV = [
  { href: '/settings/operations', label: 'Countries & Projects', icon: 'globe', superOnly: false },
  { href: '/settings/departments', label: 'Departments', icon: 'settings', superOnly: false },
  { href: '/settings/agencies', label: 'Agencies', icon: 'building', superOnly: false },
  { href: '/settings/users', label: 'User Management', icon: 'users', superOnly: true },
  { href: '/settings/id-formats', label: 'ID Formats', icon: 'hash', superOnly: true },
];

export default function Shell({
  current, profile, children,
}: {
  current: string;
  profile: { full_name?: string; email?: string; role?: string } | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [modules, setModules] = useState<any[]>([]);
  const [customSections, setCustomSections] = useState<any[]>([]);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [adding, setAdding] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: mods }, { data: sections }] = await Promise.all([
        supabase.from('installed_modules').select('*').order('sidebar_order'),
        supabase.from('custom_sections').select('*').order('sidebar_order'),
      ]);
      setModules(mods || []);
      setCustomSections(sections || []);
      setLoaded(true);
    };
    load();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const addSection = async () => {
    if (!newSectionName.trim()) return;
    setAdding(true);
    const { data } = await supabase.from('custom_sections').insert({
      name: newSectionName.trim(),
      icon: 'folder',
      sidebar_order: 99,
    }).select().single();
    if (data) {
      setCustomSections((p) => [...p, data]);
      router.push(`/sections/${data.id}`);
    }
    setNewSectionName('');
    setAddSectionOpen(false);
    setAdding(false);
  };

  const isActive = (href: string) => current === href || current.startsWith(href + '/');

  const NavLink = ({ href, label, icon }: { href: string; label: string; icon: string }) => {
    const Icon = ICON_MAP[icon] || ICON_MAP.default;
    return (
      <Link href={href} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left ${isActive(href) ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
        <Icon size={14} />
        <span className="text-xs font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="w-56 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0">
        {/* Logo */}
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
          {/* Core */}
          {CORE_NAV.map((item) => <NavLink key={item.href} {...item} />)}

          {/* Requisitions always shown */}
          <NavLink href="/requisitions" label="Requisitions" icon="requisitions" />

          {/* Installed modules */}
          {modules.map((mod) => (
            <NavLink
              key={mod.module_key}
              href={MODULE_ROUTES[mod.module_key] || `/${mod.module_key}`}
              label={mod.label}
              icon={mod.module_key}
            />
          ))}

          {/* Company Brain + Reports + Boardroom always shown */}
          <NavLink href="/brain" label="Company Brain" icon="brain" />
          <NavLink href="/reports" label="AI Reports" icon="reports" />
          <NavLink href="/boardroom" label="AI Boardroom" icon="boardroom" />

          {/* Custom sections */}
          {customSections.length > 0 && (
            <>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-slate-300 uppercase tracking-wider">Custom</p>
              {customSections.map((cs) => (
                <NavLink
                  key={cs.id}
                  href={`/sections/${cs.id}`}
                  label={cs.name}
                  icon={cs.icon || 'folder'}
                />
              ))}
            </>
          )}

          {/* Add custom section button */}
          {!addSectionOpen ? (
            <button onClick={() => setAddSectionOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all mt-1">
              <Plus size={14} />
              <span className="text-xs font-medium">Add Section</span>
            </button>
          ) : (
            <div className="px-2 pt-2 space-y-1.5">
              <input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSection()}
                placeholder="Section name…"
                autoFocus
                className="w-full border border-indigo-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-1">
                <button onClick={addSection} disabled={adding || !newSectionName.trim()} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-50">
                  {adding ? <Loader size={11} className="animate-spin" /> : <Check size={11} />} Add
                </button>
                <button onClick={() => { setAddSectionOpen(false); setNewSectionName(''); }} className="p-1.5 bg-slate-100 rounded-lg text-slate-500 hover:bg-slate-200">
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Admin */}
          {profile?.role && ['super_admin', 'hr_director'].includes(profile.role) && (
            <>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-slate-300 uppercase tracking-wider">Admin</p>
              {ADMIN_NAV
                .filter((item) => !item.superOnly || profile.role === 'super_admin')
                .map((item) => {
                  const Icon = ICON_MAP[item.icon] || Settings;
                  return (
                    <Link key={item.href} href={item.href} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${isActive(item.href) ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                      <Icon size={14} />
                      <span className="text-xs font-medium">{item.label}</span>
                    </Link>
                  );
                })}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
              <User size={13} className="text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-slate-400 capitalize">{profile?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors">
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
