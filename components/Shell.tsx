'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Briefcase, GitBranch, Building2,
  User, LogOut, Globe, Hash, UserCog, Settings, Brain,
  BarChart3, Presentation, Plus, X, Folder, Check, Loader, Layout, TrendingUp, ChevronsUpDown, Palmtree, CreditCard, GripVertical, Edit2, Clock, Award, FileText, ShieldAlert, MessageSquareWarning,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Assistant from './Assistant';

const FEATURE_ICONS: Record<string, any> = {
  compliance: Globe, analytics: TrendingUp, structure: GitBranch,
  leave: Palmtree, attendance: Clock, performance: Award, documents: FileText, visa: CreditCard, approvals: GitBranch, conduct: ShieldAlert, grievances: MessageSquareWarning,
};

const DEFAULT_FEATURES = [
  { key: 'compliance', label: 'Compliance', href: '/compliance' },
  { key: 'analytics', label: 'Delay Analysis', href: '/analytics' },
  { key: 'structure', label: 'Org Structure', href: '/structure' },
  { key: 'leave', label: 'Leave', href: '/leave' },
  { key: 'attendance', label: 'Attendance', href: '/attendance' },
  { key: 'performance', label: 'Performance', href: '/performance' },
  { key: 'documents', label: 'Documents', href: '/documents' },
  { key: 'visa', label: 'Visa Management', href: '/visa' },
  { key: 'approvals', label: 'Approvals', href: '/approvals' },
  { key: 'conduct', label: 'Conduct & Exit', href: '/conduct' },
  { key: 'grievances', label: 'Grievances', href: '/grievances' },
];

const ICON_MAP: Record<string, any> = {
  dashboard: LayoutDashboard, employees: Users, requisitions: Briefcase,
  recruitment: GitBranch, agency: Building2, brain: Brain,
  reports: BarChart3, boardroom: Presentation,
  folder: Folder, building: Building2, globe: Globe, users: Users,
  settings: Settings, layout: Layout, default: Folder,
  card: CreditCard, hash: Hash, branch: GitBranch,
};

const ADMIN_NAV = [
  { href: '/settings/operations', label: 'Countries & Projects', icon: 'globe', superOnly: false },
  { href: '/settings/departments', label: 'Departments', icon: 'settings', superOnly: false },
  { href: '/settings/agencies', label: 'Agencies', icon: 'building', superOnly: false },
  { href: '/settings/roles', label: 'Roles & Users', icon: 'users', superOnly: true },
  { href: '/settings/approvals', label: 'Approval Workflows', icon: 'branch', superOnly: true },
  { href: '/settings/id-formats', label: 'ID Formats', icon: 'hash', superOnly: true },
];

