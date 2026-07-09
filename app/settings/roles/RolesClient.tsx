'use client';
import { useState, useEffect } from 'react';
import { Plus, X, Shield, Mail, Loader, Check, Users, Key, Trash2, Edit2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function RolesClient({ initialRoles, initialProfiles, companyId, currentUserId, sections = [], empFields = [], projectField = '', projectValues = [] }: {
  initialRoles: any[]; initialProfiles: any[]; companyId: string; currentUserId: string; sections?: any[]; empFields?: any[]; projectField?: string; projectValues?: string[];
}) {
  const [roles, setRoles] = useState(initialRoles);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#roles') setTab('roles');
  }, []);
  const switchTab = (t: 'users' | 'roles') => {
    setTab(t);
    if (typeof window !== 'undefined') window.location.hash = t === 'roles' ? 'roles' : '';
  };
  const [projField, setProjField] = useState(projectField);
  const supabase = createClient();

  const saveProjectField = async (key: string) => {
    setProjField(key);
    await supabase.from('company_profile').update({ project_field_key: key || null }).eq('id', companyId);
  };

  // Per-user project scope
  const [scopeUser, setScopeUser] = useState<any>(null);
  const [scopeVals, setScopeVals] = useState<string[]>([]);
  const openScope = (u: any) => { setScopeVals(u.project_scope || []); setScopeUser(u); };
  const saveScope = async () => {
    await supabase.from('profiles').update({ project_scope: scopeVals }).eq('id', scopeUser.id);
    setProfiles(p => p.map(u => u.id === scopeUser.id ? { ...u, project_scope: scopeVals } : u));
    setScopeUser(null);
  };

  // Catalog of things a role's access can be set on
  const FEATURES = [
    { key: 'compliance', label: 'Compliance' },
    { key: 'analytics', label: 'Delay Analysis' },
    { key: 'structure', label: 'Org Structure' },
    { key: 'leave', label: 'Leave' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'performance', label: 'Performance' },
    { key: 'documents', label: 'Documents' },
    { key: 'visa', label: 'Visa Management' },
    { key: 'conduct', label: 'Conduct & Exit' },
    { key: 'grievances', label: 'Grievances' },
    { key: 'brain', label: 'Company Brain' },
    { key: 'reports', label: 'AI Reports' },
  ];
  const ACCESS = [
    { v: 'none', label: 'Hidden' },
    { v: 'view', label: 'View only' },
    { v: 'apply', label: 'View & apply' },
    { v: 'approve', label: 'View, apply & approve' },
  ];

  // ─── Permission editor ───
  const [permRole, setPermRole] = useState<any>(null);
  const [permFeatures, setPermFeatures] = useState<Record<string, string>>({});
  const [permSections, setPermSections] = useState<Record<string, string>>({});
  const [permConfidential, setPermConfidential] = useState<string[]>([]);
  const [savingPerm, setSavingPerm] = useState(false);

  const openPerms = (r: any) => {
    const p = r.permissions || {};
    setPermFeatures(p.features || {});
    setPermSections(p.sections || {});
    setPermConfidential(p.confidential_fields || []);
    setPermRole(r);
  };
  const savePerms = async () => {
    setSavingPerm(true);
    const permissions = { features: permFeatures, sections: permSections, confidential_fields: permConfidential };
    const { data } = await supabase.from('custom_roles').update({ permissions }).eq('id', permRole.id).select().single();
    if (data) setRoles(p => p.map(r => r.id === permRole.id ? data : r));
    setSavingPerm(false); setPermRole(null);
  };

  // ─── Roles ───
  const [roleOpen, setRoleOpen] = useState(false);
  const [rName, setRName] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  const addRole = async () => {
    if (!rName.trim()) return;
    setSavingRole(true);
    const { data, error } = await supabase.from('custom_roles').insert({
      company_id: companyId, name: rName.trim(), description: rDesc.trim(), permissions: {},
    }).select().single();
    setSavingRole(false);
    if (data) { setRoles(p => [...p, data]); setRName(''); setRDesc(''); setRoleOpen(false); }
    if (error) alert(error.message);
  };

  const deleteRole = async (id: string) => {
    if (!confirm('Delete this role? Users with it will keep access until reassigned.')) return;
    await supabase.from('custom_roles').delete().eq('id', id);
    setRoles(p => p.filter(r => r.id !== id));
  };

  // ─── Create user (username + password, no email) ───
  const [inviteOpen, setInviteOpen] = useState(false);
  const [iUsername, setIUsername] = useState('');
  const [iPassword, setIPassword] = useState('');
  const [iRoleId, setIRoleId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const inviteUser = async () => {
    if (!iUsername.trim() || !iPassword.trim()) return;
    setInviting(true); setInviteMsg('');
    try {
      const res = await fetch('/api/create-username-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: iUsername.trim(), password: iPassword, role: 'employee', custom_role_id: iRoleId || null }),
      });
      const json = await res.json().catch(() => ({ error: 'Server returned an unreadable response.' }));
      if (!res.ok) {
        let msg = json.error;
        if (!msg || typeof msg === 'object') msg = JSON.stringify(json) || 'Request failed.';
        setInviteMsg(String(msg)); setInviting(false); return;
      }
      setInviteMsg(`✓ User "${json.username}" created. They can log in with this username and the password you set.`);
      setIUsername(''); setIPassword(''); setIRoleId('');
    } catch (e: any) { setInviteMsg(e.message); }
    setInviting(false);
  };

  // ─── Reset password ───
  const [resetUser, setResetUser] = useState<any>(null);
  const [newPw, setNewPw] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetting, setResetting] = useState(false);

  const doReset = async () => {
    if (newPw.length < 6) { setResetMsg('Password must be at least 6 characters.'); return; }
    setResetting(true); setResetMsg('');
    try {
      const res = await fetch('/api/reset-user-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: resetUser.id, new_password: newPw }),
      });
      const json = await res.json();
      if (!res.ok) { setResetMsg(json.error || 'Reset failed.'); setResetting(false); return; }
      setResetMsg('✓ Password updated.');
      setTimeout(() => { setResetUser(null); setNewPw(''); setResetMsg(''); }, 1800);
    } catch (e: any) { setResetMsg(e.message); }
    setResetting(false);
  };

  // ─── Assign role to existing user ───
  const assignRole = async (userId: string, roleId: string) => {
    await supabase.from('profiles').update({ custom_role_id: roleId || null }).eq('id', userId);
    setProfiles(p => p.map(u => u.id === userId ? { ...u, custom_role_id: roleId || null } : u));
  };

  const roleName = (id: string) => roles.find(r => r.id === id)?.name || '—';

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Roles & Users</h1>
        <p className="text-sm text-slate-500 mt-0.5">Create custom roles and invite your team by email</p>
      </div>

      <div className="flex gap-2 mb-5">
        <button onClick={() => switchTab('users')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'users' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Users</button>
        <button onClick={() => switchTab('roles')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'roles' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Roles</button>
      </div>

      {tab === 'users' && (
        <div>
          {/* Project field setting */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-slate-700">Project/Site field:</span>
              <select value={projField} onChange={e => saveProjectField(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">— None (no project scoping) —</option>
                {empFields.map((f: any) => <option key={f.field_key} value={f.field_key}>{f.field_label}</option>)}
              </select>
              <span className="text-xs text-slate-400">Pick which employee field represents project/site. Then scope users to specific projects below.</span>
            </div>
          </div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setInviteOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Mail size={14} />Invite User</button>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">User</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Role</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Projects</th>
                <th className="text-right text-xs font-medium text-slate-500 px-4 py-3">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {profiles.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">{u.full_name || u.email}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'super_admin' ? (
                        <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">Super Admin</span>
                      ) : (
                        <select value={u.custom_role_id || ''} onChange={e => assignRole(u.id, e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="">No role</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'super_admin' ? (
                        <span className="text-xs text-slate-400">All projects</span>
                      ) : !projField ? (
                        <span className="text-xs text-slate-300">—</span>
                      ) : (u.project_scope?.length > 0) ? (
                        <button onClick={() => openScope(u)} className="text-xs text-indigo-600 hover:underline">{u.project_scope.length} project(s)</button>
                      ) : (
                        <button onClick={() => openScope(u)} className="text-xs text-slate-400 hover:text-indigo-600">All — restrict</button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== 'super_admin' && (
                        <button onClick={() => { setResetUser(u); setNewPw(''); setResetMsg(''); }} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50"><Key size={12} />Reset password</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setRoleOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />New Role</button>
          </div>
          {roles.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
              <Shield size={36} className="text-slate-200 mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-600 mb-1">No custom roles yet</p>
              <p className="text-xs text-slate-400">Create roles like "Project Manager" or "Site Admin" — you'll set their permissions next.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {roles.map(r => (
                <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Shield size={16} /></div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                        <p className="text-xs text-slate-400">{profiles.filter(u => u.custom_role_id === r.id).length} user(s)</p>
                      </div>
                    </div>
                    <button onClick={() => deleteRole(r.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                  </div>
                  {r.description && <p className="text-xs text-slate-500 mt-3">{r.description}</p>}
                  <button onClick={() => openPerms(r)} className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors">
                    <Shield size={12} />Configure permissions
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New role modal */}
      {roleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setRoleOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">New Role</h2>
              <button onClick={() => setRoleOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Role name</label>
                <input value={rName} onChange={e => setRName(e.target.value)} placeholder="e.g. Project Manager" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Description (optional)</label>
                <input value={rDesc} onChange={e => setRDesc(e.target.value)} placeholder="What this role is for" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setRoleOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={addRole} disabled={!rName.trim() || savingRole} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">{savingRole ? 'Creating…' : 'Create Role'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setInviteOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Add User</h2>
              <button onClick={() => setInviteOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Username</label>
                <input value={iUsername} onChange={e => setIUsername(e.target.value)} type="text" placeholder="e.g. john.hr" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-slate-400">Letters, numbers, dots, dashes. No email needed.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <input value={iPassword} onChange={e => setIPassword(e.target.value)} type="text" placeholder="At least 6 characters" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Role</label>
                <select value={iRoleId} onChange={e => setIRoleId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">No role (assign later)</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <p className="text-xs text-slate-400">Share the username and password with them — they log in with those. They can change the password after logging in.</p>
              {inviteMsg && <p className={`text-xs ${inviteMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{inviteMsg}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setInviteOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={inviteUser} disabled={!iUsername.trim() || !iPassword.trim() || inviting} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">{inviting ? 'Creating…' : 'Create User'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setResetUser(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Reset Password</h2>
              <button onClick={() => setResetUser(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Set a new password for <span className="font-medium">{resetUser.full_name || resetUser.email}</span>.</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">New password</label>
                <input value={newPw} onChange={e => setNewPw(e.target.value)} type="text" placeholder="At least 6 characters" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-slate-400">Share this with the user securely. They can change it later in their profile.</p>
              </div>
              {resetMsg && <p className={`text-xs ${resetMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{resetMsg}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setResetUser(null)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={doReset} disabled={resetting} className="px-4 py-2.5 text-sm font-medium bg-slate-800 text-white rounded-xl hover:bg-slate-900 disabled:opacity-40">{resetting ? 'Updating…' : 'Set Password'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Permission editor modal */}
      {permRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setPermRole(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Permissions — {permRole.name}</h2>
                <p className="text-xs text-slate-400">Control what this role can see and do</p>
              </div>
              <button onClick={() => setPermRole(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Feature access */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Feature Access</p>
                <div className="space-y-2">
                  {FEATURES.map(f => (
                    <div key={f.key} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">{f.label}</span>
                      <select
                        value={permFeatures[f.key] || 'none'}
                        onChange={e => setPermFeatures(p => ({ ...p, [f.key]: e.target.value }))}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {ACCESS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section (data) access */}
              {sections.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Data Sections</p>
                  <div className="space-y-2">
                    {sections.map((s: any) => (
                      <div key={s.section_key} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700">{s.label}</span>
                        <select
                          value={permSections[s.section_key] || 'none'}
                          onChange={e => setPermSections(p => ({ ...p, [s.section_key]: e.target.value }))}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {ACCESS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidential fields */}
              {empFields.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Confidential Fields</p>
                  <p className="text-xs text-slate-400 mb-2">Tick fields this role is NOT allowed to see (e.g. salary). Unticked = visible.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {empFields.map((f: any) => {
                      const hidden = permConfidential.includes(f.field_key);
                      return (
                        <button
                          key={f.field_key}
                          onClick={() => setPermConfidential(p => hidden ? p.filter(k => k !== f.field_key) : [...p, f.field_key])}
                          className={`px-2.5 py-1 rounded-lg border text-xs ${hidden ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-600'}`}
                        >
                          {hidden ? '🔒 ' : ''}{f.field_label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setPermRole(null)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={savePerms} disabled={savingPerm} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">{savingPerm ? 'Saving…' : 'Save Permissions'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Project scope modal */}
      {scopeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setScopeUser(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Project Access</h2>
                <p className="text-xs text-slate-400">{scopeUser.full_name || scopeUser.email}</p>
              </div>
              <button onClick={() => setScopeUser(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-xs text-slate-500">Tick the projects/sites this user can access. If none are ticked, they can see all projects.</p>
              <div className="flex flex-wrap gap-1.5">
                {projectValues.map(v => {
                  const on = scopeVals.includes(v);
                  return (
                    <button key={v} onClick={() => setScopeVals(p => on ? p.filter(x => x !== v) : [...p, v])}
                      className={`px-2.5 py-1 rounded-lg border text-xs ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600'}`}>
                      {on ? '✓ ' : ''}{v}
                    </button>
                  );
                })}
                {projectValues.length === 0 && <span className="text-xs text-slate-400">No project values found. Make sure the project field is set and employees have that field filled.</span>}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => { setScopeVals([]); }} className="px-3 py-2.5 text-xs text-slate-500">Clear all</button>
              <button onClick={() => setScopeUser(null)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={saveScope} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Save Access</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
