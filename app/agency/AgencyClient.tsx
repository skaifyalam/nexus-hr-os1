'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, X, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { STAGES, STAGE_LABELS, DOCUMENT_TYPES } from '@/lib/stages';

export default function AgencyClient({
  initialCandidates, requisitions, profile,
}: { initialCandidates: any[]; requisitions: any[]; profile: any }) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [addOpen, setAddOpen] = useState(false);
  const supabase = createClient();

  const blank = { first_name: '', last_name: '', nationality: '', passport_number: '', requisition_id: '' };
  const [form, setForm] = useState<any>(blank);

  const save = async () => {
    const newId = `CAND-${Date.now().toString().slice(-6)}`;
    const req = requisitions.find((r) => r.id === form.requisition_id);
    const { data, error } = await supabase.from('candidates').insert({
      ...form,
      candidate_id: newId,
      operation_id: req?.operation_id,
      agency_id: profile?.agency_id,
    }).select('*, requisitions(position, requisition_id), operations(name, country_code), candidate_documents(*)').single();
    if (!error && data) {
      setCandidates((p) => [data, ...p]);
      setAddOpen(false);
      setForm(blank);
    }
  };

  const updateStage = async (id: string, stage: string) => {
    const { data, error } = await supabase.from('candidates').update({ stage }).eq('id', id)
      .select('*, requisitions(position, requisition_id), operations(name, country_code), candidate_documents(*)').single();
    if (!error && data) setCandidates((p) => p.map((c) => (c.id === id ? data : c)));
  };

  if (!profile?.agency_id) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-8 text-center">
        <p className="text-sm font-medium text-slate-700">Your account isn't linked to an agency yet.</p>
        <p className="text-xs text-slate-500 mt-1">Ask your Company HR Super Admin to assign your account to an agency — see the README for the exact steps.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agency Pipeline</h1>
          <p className="text-sm text-slate-500 mt-0.5">{candidates.length} candidates · manage documents and mobilization status</p>
        </div>
        <button onClick={() => { setForm(blank); setAddOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
          <Plus size={14} /> Add Candidate
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <table className="w-full">
          <thead><tr className="border-b border-slate-100">{['Candidate', 'Position', 'Country', 'Stage', 'Documents', ''].map((h) => <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-50">
            {candidates.map((c) => {
              const docsUploaded = (c.candidate_documents || []).filter((d: any) => d.verified).length;
              return (
                <tr key={c.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">{c.first_name?.[0]}</div>
                      <div><p className="text-sm font-medium text-slate-900">{c.first_name} {c.last_name}</p><p className="text-xs text-slate-400">{c.nationality}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.requisitions?.position || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.operations?.country_code || '—'}</td>
                  <td className="px-4 py-3">
                    <select value={c.stage} onChange={(e) => updateStage(c.id, e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                      {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${docsUploaded === DOCUMENT_TYPES.length ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {docsUploaded}/{DOCUMENT_TYPES.length} verified
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/candidates/${c.id}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Manage →</Link>
                  </td>
                </tr>
              );
            })}
            {candidates.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-sm text-slate-400">No candidates assigned to your agency yet</td></tr>}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Add Candidate</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">First Name</label><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Last Name</label><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              </div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Nationality</label><input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Passport Number</label><input value={form.passport_number} onChange={(e) => setForm({ ...form, passport_number: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Requisition</label>
                <select value={form.requisition_id} onChange={(e) => setForm({ ...form, requisition_id: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select…</option>
                  {requisitions.map((r) => <option key={r.id} value={r.id}>{r.requisition_id} — {r.position}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={save} disabled={!form.first_name || !form.requisition_id} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">Add Candidate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