export default function Shell({
  current, profile, children, sections = [], companyId = '',
}: {
  current: string;
  profile: { id?: string; full_name?: string; email?: string; role?: string; company_name?: string } | null;
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
        .select('company_id, role, company_profile(name)');
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

  const [createErr, setCreateErr] = useState('');
  const createCompany = async () => {
    if (!newCoName.trim()) return;
    // Do NOT create the company yet — carry the name into the wizard.
    // The company is only written to the database when the user clicks Finish.
    window.location.href = `/onboarding?new=1&name=${encodeURIComponent(newCoName.trim())}`;
  };

  const signOut = async () => { await supabase.auth.signOut(); router.push('/login'); };

  // Preserve main-content scroll position across refresh (per page)
  const mainRef = useRef<HTMLElement>(null);
  const saveScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMainScroll = () => {
    if (saveScrollTimer.current) clearTimeout(saveScrollTimer.current);
    // Debounce: persist the resting position once scrolling settles, not every tick.
    saveScrollTimer.current = setTimeout(() => {
      const el = mainRef.current;
      if (typeof window === 'undefined' || !el) return;
      // On reload, content re-renders in stages — a scroll event can fire while the
      // container is still short (nothing to scroll yet), reporting scrollTop 0 even
      // though the user was scrolled down before refreshing. Don't let that spurious
      // 0 clobber the real saved position.
      if (el.scrollTop === 0 && el.scrollHeight <= el.clientHeight) return;
      try { sessionStorage.setItem(`scroll:${window.location.pathname}`, String(el.scrollTop)); } catch {}
    }, 150);
  };
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `scroll:${window.location.pathname}`;
    const saved = sessionStorage.getItem(key);
    const target = saved ? Number(saved) : 0;
    if (!target) return;

    // Content height isn't always ready on the very next frame after reload (data
    // still rendering in), so re-apply a few times over ~500ms rather than once.
    const delays = [0, 100, 250, 500];
    const timers: ReturnType<typeof setTimeout>[] = [];
    delays.forEach(delay => {
      const apply = () => { if (mainRef.current) mainRef.current.scrollTop = target; };
      if (delay === 0) requestAnimationFrame(apply);
      else timers.push(setTimeout(apply, delay));
    });
    return () => { timers.forEach(clearTimeout); if (saveScrollTimer.current) clearTimeout(saveScrollTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [dragSec, setDragSec] = useState<string | null>(null);
  const [dragOverSec, setDragOverSec] = useState<string | null>(null);
  const [renamingSec, setRenamingSec] = useState<string | null>(null);

  // Feature links (Compliance, Leave, etc.) — reorderable + renamable via localStorage
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [dragFeature, setDragFeature] = useState<string | null>(null);
  const [dragOverFeature, setDragOverFeature] = useState<string | null>(null);
  const [renamingFeature, setRenamingFeature] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      // Only load custom labels (company-wide). Order is ALWAYS the fixed default.
      const { data: labels } = await supabase.from('feature_labels').select('feature_key, label').eq('company_id', companyId);
      const list = DEFAULT_FEATURES.map(f => {
        const custom = labels?.find((l: any) => l.feature_key === f.key);
        return { ...f, label: custom?.label || f.label };
      });
      setFeatures(prev => {
        const same = prev.length === list.length && prev.every((p, i) => p.key === list[i].key && p.label === list[i].label);
        return same ? prev : list;
      });
    })();
  }, [companyId]);

  const isSuperAdmin = profile?.role === 'super_admin';

  // Load this user's role permissions (non-super users) to gate feature visibility
  const [rolePerms, setRolePerms] = useState<any>(null);
  useEffect(() => {
    if (isSuperAdmin || !(profile as any)?.custom_role_id) return;
    (async () => {
      const { data } = await supabase.from('custom_roles').select('permissions').eq('id', (profile as any).custom_role_id).maybeSingle();
      if (data) setRolePerms(data.permissions || {});
    })();
  }, []);

  const featureVisible = (key: string) => {
    if (isSuperAdmin || !rolePerms?.features) return true;
    const access = rolePerms.features[key];
    return access === undefined || access !== 'none';
  };

  const saveUserOrder = async (list: any[]) => {
    if (!companyId) return;
    const keys = list.map(f => f.key);
    await supabase.from('user_feature_order').upsert(
      { user_id: profile?.id, company_id: companyId, ordered_keys: keys, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,company_id' }
    );
  };

  const reorderFeature = (targetKey: string) => {
    setDragOverFeature(null);
    if (!dragFeature || dragFeature === targetKey) { setDragFeature(null); return; }
    const list = [...features];
    const from = list.findIndex(f => f.key === dragFeature);
    const to = list.findIndex(f => f.key === targetKey);
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setFeatures(list);
    saveUserOrder(list); // per-user, follows them across devices
    setDragFeature(null);
  };

  const renameFeature = async (key: string, newLabel: string) => {
    const label = newLabel.trim();
    setRenamingFeature(null);
    if (!label || !isSuperAdmin) return; // only super admin can rename (shared for all)
    setFeatures(features.map(f => f.key === key ? { ...f, label } : f));
    await supabase.from('feature_labels').upsert(
      { company_id: companyId, feature_key: key, label },
      { onConflict: 'company_id,feature_key' }
    );
  };
  const [sidebarWidth, setSidebarWidth] = useState(224); // default w-56 = 224px

  // Load saved width once on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('nexus_sidebar_width') : null;
    if (saved) { const n = parseInt(saved); if (n >= 180 && n <= 420) setSidebarWidth(n); }
  }, []);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(420, Math.max(180, startW + (ev.clientX - startX)));
      setSidebarWidth(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setSidebarWidth(w => { try { window.localStorage.setItem('nexus_sidebar_width', String(w)); } catch {} return w; });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const renameSection = async (s: any, newLabel: string) => {
    const label = newLabel.trim();
    setRenamingSec(null);
    if (!label || label === s.label) return;
    await supabase.from('company_sections').update({ label }).eq('id', s.id);
    setSecs(p => p.map(x => x.id === s.id ? { ...x, label } : x));
  };

  const reorderSection = async (targetId: string) => {
    setDragOverSec(null);
    if (!dragSec || dragSec === targetId) { setDragSec(null); return; }
    const list = [...secs];
    const from = list.findIndex(s => s.id === dragSec);
    const to = list.findIndex(s => s.id === targetId);
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setSecs(list);
    setDragSec(null);
    // Persist new sidebar_order
    await Promise.all(list.map((s, i) =>
      supabase.from('company_sections').update({ sidebar_order: i }).eq('id', s.id)
    ));
  };

  const deleteSection = async (s: any) => {
    // Check the section is empty first
    const { count } = await supabase.from('section_records')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('section_key', s.section_key);
    if ((count || 0) > 0) {
      alert(`"${s.label}" still has ${count} record${count !== 1 ? 's' : ''}. Clear its data first (open the section → select all → delete), then you can remove the section.`);
      return;
    }
    if (!confirm(`Delete the "${s.label}" section? This can't be undone.`)) return;
    // Remove the section and its field configs
    await supabase.from('section_field_configs').delete()
      .eq('company_id', companyId).eq('section_key', s.section_key);
    await supabase.from('company_sections').delete().eq('id', s.id);
    setSecs(p => p.filter(x => x.id !== s.id));
    if (current === `/s/${s.section_key}`) router.push('/dashboard');
  };

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
      <div style={{ width: sidebarWidth }} className="flex-shrink-0 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0 relative">
        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-200 active:bg-indigo-400 transition-colors z-20 group/resize"
        >
          <div className="absolute top-1/2 -translate-y-1/2 right-0 w-1 h-8 bg-slate-200 rounded-full opacity-0 group-hover/resize:opacity-100 transition-opacity" />
        </div>
        <div className="px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)' }}>
              <span className="text-white text-sm font-bold">N</span>
            </div>
            <div><p className="text-sm font-bold" style={{ color: '#0F172A' }}>Naibus</p><p className="text-xs" style={{ color: '#06B6D4' }}>Business OS</p></div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {/* Dashboard */}
          <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive('/dashboard') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            <LayoutDashboard size={14} />Dashboard
          </Link>

          {/* All sections — drag handle to reorder, double-click to rename */}
          {secs.map(s => {
            const Icon = ICON_MAP[s.icon] || Folder;
            const href = s.section_key === 'requisition' ? '/requisitions' : `/s/${s.section_key}`;
            const isEditing = renamingSec === s.id;
            return (
              <div key={s.id} className="relative">
                <div
                  className={`group/sec flex items-center rounded-xl transition-all ${isActive(href) ? 'bg-indigo-600 shadow-sm' : 'hover:bg-slate-100'}`}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      defaultValue={s.label}
                      onBlur={e => renameSection(s, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameSection(s, (e.target as HTMLInputElement).value);
                        if (e.key === 'Escape') setRenamingSec(null);
                      }}
                      className="flex-1 bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs mr-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                    />
                  ) : (
                    <Link
                      href={href}
                      onDoubleClick={e => { if (isSuperAdmin) { e.preventDefault(); setRenamingSec(s.id); } }}
                      className={`flex items-center gap-3 flex-1 min-w-0 pl-3 pr-2 py-2 text-xs font-medium ${isActive(href) ? 'text-white' : 'text-slate-600'}`}
                    >
                      <Icon size={14} className="flex-shrink-0" />
                      <span className="flex-1 truncate">{s.label}</span>
                    </Link>
                  )}

                  {!isEditing && (
                    <div className="flex items-center pr-1.5 opacity-0 group-hover/sec:opacity-100 transition-opacity">
                      {isSuperAdmin && (
                        <button onClick={(e) => { e.preventDefault(); setRenamingSec(s.id); }} title="Rename (applies to everyone)" className={`p-1 rounded ${isActive(href) ? 'hover:bg-white/20 text-white/70' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-600'}`}>
                          <Edit2 size={11} />
                        </button>
                      )}
                      {!s.is_core && !['employee','candidate','requisition'].includes(s.section_key) && isSuperAdmin && (
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteSection(s); }} title="Delete (if empty)" className={`p-1 rounded ${isActive(href) ? 'hover:bg-white/20 text-white/70' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}>
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Movable + renamable feature links */}
          {features.filter(f => featureVisible(f.key)).map(f => {
            const Icon = FEATURE_ICONS[f.key] || Folder;
            const isEditing = renamingFeature === f.key;
            return (
              <div key={f.key} className="relative">
                <div
                  className={`group/feat flex items-center rounded-xl transition-all ${isActive(f.href) ? 'bg-indigo-600 shadow-sm' : 'hover:bg-slate-100'}`}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      defaultValue={f.label}
                      onBlur={e => renameFeature(f.key, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameFeature(f.key, (e.target as HTMLInputElement).value);
                        if (e.key === 'Escape') setRenamingFeature(null);
                      }}
                      className="flex-1 bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs mr-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                    />
                  ) : (
                    <Link
                      href={f.href}
                      onDoubleClick={e => { if (isSuperAdmin) { e.preventDefault(); setRenamingFeature(f.key); } }}
                      className={`flex items-center gap-3 flex-1 min-w-0 pl-3 pr-2 py-2 text-xs font-medium ${isActive(f.href) ? 'text-white' : 'text-slate-600'}`}
                    >
                      <Icon size={14} className="flex-shrink-0" />
                      <span className="flex-1 truncate">{f.label}</span>
                    </Link>
                  )}
                  {!isEditing && isSuperAdmin && (
                    <button onClick={(e) => { e.preventDefault(); setRenamingFeature(f.key); }} title="Rename (applies to everyone)" className={`mr-1.5 p-1 rounded opacity-0 group-hover/feat:opacity-100 transition-opacity ${isActive(f.href) ? 'hover:bg-white/20 text-white/70' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-600'}`}>
                      <Edit2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Fixed: Company Brain + AI Reports — pinned to bottom, never movable/renamable */}
          {featureVisible('brain') && (
            <Link href="/brain" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive('/brain') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Brain size={14} />Company Brain
            </Link>
          )}
          {featureVisible('reports') && (
            <Link href="/reports" className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs font-medium ${isActive('/reports') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              <BarChart3 size={14} />AI Reports
            </Link>
          )}

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
          {/* Company switcher — always available to super admins */}
          {(memberships.length > 0 || isSuperAdmin) && (
            <div className="relative mb-3">
              <button onClick={() => setSwitcherOpen(!switcherOpen)} className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100">
                <span className="flex items-center gap-2 min-w-0">
                  <Building2 size={13} className="text-indigo-500 flex-shrink-0" />
                  <span className="truncate">{(memberships.find(m => m.company_id === companyId) as any)?.company_profile?.name || 'My Company'}</span>
                </span>
                <ChevronsUpDown size={12} className="text-slate-400 flex-shrink-0" />
              </button>
              {switcherOpen && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
                  {memberships.map((m: any) => (
                    <button key={m.company_id} onClick={() => switchCompany(m.company_id)} disabled={switching}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 ${m.company_id === companyId ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600'}`}>
                      <Building2 size={12} className="flex-shrink-0" />
                      <span className="truncate">{m.company_profile?.name || 'Unnamed'}</span>
                      {m.company_id === companyId && <Check size={12} className="ml-auto flex-shrink-0" />}
                    </button>
                  ))}
                  {isSuperAdmin && (
                    <button onClick={() => { setSwitcherOpen(false); setNewCoOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 border-t border-slate-100 font-medium">
                      <Plus size={12} />New Company
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <Link href="/account" className="flex items-center gap-2.5 mb-3 p-1.5 -m-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center"><User size={13} className="text-indigo-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-700 truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-slate-400 capitalize">{profile?.role?.replace(/_/g, ' ')}</p>
            </div>
            <Settings size={13} className="text-slate-300 flex-shrink-0" />
          </Link>
          <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut size={13} />Sign Out
          </button>
        </div>
      </div>
      <main ref={mainRef} className="flex-1 overflow-y-auto" onScroll={handleMainScroll}>
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
            {createErr && <p className="text-xs text-red-500 mb-3">{createErr}</p>}
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
