'use client';
import { useState } from 'react';
import { Plus, Trash2, Sparkles, Loader, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const STATUS_CLS: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 border border-blue-200',
  in_progress: 'bg-violet-50 text-violet-700 border border-violet-200',
  filled: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 border border-slate-200',
};

export default function RequisitionsClient({
  initialRequisitions, departments, operations,
}: { initialRequisitions: any[]; departments: any[]; operations: any[] }) {
  const [requisitions, setRequisitions] = useState(initialRequisitions);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<string | null>(null);
  const [aiLoad, setAiLoad] = useState(false);
  const supabase = createClient();

  const blank = {
    position: '', department_id: '', operation_id: operations[0]?.id || '',
    headcount: 1, budget: '', required_by: '', job_description: '', status: 'open',
  };
  const [form, setForm] = useState<any>(blank);

  const genJD = async () => {
    setAiLoad(true);
    const opName = operations.find((o) => o.id === form.operation_id)?.name || '';
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Generate a concise professional job description for a "${form.position}" position for an Aramco-style EPC project company operating in ${opName}. Include: Role Summary, 5 Key Responsibilities, Required Qualifications, Preferred Skills. Keep it under 250 words.`,
      }),
    });
    const data = await res.json();
    setForm((f: any) => ({ ...f, job_description: data.text || '' }));
    setAiLoad(false);
  };

  const save = async () => {
    const newId = `REQ-${String(requisitions.length + 1).padStart(3, '0')}`;
    const { data, error } = await supabase
      .from('requisitions')
      .insert({ ...form, requisition_id: newId, headcount: Number(form.headcount), budget: Number(form.budget) || null })
      .select('*, departments(name), operations(name, country_code)')
      .single();
    if (!error && data) {
      setRequisitions((p) => [data, ...p]);
      setOpen(false);
      setForm(blank);
    }
  };

  const remove = async (id: string) => {
    await supabase.from('requisitions').delete().eq('id', id);
    setRequisitions((p) => p.filter((r) => r.id !== id));
    setDel(null);
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manpower Requisitions</h1>
          <p className="text-sm text-slate-500 mt-0.5">{requisitions.length} requisitions visible to you</p>
        </div>
        <button onClick={() => { setForm({ ...blank, operation_id: operations[0]?.id || '' }); setOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
          <Plus size={14} /> New Requisition
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <table className="w-full">
          <thead><tr className="border-b border-slate-100">{['REQ ID', 'Position', 'Country', 'Department', 'Headcount', 'Budget', 'Required By', 'Status', ''].map((h) => <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-50">
            {requisitions.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 text-xs font-mono text-slate-400">{r.requisition_id}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{r.position}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{r.operations?.country_code || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{r.departments?.name || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{r.headcount}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{r.budget ? Number(r.budget).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{r.required_by}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_CLS[r.status]}`}>{r.status.replace('_', ' ')}</span></td>
                <td className="px-4 py-3"><button onClick={() => setDel(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button></td>
              </tr>
            ))}
            {requisitions.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-sm text-slate-400">No requisitions yet</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">New Requisition</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Position Title</label><input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Country</label>
                <select value={form.operation_id} onChange={(e) => setForm({ ...form, operation_id: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Department</label>
                <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Headcount</label><input type="number" value={form.headcount} onChange={(e) => setForm({ ...form, headcount: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Budget (per month)</label><input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Required By</label><input type="date" value={form.required_by} onChange={(e) => setForm({ ...form, required_by: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            </div>
            <div className="px-6 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Job Description</label>
                <button onClick={genJD} disabled={!form.position || aiLoad} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {aiLoad ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} className="text-indigo-500" />} AI Generate
                </button>
              </div>
              {aiLoad && <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100"><Loader size={14} className="animate-spin text-indigo-500" /><span className="text-xs text-indigo-700">Generating job description…</span></div>}
              <textarea value={form.job_description} onChange={(e) => setForm({ ...form, job_description: e.target.value })} rows={6} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Enter or AI-generate a job description…" />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 mt-2 border-t border-slate-100">
              <button onClick={() => setOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={save} disabled={!form.position || !form.operation_id} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">Create Requisition</button>
            </div>
          </div>
        </div>
      )}

      {del && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDel(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete Requisition</h2>
            <p className="text-sm text-slate-600 mb-6">This cannot be undone. Candidates linked to this requisition will remain but lose their position reference.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDel(null)} className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={() => remove(del)} className="px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-xl">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
