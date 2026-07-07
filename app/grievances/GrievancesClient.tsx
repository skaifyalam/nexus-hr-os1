'use client';
import { useState, useMemo } from 'react';
import { Plus, X, MessageSquareWarning, CheckCircle2, Clock, Eye, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import PersonPicker from '@/components/PersonPicker';
import { startApproval } from '@/lib/approvals';
import { createClient } from '@/lib/supabase/client';

const STATUS = {
  submitted: { c: 'bg-amber-50 text-amber-700', label: 'Submitted' },
  in_review: { c: 'bg-sky-50 text-sky-700', label: 'In Review' },
  resolved: { c: 'bg-emerald-50 text-emerald-700', label: 'Resolved' },
  closed: { c: 'bg-slate-100 text-slate-500', label: 'Closed' },
} as any;

export default function GrievancesClient({ initialGrievances, employees, empFields, companyId, userEmail }: {
  initialGrievances: any[]; employees: any[]; empFields: any[]; companyId: string; userEmail: string;
}) {
  const [items, setItems] = useState(initialGrievances);
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const [addOpen, setAddOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const supabase = createClient();

  const nameField = useMemo(() => empFields.find(f => /name/i.test(f.field_label))?.field_key, [empFields]);
  const idField = useMemo(() => empFields.find(f => f.is_id_field)?.field_key, [empFields]);
  const pName = (p: any) => (nameField && p.data?.[nameField]) || p.record_id || 'Unnamed';
  const pCode = (p: any) => (idField && p.data?.[idField]) || p.record_id || '';

  const [gPerson, setGPerson] = useState('');
  const [gCategory, setGCategory] = useState('general');
  const [gSubject, setGSubject] = useState('');
  const [gDesc, setGDesc] = useState('');
  const [gAnon, setGAnon] = useState(false);

  const filtered = tab === 'open' ? items.filter(i => i.status === 'submitted' || i.status === 'in_review') : items;

  const add = async () => {
    if (!gSubject.trim()) return;
    const emp = gAnon ? null : employees.find(e => e.id === gPerson);
    const { data } = await supabase.from('grievances').insert({
      company_id: companyId,
      person_record_id: gAnon ? null : (gPerson || null),
      person_name: gAnon ? 'Anonymous' : (emp ? pName(emp) : ''),
      person_code: gAnon ? '' : (emp ? pCode(emp) : ''),
      category: gCategory, subject: gSubject.trim(), description: gDesc,
      is_anonymous: gAnon, status: 'submitted', raised_by: gAnon ? 'anonymous' : userEmail,
    }).select().single();
    if (data) {
      setItems(p => [data, ...p]);
      await startApproval({ companyId, processKey: 'grievance', sourceId: data.id, title: `Grievance — ${data.subject}`, requestedBy: gAnon ? 'anonymous' : userEmail });
    }
    setGPerson(''); setGCategory('general'); setGSubject(''); setGDesc(''); setGAnon(false); setAddOpen(false);
  };

  const setStatus = async (id: string, status: string, resolution?: string) => {
    const upd: any = { status, handled_by: userEmail };
    if (resolution !== undefined) upd.resolution = resolution;
    await supabase.from('grievances').update(upd).eq('id', id);
    setItems(p => p.map(i => i.id === id ? { ...i, ...upd } : i));
    if (viewItem?.id === id) setViewItem((v: any) => ({ ...v, ...upd }));
  };

  const del = async (id: string) => {
    await supabase.from('grievances').delete().eq('id', id);
    setItems(p => p.filter(i => i.id !== id));
    setViewItem(null);
  };

  const exportFile = () => {
    const rows = items.map(g => ({ Employee: g.person_name, Code: g.person_code, Category: g.category, Subject: g.subject, Status: g.status, Resolution: g.resolution || '', Date: new Date(g.created_at).toLocaleDateString('en-GB') }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Grievances');
    XLSX.writeFile(wb, 'grievances.xlsx');
  };

  const counts = useMemo(() => ({
    open: items.filter(i => i.status === 'submitted' || i.status === 'in_review').length,
    resolved: items.filter(i => i.status === 'resolved').length,
  }), [items]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Grievances</h1>
          <p className="text-sm text-slate-500 mt-0.5">Employees can raise concerns — tracked confidentially through to resolution</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportFile} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Download size={14} />Export</button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />Raise Grievance</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5 max-w-md">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1"><Clock size={15} className="text-amber-500" /><span className="text-xs font-medium text-slate-500">Open</span></div>
          <p className="text-2xl font-bold text-amber-600">{counts.open}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 size={15} className="text-emerald-500" /><span className="text-xs font-medium text-slate-500">Resolved</span></div>
          <p className="text-2xl font-bold text-emerald-600">{counts.resolved}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('open')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'open' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Open</button>
        <button onClick={() => setTab('all')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>All</button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
          <MessageSquareWarning size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600 mb-1">No grievances {tab === 'open' ? 'open' : 'yet'}</p>
          <p className="text-xs text-slate-400">Employees can raise concerns here — optionally anonymously.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(g => (
            <div key={g.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 group">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{g.subject}</span>
                    <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full capitalize">{g.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[g.status]?.c}`}>{STATUS[g.status]?.label}</span>
                    {g.is_anonymous && <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Anonymous</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{g.is_anonymous ? 'Anonymous' : g.person_name} · {new Date(g.created_at).toLocaleDateString('en-GB')}</p>
                  {g.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{g.description}</p>}
                </div>
                <button onClick={() => setViewItem(g)} className="flex items-center gap-1 text-xs text-indigo-600 hover:gap-2 transition-all flex-shrink-0 ml-3"><Eye size={13} />Manage</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Raise modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">Raise a Grievance</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={gAnon} onChange={e => setGAnon(e.target.checked)} className="rounded" />
                Submit anonymously (your identity won't be recorded)
              </label>
              {!gAnon && (
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Employee</label>
                  <PersonPicker people={employees} fields={empFields} value={gPerson} onChange={setGPerson} placeholder="Search by name or ID…" /></div>
              )}
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Category</label>
                <input value={gCategory} onChange={e => setGCategory(e.target.value)} placeholder="workplace / pay / harassment / facilities / general" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Subject</label>
                <input value={gSubject} onChange={e => setGSubject(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Details</label>
                <textarea value={gDesc} onChange={e => setGDesc(e.target.value)} rows={4} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" /></div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={add} disabled={!gSubject.trim()} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Manage modal */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setViewItem(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">{viewItem.subject}</h2>
              <button onClick={() => setViewItem(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full capitalize">{viewItem.category}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[viewItem.status]?.c}`}>{STATUS[viewItem.status]?.label}</span>
                {viewItem.is_anonymous && <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Anonymous</span>}
              </div>
              <p className="text-xs text-slate-400">Raised by {viewItem.is_anonymous ? 'Anonymous' : viewItem.person_name} · {new Date(viewItem.created_at).toLocaleDateString('en-GB')}</p>
              <div className="bg-slate-50 rounded-xl p-3"><p className="text-sm text-slate-600 whitespace-pre-wrap">{viewItem.description || 'No details provided.'}</p></div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.keys(STATUS).map(s => (
                    <button key={s} onClick={() => setStatus(viewItem.id, s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${viewItem.status === s ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{STATUS[s].label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Resolution / notes</label>
                <textarea defaultValue={viewItem.resolution || ''} onBlur={e => setStatus(viewItem.id, viewItem.status, e.target.value)} rows={3} placeholder="How was this handled?" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-between px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => del(viewItem.id)} className="px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl">Delete</button>
              <button onClick={() => setViewItem(null)} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
