'use client';
import { useState } from 'react';
import { Plus, X, GitBranch, Trash2, ArrowDown, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ApprovalsClient({ initialWorkflows, roles, sections, companyId }: {
  initialWorkflows: any[]; roles: any[]; sections: any[]; companyId: string;
}) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const supabase = createClient();

  // Built-in processes + any custom section can have a workflow
  const PROCESSES = [
    { key: 'leave', label: 'Leave Requests' },
    { key: 'requisition', label: 'Requisitions' },
    { key: 'conduct', label: 'Conduct / Warnings' },
    { key: 'exit', label: 'Exit / Offboarding' },
    { key: 'grievance', label: 'Grievances' },
    { key: 'employee', label: 'New Employee (adding)' },
    { key: 'candidate', label: 'New Candidate (adding)' },
    { key: 'attendance', label: 'Attendance Changes' },
    { key: 'document', label: 'Document Updates' },
    ...sections.filter((s: any) => !['employee'].includes(s.section_key)).map((s: any) => ({ key: `section:${s.section_key}`, label: s.label })),
  ];

  const [open, setOpen] = useState(false);
  const [wName, setWName] = useState('');
  const [wProcess, setWProcess] = useState('leave');
  const [wSteps, setWSteps] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const addStep = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    setWSteps(s => [...s, { role_id: role.id, role_name: role.name }]);
  };
  const removeStep = (i: number) => setWSteps(s => s.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!wName.trim() || wSteps.length === 0) return;
    setSaving(true);
    const { data } = await supabase.from('approval_workflows').insert({
      company_id: companyId, process_key: wProcess, name: wName.trim(), steps: wSteps, active: true,
    }).select().single();
    setSaving(false);
    if (data) { setWorkflows(p => [...p, data]); setWName(''); setWSteps([]); setWProcess('leave'); setOpen(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this approval workflow?')) return;
    await supabase.from('approval_workflows').delete().eq('id', id);
    setWorkflows(p => p.filter(w => w.id !== id));
  };

  const processLabel = (key: string) => PROCESSES.find(p => p.key === key)?.label || key;

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Approval Workflows</h1>
          <p className="text-sm text-slate-500 mt-0.5">Build custom approval chains for any process — nothing hardcoded</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />New Workflow</button>
      </div>

      {workflows.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
          <GitBranch size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600 mb-1">No approval workflows yet</p>
          <p className="text-xs text-slate-400">Create one like: Leave → Project Manager → HR Admin → HR Manager → approved.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map(w => (
            <div key={w.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{w.name}</p>
                  <p className="text-xs text-slate-400">For: {processLabel(w.process_key)}</p>
                </div>
                <button onClick={() => del(w.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={13} /></button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">Request</span>
                {(w.steps || []).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <ArrowDown size={12} className="text-slate-300 rotate-[-90deg]" />
                    <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg">{s.role_name}</span>
                  </div>
                ))}
                <ArrowDown size={12} className="text-slate-300 rotate-[-90deg]" />
                <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg">Approved</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">New Approval Workflow</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Workflow name</label>
                <input value={wName} onChange={e => setWName(e.target.value)} placeholder="e.g. Standard Leave Approval" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Applies to</label>
                <select value={wProcess} onChange={e => setWProcess(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {PROCESSES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Approval steps (in order)</label>
                {wSteps.length === 0 && <p className="text-xs text-slate-400">Add roles below. The request flows through them top to bottom.</p>}
                <div className="space-y-2">
                  {wSteps.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="text-sm text-slate-700 flex-1">{s.role_name}</span>
                      <button onClick={() => removeStep(i)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                    </div>
                  ))}
                </div>
                {roles.length === 0 ? (
                  <p className="text-xs text-amber-600">Create roles first (Roles & Users → Roles).</p>
                ) : (
                  <select value="" onChange={e => { if (e.target.value) addStep(e.target.value); }} className="w-full border border-dashed border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-white text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">+ Add approval step (pick a role)…</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={save} disabled={!wName.trim() || wSteps.length === 0 || saving} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">{saving ? 'Saving…' : 'Create Workflow'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
