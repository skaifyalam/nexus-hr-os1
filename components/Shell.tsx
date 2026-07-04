'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Briefcase, GitBranch, Building2,
  User, LogOut, Globe, Hash, UserCog, Settings, Brain,
  BarChart3, Presentation, Plus, X, Folder, Check, Loader, Layout, TrendingUp, ChevronsUpDown, Palmtree,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Assistant from './Assistant';

const ICON_MAP: Record<string, any> = {
  dashboard: LayoutDashboard, employees: Users, requisitions: Briefcase,
  recruitment: GitBranch, agency: Building2, brain: Brain,
  reports: BarChart3, boardroom: Presentation,
  folder: Folder, building: Building2, globe: Globe, users: Users,
  settings: Settings, layout: Layout, default: Folder,
};

const ADMIN_NAV = [
  { href: '/settings/operations', label: 'Countries & Projects', icon: 'globe', superOnly: false },
  { href: '/settings/departments', label: 'Departments', icon: 'settings', superOnly: false },
  { href: '/settings/agencies', label: 'Agencies', icon: 'building', superOnly: false },
  { href: '/settings/users', label: 'User Management', icon: 'users', superOnly: true },
  { href: '/settings/id-formats', label: 'ID Formats', icon: 'hash', superOnly: true },
];

export default function Shell({
  current, profile, children, sections = [], companyId = '',
}: {
  current: string;
  profile: { full_name?: string; email?: string; role?: string } | null;
  children: React.ReactNode;
  sections?: any[];
  companyId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [secs, setSecs] = useState(sections);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  // Multi-company switcher
  const [memberships, setMemberships] = useState<any[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [newCoOpen, setNewCoOpen] = useState(false);
  const [newCoName, setNewCoName] = useState('');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('company_memberships')
        .select('company_id, role, company_profile(company_name)');
      if (data) setMemberships(data);
    })();
  }, []);

  const switchCompany = async (targetId: string) => {
    if (targetId === companyId) { setSwitcherOpen(false); return; }
    setSwitching(true);
    const { data: ok } = await supabase.rpc('switch_company', { target_company_id: targetId });
    if (ok) window.location.href = '/dashboard';
    else setSwitching(false);
  };

  const createCompany = async () => {
    if (!newCoName.trim()) return;
    setSwitching(true);
    const { data } = await supabase.rpc('create_additional_company', { p_name: newCoName.trim() });
    if (data) window.location.href = '/onboarding';
    else setSwitching(false);
  };

  const signOut = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const addSection = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const key = newName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);
    const { data, error } = await supabase.from('company_sections').insert({
      company_id: companyId || undefined,
      section_key: key,
      label: newName.trim(),
      icon: 'folder',
      is_core: false,
      view_type: 'table',
      sidebar_order: 50,
    }).select().single();
    if (data) { setSecs(p => [...p, data]); router.push(`/s/${data.section_key}`); }
    if (error) console.error('Add section:', error.message);
    setNewName(''); setAddOpen(false); setAdding(false);
  };

  const isActive = (href: string) => current === href || current.startsWith(href + '/');

  const coreLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="w-56 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0">
        <div className="px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <div><p className="text-sm font-bold text-slate-900">NEXUS HR</p><p className="text-xs text-slate-400">Enterprise Platform</p></div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {/* Dashboard */}
          <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive('/dashboard') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <LayoutDashboard size={14} />Dashboard
          </Link>

          {/* All sections from company_sections (Employees, Recruitment, custom) */}
          {secs.map(s => {
            const Icon = ICON_MAP[s.icon] || Folder;
            const href = s.section_key === 'requisition' ? '/requisitions' : `/s/${s.section_key}`;
            return (
              <Link key={s.id} href={href} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive(href) ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Icon size={14} />{s.label}
              </Link>
            );
          })}

          {/* Fixed AI features */}
          <Link href="/brain" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive('/brain') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Brain size={14} />Company Brain
          </Link>
          <Link href="/reports" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive('/reports') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <BarChart3 size={14} />AI Reports
          </Link>
          <Link href="/compliance" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive('/compliance') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Globe size={14} />Compliance
          </Link>
          <Link href="/analytics" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive('/analytics') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <TrendingUp size={14} />Delay Analysis
          </Link>
          <Link href="/structure" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive('/structure') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <GitBranch size={14} />Org Structure
          </Link>
          <Link href="/leave" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive('/leave') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Palmtree size={14} />Leave
          </Link>

          {/* Add Section */}
          {!addOpen ? (
            <button onClick={() => setAddOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all mt-1 text-xs font-medium">
              <Plus size={14} />Add Section
            </button>
          ) : (
            <div className="px-1 pt-2 space-y-1.5">
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSection()} placeholder="Section name…" autoFocus className="w-full border border-indigo-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-1">
                <button onClick={addSection} disabled={adding || !newName.trim()} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-50">
                  {adding ? <Loader size={11} className="animate-spin" /> : <Check size={11} />}Add
                </button>
                <button onClick={() => { setAddOpen(false); setNewName(''); }} className="p-1.5 bg-slate-100 rounded-lg text-slate-500"><X size={13} /></button>
              </div>
            </div>
          )}

          {/* Admin */}
          {profile?.role && ['super_admin', 'hr_director'].includes(profile.role) && (
            <>
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-slate-300 uppercase tracking-wider">Admin</p>
              {ADMIN_NAV.filter(item => !item.superOnly || profile.role === 'super_admin').map(item => {
                const Icon = ICON_MAP[item.icon] || Settings;
                return (
                  <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive(item.href) ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                    <Icon size={14} />{item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-slate-100">
          {/* Company switcher */}
          {memberships.length > 0 && (
            <div className="relative mb-3">
              <button onClick={() => setSwitcherOpen(!switcherOpen)} className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100">
                <span className="flex items-center gap-2 min-w-0">
                  <Building2 size={13} className="text-indigo-500 flex-shrink-0" />
                  <span className="truncate">{(memberships.find(m => m.company_id === companyId) as any)?.company_profile?.company_name || 'Company'}</span>
                </span>
                <ChevronsUpDown size={12} className="text-slate-400 flex-shrink-0" />
              </button>
              {switcherOpen && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
                  {memberships.map((m: any) => (
                    <button key={m.company_id} onClick={() => switchCompany(m.company_id)} disabled={switching}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 ${m.company_id === companyId ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600'}`}>
                      <Building2 size={12} className="flex-shrink-0" />
                      <span className="truncate">{m.company_profile?.company_name || 'Unnamed'}</span>
                      {m.company_id === companyId && <Check size={12} className="ml-auto flex-shrink-0" />}
                    </button>
                  ))}
                  <button onClick={() => { setSwitcherOpen(false); setNewCoOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 border-t border-slate-100 font-medium">
                    <Plus size={12} />New Company
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center"><User size={13} className="text-indigo-600" /></div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-slate-400 capitalize">{profile?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut size={13} />Sign Out
          </button>
        </div>
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="p-7 max-w-6xl">{children}</div>
      </main>
      <Assistant />

      {/* New Company modal */}
      {newCoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setNewCoOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">New Company</h2>
            <p className="text-xs text-slate-500 mb-4">Creates a separate workspace with its own data, sections, and settings. Switch between companies anytime from the sidebar.</p>
            <input value={newCoName} onChange={e => setNewCoName(e.target.value)} placeholder="Company name" autoFocus
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setNewCoOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={createCompany} disabled={switching || !newCoName.trim()} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">
                {switching ? 'Creating…' : 'Create & Switch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
