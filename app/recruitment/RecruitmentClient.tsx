'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { STAGES, STAGE_LABELS } from '@/lib/stages';

export default function RecruitmentClient({
  initialCandidates, requisitions, operations, agencies,
}: { initialCandidates: any[]; requisitions: any[]; operations: any[]; agencies: any[] }) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [opFilter, setOpFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const supabase = createClient();

  const blank = { first_name: '', last_name: '', nationality: '', passport_number: '', requisition_id: '', agency_id: '', operation_id: operations[0]?.id || '' };
  const [form, setForm] = useState<any>(blank);

  const filtered = candidates.filter((c) => opFilter === 'all' || c.operation_id === opFilter);

  const move = async (id: string, dir: number) => {
    const c = candidates.find((x) => x.id === id);
    const i = STAGES.indexOf(c.stage);
    const newStage = STAGES[Math.max(0, Math.min(STAGES.length - 1, i + dir))];
    const { data, error } = await supabase.from('candidates').update({ stage: newStage }).eq('id', id)
      .select('*, requisitions(position, requisition_id), operations(name, country_code), agencies(name)').single();
    if (!error && data) setCandidates((p) => p.map((x) => (x.id === id ? data : x)));
  };

  const save = async () => {
    const newId = `CAND-${Date.now().toString().slice(-6)}`;
    const req = requisitions.find((r) => r.id === form.requisition_id);
    const { data, error } = await supabase.from('candidates').insert({
      ...form,
      candidate_id: newId,
      operation_id: req?.operation_id || form.operation_id,
      agency_id: form.agency_id || null,
    }).select('*, requisitions(position, requisition_id), operations(name, country_code), agencies(name)').single();
    if (!error && data) {
      setCandidates((p) => [data, ...p]);
      setAddOpen(false);
      setForm(blank);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recruitment Pipeline</h1>
          <p className="text-sm text-slate-500 mt-0.5">{candidates.length} candidates across {STAGES.length} mobilization stages</p>
        </div>
        <div className="flex gap-2">
          {operations.length > 1 && (
            <select value={opFilter} onChange={(e) => setOpFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All Countries</option>
              {operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <button onClick={() => { setForm({ ...blank, operation_id: operations[0]?.id || '' }); setAddOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
            <Plus size={14} /> Add Candidate
          </button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageCandidates = filtered.filter((c) => c.stage === stage);
          return (
            <div key={stage} className="flex-shrink-0 w-56">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-slate-600">{STAGE_LABELS[stage]}</span>
                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{stageCandidates.length}</span>
              </div>
              <div className="space-y-2 min-h-20">
                {stageCandidates.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow">
                    <Link href={`/candidates/${c.id}`} className="block">
                      <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-600 mb-2">{c.first_name?.[0]}</div>
                      <p className="text-xs font-semibold text-slate-800">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-slate-400">{c.nationality}</p>
                      <p className="text-xs text-slate-500 mt-1 truncate">{c.requisitions?.position || 'No requisition'}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {c.operations?.country_code && <span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{c.operations.country_code}</span>}
                        {c.agencies?.name && <span className="text-xs text-slate-400 truncate">{c.agencies.name}</span>}
                      </div>
                    </Link>
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => move(c.id, -1)} className="flex-1 text-xs bg-slate-50 hover:bg-slate-100 rounded-lg py-1 transition-colors">←</button>
                      <button onClick={() => move(c.id, 1)} className="flex-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg py-1 transition-colors">→</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Agency (optional)</label>
                <select value={form.agency_id} onChange={(e) => setForm({ ...form, agency_id: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Not assigned yet</option>
                  {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
