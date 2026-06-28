'use client';
import { useState } from 'react';
import { Edit2, X, AlertCircle, User, Check, Plus, Mail, Loader } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Full access to everything' },
  { value: 'hr_director', label: 'HR Director', desc: 'All countries, all modules' },
  { value: 'hr_manager', label: 'HR Manager', desc: 'Assigned countries only' },
  { value: 'recruitment_manager', label: 'Recruitment Manager', desc: 'Recruitment pipeline only' },
  { value: 'agency_user', label: 'Agency User', desc: 'Own agency candidates only' },
  { value: 'department_manager', label: 'Department Manager', desc: 'Own department view' },
  { value: 'employee', label: 'Employee', desc: 'Own profile only' },
];

export default function UsersClient({ initialProfiles, operations, agencies, userOps, currentUserId }: {
  initialProfiles: any[]; operations: any[]; agencies: any[]; userOps: any[]; currentUserId: string;
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [allUserOps, setAllUserOps] = useState(userOps);
  const [editing, setEditing] = useState<any|null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [selectedOps, setSelectedOps] = useState<string[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'hr_manager', agency_id: '' });
  const [inviteOps, setInviteOps] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const supabase = createClient();

  const openEdit = (p: any) => {
    const currentOps = allUserOps.filter(uo => uo.user_id === p.id).map(uo => uo.operation_id);
    setForm({ role: p.role, agency_id: p.agency_id || '' });
    setSelectedOps(currentOps);
    setEditing(p);
    setError(''); setSuccess('');
  };

  const toggleOp = (id: string) => setSelectedOps(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleInviteOp = (id: string) => setInviteOps(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const save = async () => {
    if (!editing) return;
    setSaving(true); setError('');
    const { error: profileError } = await supabase.from('profiles').update({
      role: form.role, agency_id: form.agency_id || null,
    }).eq('id', editing.id);

    if (profileError) { setError(profileError.message); setSaving(false); return; }

    await supabase.from('user_operations').delete().eq('user_id', editing.id);
    const needsOps = ['hr_manager','recruitment_manager','department_manager'];
    if (needsOps.includes(form.role) && selectedOps.length > 0) {
      const rows = selectedOps.map(opId => ({ user_id: editing.id, operation_id: opId }));
      await supabase.from('user_operations').insert(rows);
      setAllUserOps(p => [...p.filter(uo => uo.user_id !== editing.id), ...rows]);
    }

    setProfiles(p => p.map(x => x.id === editing.id ? { ...x, role: form.role, agency_id: form.agency_id || null } : x));
    setSaving(false); setEditing(null);
  };

  const invite = async () => {
    if (!inviteForm.email.trim()) { setError('Email is required.'); return; }
    setInviting(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email,
          role: inviteForm.role,
          operation_ids: inviteOps,
          agency_id: inviteForm.agency_id || null,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else {
        setSuccess(`Invitation sent to ${inviteForm.email}. They will receive an email to set their password.`);
        setInviteForm({ email: '', role: 'hr_manager', agency_id: '' });
        setInviteOps([]);
      }
    } catch (err: any) { setError(err.message); }
    setInviting(false);
  };

  const showsCountries = (role: string) => ['hr_manager','recruitment_manager','department_manager'].includes(role);
  const showsAgency = (role: string) => role === 'agency_user';

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Invite users and assign roles — no Supabase required</p>
        </div>
        <button onClick={() => { setInviteOpen(true); setError(''); setSuccess(''); }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
          <Plus size={14} />Invite User
        </button>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4"><AlertCircle size={14}/>{error}<button onClick={() => setError('')} className="ml-auto"><X size={13}/></button></div>}
      {success && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-xl mb-4"><Check size={14}/>{success}</div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 rounded-t-2xl">
          <p className="text-xs text-slate-500">Super Admin and HR Director see all countries. HR Manager sees only assigned countries. Agency User sees only their agency's candidates.</p>
        </div>
        <div className="divide-y divide-slate-50">
          {profiles.map(p => {
            const ops = allUserOps.filter(uo => uo.user_id === p.id).map(uo => operations.find(o => o.id === uo.operation_id)?.country_code).filter(Boolean);
            const agency = agencies.find(a => a.id === p.agency_id);
            return (
              <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center"><User size={14} className="text-indigo-600"/></div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.full_name || p.email}{p.id === currentUserId && <span className="ml-2 text-xs text-slate-400">(you)</span>}</p>
                    <p className="text-xs text-slate-400">{p.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium capitalize">{p.role?.replace(/_/g,' ')}</span>
                      {ops.length > 0 && <span className="text-xs text-slate-400">{ops.join(', ')}</span>}
                      {agency && <span className="text-xs text-slate-400">{agency.name}</span>}
                    </div>
                  </div>
                </div>
                {p.id !== currentUserId && <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={14}/></button>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setInviteOpen(false)}/>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div><h2 className="text-base font-semibold text-slate-900">Invite User</h2><p className="text-xs text-slate-500 mt-0.5">They'll receive an email to set their password</p></div>
              <button onClick={() => setInviteOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16}/></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} type="email" placeholder="colleague@company.com"
                    className="w-full pl-9 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Role</label>
                <div className="space-y-1.5">
                  {ROLES.map(r => (
                    <button key={r.value} onClick={() => setInviteForm({...inviteForm, role: r.value})}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-colors ${inviteForm.role === r.value ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-200'}`}>
                      <div><p className="text-sm font-medium text-slate-800">{r.label}</p><p className="text-xs text-slate-400">{r.desc}</p></div>
                      {inviteForm.role === r.value && <Check size={14} className="text-indigo-600 flex-shrink-0"/>}
                    </button>
                  ))}
                </div>
              </div>
              {showsCountries(inviteForm.role) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Country Access</label>
                  {operations.map(o => (
                    <button key={o.id} onClick={() => toggleInviteOp(o.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-sm transition-colors ${inviteOps.includes(o.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      {o.name}{inviteOps.includes(o.id) && <Check size={13} className="text-indigo-600"/>}
                    </button>
                  ))}
                </div>
              )}
              {showsAgency(inviteForm.role) && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Assign to Agency</label>
                  <select value={inviteForm.agency_id} onChange={e => setInviteForm({...inviteForm, agency_id: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select agency…</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
              {success && <p className="text-xs text-emerald-600">{success}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setInviteOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={invite} disabled={inviting || !inviteForm.email}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                {inviting ? <><Loader size={13} className="animate-spin"/>Sending…</> : <><Mail size={13}/>Send Invite</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditing(null)}/>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div><h2 className="text-base font-semibold text-slate-900">Edit User</h2><p className="text-xs text-slate-500">{editing.email}</p></div>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16}/></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Role</label>
                {ROLES.map(r => (
                  <button key={r.value} onClick={() => setForm({...form, role: r.value})}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-colors ${form.role === r.value ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-200'}`}>
                    <div><p className="text-sm font-medium text-slate-800">{r.label}</p><p className="text-xs text-slate-400">{r.desc}</p></div>
                    {form.role === r.value && <Check size={14} className="text-indigo-600 flex-shrink-0"/>}
                  </button>
                ))}
              </div>
              {showsCountries(form.role) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Country Access</label>
                  {operations.map(o => (
                    <button key={o.id} onClick={() => toggleOp(o.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-sm transition-colors ${selectedOps.includes(o.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      {o.name}{selectedOps.includes(o.id) && <Check size={13} className="text-indigo-600"/>}
                    </button>
                  ))}
                </div>
              )}
              {showsAgency(form.role) && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Agency</label>
                  <select value={form.agency_id} onChange={e => setForm({...form, agency_id: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select agency…</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setEditing(null)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                {saving ? <><Loader size={13} className="animate-spin"/>Saving…</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
