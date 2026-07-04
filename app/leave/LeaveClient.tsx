'use client';
import { useState, useMemo } from 'react';
import {
  Plus, X, Check, Clock, Calendar, Settings, Trash2, CheckCircle2,
  XCircle, Palmtree, ChevronDown, Edit2, Layers,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const COLORS = ['indigo', 'amber', 'emerald', 'rose', 'sky', 'violet', 'teal', 'slate'];
const CBG: Record<string, string> = {
  indigo: 'bg-indigo-100 text-indigo-700', amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700', rose: 'bg-rose-100 text-rose-700',
  sky: 'bg-sky-100 text-sky-700', violet: 'bg-violet-100 text-violet-700',
  teal: 'bg-teal-100 text-teal-700', slate: 'bg-slate-100 text-slate-700',
};

const daysBetween = (a: string, b: string) => {
  if (!a || !b) return 0;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;
  return d > 0 ? d : 0;
};

export default function LeaveClient({ initialTypes, initialRequests, initialPolicies = [], employees, empFields, companyId, userEmail }: {
  initialTypes: any[]; initialRequests: any[]; initialPolicies?: any[]; employees: any[]; empFields: any[]; companyId: string; userEmail: string;
}) {
  const [types, setTypes] = useState(initialTypes);
  const [policies, setPolicies] = useState(initialPolicies);
  const [requests, setRequests] = useState(initialRequests);
  const [tab, setTab] = useState<'pending' | 'approved' | 'all'>('pending');
  const [addOpen, setAddOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [etName, setEtName] = useState('');
  const [etDays, setEtDays] = useState('');
  const [etColor, setEtColor] = useState('indigo');
  const supabase = createClient();

  // Employee name/code helpers
  const nameField = useMemo(() => empFields.find(f => /name/i.test(f.field_label))?.field_key, [empFields]);
  const idField = useMemo(() => empFields.find(f => f.is_id_field)?.field_key, [empFields]);
  const empName = (e: any) => (nameField && e.data?.[nameField]) || e.record_id || 'Unnamed';
  const empCode = (e: any) => (idField && e.data?.[idField]) || e.record_id || '';

  // New request form
  const [rEmp, setREmp] = useState('');
  const [rType, setRType] = useState('');
  const [rStart, setRStart] = useState('');
  const [rEnd, setREnd] = useState('');
  const [rReason, setRReason] = useState('');
  const rDays = daysBetween(rStart, rEnd);

  const filtered = requests.filter(r =>
    tab === 'all' ? true : tab === 'pending' ? r.status === 'pending' : r.status === 'approved'
  );

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  // Balance per employee per type = entitlement - approved days this year
  const balanceFor = (empRecordId: string, typeId: string) => {
    const type = types.find(t => t.id === typeId);
    if (!type) return null;
    const emp = employees.find(e => e.id === empRecordId);
    const entitlement = entitlementFor(emp, typeId);
    const year = new Date().getFullYear();
    const used = requests
      .filter(r => r.employee_record_id === empRecordId && r.leave_type_id === typeId && r.status === 'approved' && new Date(r.start_date).getFullYear() === year)
      .reduce((s, r) => s + Number(r.days_count || 0), 0);
    return { entitlement, used, remaining: entitlement - used };
  };

  const submitRequest = async () => {
    if (!rEmp || !rType || !rStart || !rEnd) return;
    const emp = employees.find(e => e.id === rEmp);
    const type = types.find(t => t.id === rType);
    const { data } = await supabase.from('leave_requests').insert({
      company_id: companyId,
      employee_record_id: rEmp,
      employee_name: emp ? empName(emp) : '',
      employee_code: emp ? empCode(emp) : '',
      leave_type_id: rType,
      leave_type_name: type?.name || '',
      start_date: rStart, end_date: rEnd, days_count: rDays,
      reason: rReason, status: 'pending', requested_by: userEmail,
    }).select().single();
    if (data) setRequests(p => [data, ...p]);
    setREmp(''); setRType(''); setRStart(''); setREnd(''); setRReason(''); setAddOpen(false);
  };

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    const { data } = await supabase.from('leave_requests').update({
      status, decided_by: userEmail, decided_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (data) setRequests(p => p.map(r => r.id === id ? data : r));
  };

  const deleteRequest = async (id: string) => {
    await supabase.from('leave_requests').delete().eq('id', id);
    setRequests(p => p.filter(r => r.id !== id));
  };

  // Leave type management
  const [ntName, setNtName] = useState('');
  const [ntDays, setNtDays] = useState('');
  const [ntColor, setNtColor] = useState('indigo');
  const addType = async () => {
    if (!ntName.trim()) return;
    const { data } = await supabase.from('leave_types').insert({
      company_id: companyId, name: ntName.trim(), days_per_year: Number(ntDays) || 0,
      color: ntColor, sort_order: types.length,
    }).select().single();
    if (data) setTypes(p => [...p, data]);
    setNtName(''); setNtDays(''); setNtColor('indigo');
  };
  const deleteType = async (id: string) => {
    await supabase.from('leave_types').delete().eq('id', id);
    setTypes(p => p.filter(t => t.id !== id));
  };

  const startEditType = (t: any) => {
    setEditingType(t.id); setEtName(t.name); setEtDays(String(t.days_per_year)); setEtColor(t.color);
  };
  const saveEditType = async () => {
    if (!editingType) return;
    const { data } = await supabase.from('leave_types').update({
      name: etName.trim(), days_per_year: Number(etDays) || 0, color: etColor,
    }).eq('id', editingType).select().single();
    if (data) setTypes(p => p.map(t => t.id === editingType ? data : t));
    setEditingType(null);
  };

  // Policy: find the entitlement for a specific employee + leave type
  const entitlementFor = (emp: any, typeId: string): number => {
    const typePolicies = policies.filter(p => p.leave_type_id === typeId);
    // Find the first policy whose criteria the employee matches
    for (const pol of typePolicies) {
      const vals = (pol.criteria_values || []).map((v: string) => String(v).toLowerCase());
      if (vals.length === 0) return Number(pol.days_per_year); // applies to all
      const empVal = String(emp?.data?.[pol.criteria_field] ?? '').toLowerCase();
      if (vals.includes(empVal)) return Number(pol.days_per_year);
    }
    // Fall back to the leave type's base entitlement
    const type = types.find(t => t.id === typeId);
    return type ? Number(type.days_per_year) : 0;
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Policy management
  const [polOpen, setPolOpen] = useState(false);
  const [npType, setNpType] = useState('');
  const [npName, setNpName] = useState('');
  const [npDays, setNpDays] = useState('');
  const [npField, setNpField] = useState('');
  const [npValues, setNpValues] = useState<string[]>([]);

  const npFieldOptions = (() => {
    const f = empFields.find(x => x.field_key === npField);
    if (f?.options?.length) return f.options;
    // derive distinct values from employee data
    return Array.from(new Set(employees.map(e => e.data?.[npField]).filter(Boolean))).slice(0, 30);
  })();

  const addPolicy = async () => {
    if (!npType || !npName.trim()) return;
    const { data } = await supabase.from('leave_policies').insert({
      company_id: companyId, leave_type_id: npType, name: npName.trim(),
      days_per_year: Number(npDays) || 0, criteria_field: npField || null,
      criteria_values: npValues, sort_order: policies.length,
    }).select().single();
    if (data) setPolicies(p => [...p, data]);
    setNpType(''); setNpName(''); setNpDays(''); setNpField(''); setNpValues([]);
  };
  const deletePolicy = async (id: string) => {
    await supabase.from('leave_policies').delete().eq('id', id);
    setPolicies(p => p.filter(x => x.id !== id));
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{requests.length} requests · {pendingCount} awaiting approval</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPolOpen(true)} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Settings size={14} />Policies</button>
          <button onClick={() => setTypesOpen(true)} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Palmtree size={14} />Leave Types</button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />Request Leave</button>
        </div>
      </div>

      {/* Leave type summary chips */}
      {types.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {types.map(t => (
            <div key={t.id} className={`px-3 py-1.5 rounded-xl text-xs font-medium ${CBG[t.color] || CBG.indigo}`}>
              {t.name} · {t.days_per_year} days/yr
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit">
        {[
          { k: 'pending' as const, label: 'Pending', count: pendingCount },
          { k: 'approved' as const, label: 'Approved', count: requests.filter(r => r.status === 'approved').length },
          { k: 'all' as const, label: 'All', count: requests.length },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label} <span className="text-slate-400">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Requests list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
          <Palmtree size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600 mb-1">No {tab !== 'all' ? tab : ''} leave requests</p>
          <p className="text-xs text-slate-400 mb-5">Click "Request Leave" to submit one on behalf of an employee.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(r => {
            const type = types.find(t => t.id === r.leave_type_id);
            const bal = r.employee_record_id ? balanceFor(r.employee_record_id, r.leave_type_id) : null;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${CBG[type?.color || 'indigo']}`}>
                      <Calendar size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{r.employee_name || 'Unnamed'}</span>
                        {r.employee_code && <span className="text-xs font-mono text-slate-400">{r.employee_code}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${CBG[type?.color || 'indigo']}`}>{r.leave_type_name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {fmt(r.start_date)} → {fmt(r.end_date)} · <span className="font-medium">{r.days_count} day{r.days_count !== 1 ? 's' : ''}</span>
                        {bal && <span className="text-slate-400"> · {bal.remaining} of {bal.entitlement} remaining</span>}
                      </p>
                      {r.reason && <p className="text-xs text-slate-400 mt-0.5 truncate">{r.reason}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.status === 'pending' ? (
                      <>
                        <button onClick={() => decide(r.id, 'approved')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100"><Check size={13} />Approve</button>
                        <button onClick={() => decide(r.id, 'rejected')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><X size={13} />Reject</button>
                      </>
                    ) : (
                      <span className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : r.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                        {r.status === 'approved' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    )}
                    <button onClick={() => deleteRequest(r.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Request modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Request Leave</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Employee</label>
                <select value={rEmp} onChange={e => setREmp(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select employee…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{empName(e)}{empCode(e) ? ` (${empCode(e)})` : ''}</option>)}
                </select>
                {employees.length === 0 && <p className="text-xs text-amber-600">No employees found. Upload your employee list in the Employees section first.</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Leave type</label>
                <select value={rType} onChange={e => setRType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select type…</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {rEmp && rType && (() => {
                const bal = balanceFor(rEmp, rType);
                return bal ? <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-600">Balance: <span className="font-semibold">{bal.remaining}</span> of {bal.entitlement} days remaining this year</div> : null;
              })()}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">From</label>
                  <input type="date" value={rStart} onChange={e => setRStart(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">To</label>
                  <input type="date" value={rEnd} onChange={e => setREnd(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              {rDays > 0 && <p className="text-xs text-indigo-600 font-medium">{rDays} day{rDays !== 1 ? 's' : ''} total</p>}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Reason <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea value={rReason} onChange={e => setRReason(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={submitRequest} disabled={!rEmp || !rType || !rStart || !rEnd} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Submit Request</button>
            </div>
          </div>
        </div>
      )}

      {/* Leave types panel */}
      {typesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setTypesOpen(false)} />
          <div className="relative bg-white w-96 h-full shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-sm font-semibold text-slate-900">Leave Types</h2>
              <button onClick={() => setTypesOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2">
              {types.map(t => (
                editingType === t.id ? (
                  <div key={t.id} className="border border-indigo-200 rounded-xl p-3 space-y-2 bg-indigo-50/30">
                    <input value={etName} onChange={e => setEtName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <div className="flex gap-2">
                      <input type="number" value={etDays} onChange={e => setEtDays(e.target.value)} placeholder="Days/yr" className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <select value={etColor} onChange={e => setEtColor(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                        {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEditType} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg">Save</button>
                      <button onClick={() => setEditingType(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div key={t.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-lg ${CBG[t.color] || CBG.indigo} flex items-center justify-center`}><Palmtree size={12} /></span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t.name}</p>
                        <p className="text-xs text-slate-400">{t.days_per_year} days/year base</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEditType(t)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={13} /></button>
                      <button onClick={() => deleteType(t.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                )
              ))}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 mt-3 space-y-2">
                <p className="text-xs font-medium text-slate-500">Add leave type</p>
                <input value={ntName} onChange={e => setNtName(e.target.value)} placeholder="e.g. Hajj Leave" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="flex gap-2">
                  <input type="number" value={ntDays} onChange={e => setNtDays(e.target.value)} placeholder="Days/yr" className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <select value={ntColor} onChange={e => setNtColor(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                    {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={addType} disabled={!ntName.trim()} className="w-full px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-40">Add Type</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leave Policies panel */}
      {polOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setPolOpen(false)} />
          <div className="relative bg-white w-[420px] h-full shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Leave Policies</h2>
                <p className="text-xs text-slate-400">Different entitlements for different employee groups</p>
              </div>
              <button onClick={() => setPolOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2">
              {policies.map(pol => {
                const type = types.find(t => t.id === pol.leave_type_id);
                const field = empFields.find(f => f.field_key === pol.criteria_field);
                return (
                  <div key={pol.id} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{pol.name}</p>
                        <p className="text-xs text-slate-500">{type?.name} · <span className="font-semibold">{pol.days_per_year} days/yr</span></p>
                        {pol.criteria_values?.length > 0
                          ? <p className="text-xs text-slate-400 mt-0.5">When {field?.field_label || pol.criteria_field} is: {pol.criteria_values.join(', ')}</p>
                          : <p className="text-xs text-slate-400 mt-0.5">Applies to all employees</p>}
                      </div>
                      <button onClick={() => deletePolicy(pol.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
              {policies.length === 0 && <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">No policies yet. Add one below to give different employee groups different entitlements. Without policies, everyone gets the leave type's base days.</p>}

              {/* Add policy */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 mt-3 space-y-2">
                <p className="text-xs font-medium text-slate-500">Add policy</p>
                <select value={npType} onChange={e => setNpType(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Which leave type?</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input value={npName} onChange={e => setNpName(e.target.value)} placeholder="Policy name (e.g. Staff Annual)" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="number" value={npDays} onChange={e => setNpDays(e.target.value)} placeholder="Days per year" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <div className="pt-1">
                  <p className="text-xs text-slate-400 mb-1">Applies to (leave empty = all employees):</p>
                  <select value={npField} onChange={e => { setNpField(e.target.value); setNpValues([]); }} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">All employees</option>
                    {empFields.map(f => <option key={f.field_key} value={f.field_key}>{f.field_label}</option>)}
                  </select>
                  {npField && (
                    <div className="flex flex-wrap gap-1.5">
                      {npFieldOptions.map((o: string) => {
                        const on = npValues.map(v => String(v).toLowerCase()).includes(String(o).toLowerCase());
                        return (
                          <button key={o} onClick={() => setNpValues(prev => on ? prev.filter(v => String(v).toLowerCase() !== String(o).toLowerCase()) : [...prev, o])}
                            className={`px-2 py-1 rounded-lg border text-xs ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600'}`}>
                            {on ? '✓ ' : ''}{o}
                          </button>
                        );
                      })}
                      {npFieldOptions.length === 0 && <span className="text-xs text-slate-400">No values found in this field.</span>}
                    </div>
                  )}
                </div>
                <button onClick={addPolicy} disabled={!npType || !npName.trim()} className="w-full px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-40">Add Policy</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
