'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, User, Palmtree, Clock, Award, FileText, CreditCard, ShieldAlert, LogOut, MessageSquareWarning, CheckCircle2, AlertTriangle, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const daysUntil = (d: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;
const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// Display a field value. If the field is a date and the stored value is an Excel
// serial number (e.g. 45231 from an old import) OR an ISO date string, show it as
// a readable date. Non-date fields and normal text are shown untouched.
const displayValue = (f: any, raw: any): string => {
  if (raw === null || raw === undefined || raw === '') return '—';
  if (f?.field_type === 'date') {
    // Excel serial number → date
    const num = typeof raw === 'number' ? raw : (/^\d+(\.\d+)?$/.test(String(raw).trim()) ? Number(raw) : NaN);
    if (!isNaN(num) && num > 0 && num < 100000) {
      const ms = Math.round((num - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    // Otherwise try parsing as a normal date string
    const d = new Date(String(raw));
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return String(raw);
};

export default function Employee360({ emp, empFields, leave, attendance, performance, documents, visaAllocs, conduct, exits, grievances }: any) {
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const saveEdits = async () => {
    setSaving(true);
    const { error } = await supabase.from('section_records').update({ data: editForm, updated_at: new Date().toISOString() }).eq('id', emp.id);
    setSaving(false);
    if (!error) { emp.data = editForm; setEditing(false); }
    else alert('Save failed: ' + error.message);
  };

  const nameField = useMemo(() => empFields.find((f: any) => /name/i.test(f.field_label))?.field_key, [empFields]);
  const name = (nameField && emp.data?.[nameField]) || emp.record_id || 'Employee';

  // Status: inactive if there's a completed exit
  const hasExit = exits.some((e: any) => e.status === 'completed' || e.status === 'approved');
  const activeVisa = visaAllocs.find((v: any) => v.status !== 'cancelled');

  // Key stats
  const leaveApproved = leave.filter((l: any) => l.status === 'approved').reduce((s: number, l: any) => s + Number(l.days_count || 0), 0);
  const avgRating = performance.length ? (performance.filter((p: any) => p.rating).reduce((s: number, p: any) => s + Number(p.rating), 0) / performance.filter((p: any) => p.rating).length).toFixed(1) : null;
  const expiringDocs = documents.filter((d: any) => { const dd = daysUntil(d.expiry_date); return dd !== null && dd <= 60; });
  const presentDays = attendance.filter((a: any) => a.status === 'present').length;

  const TABS = [
    { key: 'overview', label: 'Overview', icon: User },
    { key: 'leave', label: `Leave (${leave.length})`, icon: Palmtree },
    { key: 'attendance', label: `Attendance (${attendance.length})`, icon: Clock },
    { key: 'performance', label: `Performance (${performance.length})`, icon: Award },
    { key: 'documents', label: `Documents (${documents.length})`, icon: FileText },
    { key: 'visa', label: `Visa (${visaAllocs.length})`, icon: CreditCard },
    { key: 'conduct', label: `Conduct (${conduct.length})`, icon: ShieldAlert },
    { key: 'grievances', label: `Grievances (${grievances.length})`, icon: MessageSquareWarning },
  ];

  // Show the employee's own fields (excluding name)
  const detailFields = empFields.filter((f: any) => f.field_key !== nameField).slice(0, 24);

  return (
    <div className="max-w-5xl">
      <Link href="/s/employee" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"><ArrowLeft size={15} />Back to Employees</Link>

      {/* Header card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">{String(name).charAt(0)}</div>
            <div>
              <h1 className="text-2xl font-bold">{name}</h1>
              <p className="text-sm text-white/70">{emp.record_id}</p>
              <div className="flex items-center gap-2 mt-2">
                {hasExit ? <span className="text-xs px-2 py-0.5 bg-red-500/30 rounded-full">Inactive (Exited)</span> : <span className="text-xs px-2 py-0.5 bg-emerald-500/30 rounded-full">Active</span>}
                {activeVisa && <span className="text-xs px-2 py-0.5 bg-white/20 rounded-full">{activeVisa.visa_blocks?.visa_type || 'Visa'} allocated</span>}
              </div>
            </div>
          </div>
        </div>
        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          <div className="bg-white/10 rounded-xl p-3"><p className="text-xl font-bold">{leaveApproved}</p><p className="text-xs text-white/60">Leave days taken</p></div>
          <div className="bg-white/10 rounded-xl p-3"><p className="text-xl font-bold">{avgRating || '—'}</p><p className="text-xs text-white/60">Avg rating</p></div>
          <div className="bg-white/10 rounded-xl p-3"><p className="text-xl font-bold">{expiringDocs.length}</p><p className="text-xs text-white/60">Docs expiring</p></div>
          <div className="bg-white/10 rounded-xl p-3"><p className="text-xl font-bold">{performance.length}</p><p className="text-xs text-white/60">Reviews</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {expiringDocs.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-amber-700 flex items-center gap-1.5 mb-1"><AlertTriangle size={15} />Documents needing attention</p>
              {expiringDocs.map((d: any) => <p key={d.id} className="text-xs text-amber-600">{d.doc_type} expires {fmt(d.expiry_date)} ({daysUntil(d.expiry_date)} days)</p>)}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800">Employee Details</p>
              {!editing ? (
                <button onClick={() => { setEditForm(emp.data || {}); setEditing(true); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:gap-2 transition-all"><Pencil size={13} />Edit</button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-xs text-slate-500 px-2 py-1">Cancel</button>
                  <button onClick={saveEdits} disabled={saving} className="inline-flex items-center gap-1.5 text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                </div>
              )}
            </div>
            <div className="grid md:grid-cols-3 gap-x-6 gap-y-3">
              {detailFields.map((f: any) => (
                <div key={f.field_key}>
                  <p className="text-xs text-slate-400">{f.field_label}</p>
                  {editing ? (
                    <input value={editForm[f.field_key] ?? ''} onChange={e => setEditForm((p: any) => ({ ...p, [f.field_key]: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-0.5" />
                  ) : (
                    <p className="text-sm text-slate-700">{displayValue(f, emp.data?.[f.field_key])}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Leave */}
      {tab === 'leave' && <ListCard items={leave} empty="No leave records" render={(l: any) => (
        <div className="flex items-center justify-between"><span className="text-sm text-slate-700">{l.leave_type_name} · {fmt(l.start_date)} → {fmt(l.end_date)}</span><span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : l.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{l.days_count}d · {l.status}</span></div>
      )} />}

      {/* Attendance */}
      {tab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm text-slate-500 mb-3">{presentDays} present days in last {attendance.length} records</p>
          <div className="flex flex-wrap gap-1">
            {attendance.map((a: any) => (
              <span key={a.id} title={`${fmt(a.date)} · ${a.status}`} className={`w-7 h-7 rounded flex items-center justify-center text-xs ${a.status === 'present' ? 'bg-emerald-100 text-emerald-700' : a.status === 'absent' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{new Date(a.date).getDate()}</span>
            ))}
            {attendance.length === 0 && <p className="text-xs text-slate-400">No attendance records</p>}
          </div>
        </div>
      )}

      {/* Performance */}
      {tab === 'performance' && <ListCard items={performance} empty="No reviews" render={(p: any) => (
        <div><div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-700">{p.cycle}</span><span className="text-xs text-amber-600">{'★'.repeat(Math.round(p.rating || 0))}</span></div>{p.strengths && <p className="text-xs text-slate-500 mt-1">Strengths: {p.strengths}</p>}</div>
      )} />}

      {/* Documents */}
      {tab === 'documents' && <ListCard items={documents} empty="No documents" render={(d: any) => {
        const dd = daysUntil(d.expiry_date);
        return <div className="flex items-center justify-between"><span className="text-sm text-slate-700">{d.doc_type} {d.doc_number && <span className="font-mono text-xs text-slate-400">{d.doc_number}</span>}</span><span className={`text-xs px-2 py-0.5 rounded-full ${dd !== null && dd < 0 ? 'bg-red-50 text-red-600' : dd !== null && dd <= 60 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{fmt(d.expiry_date)}</span></div>;
      }} />}

      {/* Visa */}
      {tab === 'visa' && <ListCard items={visaAllocs} empty="No visa allocations" render={(v: any) => (
        <div className="flex items-center justify-between"><span className="text-sm text-slate-700">{v.visa_blocks?.visa_type || 'Visa'} · {v.visa_blocks?.authority_number || ''} {v.visa_blocks?.profession && <span className="text-xs text-slate-400">({v.visa_blocks.profession})</span>}</span><span className={`text-xs px-2 py-0.5 rounded-full ${v.status === 'used' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{v.status}</span></div>
      )} />}

      {/* Conduct + Exit */}
      {tab === 'conduct' && (
        <div className="space-y-3">
          {conduct.length === 0 && exits.length === 0 && <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">No conduct or exit records</div>}
          {conduct.map((c: any) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-2"><ShieldAlert size={14} className="text-amber-500" /><span className="text-sm font-medium text-slate-700 capitalize">{c.record_type?.replace('_', ' ')}</span><span className="text-xs px-2 py-0.5 bg-slate-100 rounded-full">{c.severity}</span></div>
              <p className="text-sm text-slate-600 mt-1">{c.subject}</p>
            </div>
          ))}
          {exits.map((e: any) => (
            <div key={e.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-2"><LogOut size={14} className="text-red-500" /><span className="text-sm font-medium text-slate-700 capitalize">{e.exit_type?.replace('_', ' ')}</span><span className="text-xs px-2 py-0.5 bg-slate-100 rounded-full">{e.status}</span></div>
              <p className="text-xs text-slate-400 mt-1">Last day {fmt(e.last_working_day)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Grievances */}
      {tab === 'grievances' && <ListCard items={grievances} empty="No grievances" render={(g: any) => (
        <div className="flex items-center justify-between"><span className="text-sm text-slate-700">{g.subject} <span className="text-xs text-slate-400">({g.category})</span></span><span className="text-xs px-2 py-0.5 bg-slate-100 rounded-full">{g.status}</span></div>
      )} />}
    </div>
  );
}

function ListCard({ items, render, empty }: { items: any[]; render: (i: any) => any; empty: string }) {
  if (items.length === 0) return <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">{empty}</div>;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
      {items.map((i: any) => <div key={i.id} className="px-5 py-3">{render(i)}</div>)}
    </div>
  );
}
