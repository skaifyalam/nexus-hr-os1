'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight, MapPin, Briefcase, Building2, DollarSign, Calendar,
  ArrowRight, Plus, Check, X, Clock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const TYPE_LABEL: Record<string, string> = {
  initial_hire: 'Initial Hire',
  transfer: 'Country Transfer',
  project_change: 'Project Change',
  department_change: 'Department Change',
  role_change: 'Title Change',
  salary_revision: 'Salary Revision',
  update: 'Updated',
};

const TYPE_COLOR: Record<string, string> = {
  initial_hire: 'bg-indigo-100 text-indigo-600',
  transfer: 'bg-violet-100 text-violet-600',
  project_change: 'bg-blue-100 text-blue-600',
  department_change: 'bg-amber-100 text-amber-600',
  role_change: 'bg-emerald-100 text-emerald-600',
  salary_revision: 'bg-teal-100 text-teal-600',
  update: 'bg-slate-100 text-slate-600',
};

export default function ProfileClient({
  employee, history, transfers, operations, projects, departments,
}: { employee: any; history: any[]; transfers: any[]; operations: any[]; projects: any[]; departments: any[] }) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<any>(transfers.find((t) => t.status !== 'completed' && t.status !== 'cancelled') || null);
  const router = useRouter();
  const supabase = createClient();

  const opName = (id: string) => operations.find((o) => o.id === id)?.name || '—';
  const projName = (id: string) => { const p = projects.find((x) => x.id === id); return p ? `${p.project_code} ${p.project_name}` : '—'; };
  const deptName = (id: string) => departments.find((d) => d.id === id)?.name || '—';

  const [form, setForm] = useState({
    to_operation_id: '', to_project_id: '', reason: '', target_join_date: '',
  });

  const initiateTransfer = async () => {
    const transferId = `TRF-${Date.now().toString().slice(-6)}`;
    const { data, error } = await supabase
      .from('transfer_requests')
      .insert({
        transfer_id: transferId,
        employee_id: employee.id,
        from_operation_id: employee.operation_id,
        to_operation_id: form.to_operation_id,
        from_project_id: employee.current_project_id,
        to_project_id: form.to_project_id || null,
        reason: form.reason,
        target_join_date: form.target_join_date || null,
        status: 'in_progress',
      })
      .select('*, checklist:transfer_checklist(*)')
      .single();

    if (!error && data) {
      setActiveTransfer(data);
      setTransferOpen(false);
    }
  };

  const toggleChecklistItem = async (itemId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await supabase.from('transfer_checklist').update({
      status: newStatus,
      completed_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', itemId);

    setActiveTransfer((prev: any) => ({
      ...prev,
      checklist: prev.checklist.map((c: any) => c.id === itemId ? { ...c, status: newStatus } : c),
    }));
  };

  const completeTransfer = async () => {
    // Move the employee to the new country/project — this automatically
    // triggers the permanent history log in the database.
    await supabase.from('employees').update({
      operation_id: activeTransfer.to_operation_id,
      current_project_id: activeTransfer.to_project_id,
    }).eq('id', employee.id);

    await supabase.from('transfer_requests').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', activeTransfer.id);

    router.refresh();
    setActiveTransfer(null);
  };

  const allChecklistDone = activeTransfer?.checklist?.every((c: any) => c.status === 'completed');
  const projectsForTransfer = projects.filter((p) => p.operation_id === form.to_operation_id);

  return (
    <div>
      <Link href="/employees" className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-5 transition-colors w-fit">
        <ChevronRight size={14} className="rotate-180" /> Back to Employees
      </Link>

      <div className="grid grid-cols-3 gap-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-2xl flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4">
            {employee.first_name?.[0]}
          </div>
          <h2 className="text-lg font-bold text-slate-900">{employee.first_name} {employee.last_name}</h2>
          <p className="text-sm text-slate-500">{employee.job_title}</p>
          <p className="text-xs text-slate-400">{employee.employee_id}</p>

          <div className="mt-4 space-y-2 text-left border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 text-xs"><MapPin size={12} className="text-slate-400" /><span className="text-slate-600">{employee.operations?.name || '—'}</span></div>
            <div className="flex items-center gap-2 text-xs"><Briefcase size={12} className="text-slate-400" /><span className="text-slate-600">{employee.projects ? `${employee.projects.project_code} — ${employee.projects.project_name}` : 'No project assigned'}</span></div>
            <div className="flex items-center gap-2 text-xs"><Building2 size={12} className="text-slate-400" /><span className="text-slate-600">{employee.departments?.name || '—'}</span></div>
            <div className="flex items-center gap-2 text-xs"><DollarSign size={12} className="text-slate-400" /><span className="text-slate-600">SAR {Number(employee.salary || 0).toLocaleString()}/mo</span></div>
            <div className="flex items-center gap-2 text-xs"><Calendar size={12} className="text-slate-400" /><span className="text-slate-600">Joined {employee.joining_date}</span></div>
          </div>

          {!activeTransfer && (
            <button onClick={() => setTransferOpen(true)} className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
              <ArrowRight size={14} /> Initiate Transfer
            </button>
          )}
        </div>

        <div className="col-span-2 space-y-4">
          {/* Active transfer checklist */}
          {activeTransfer && (
            <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900">Transfer In Progress — {activeTransfer.transfer_id}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-medium">{activeTransfer.status.replace('_', ' ')}</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                {opName(activeTransfer.from_operation_id)} → {opName(activeTransfer.to_operation_id)}
                {activeTransfer.to_project_id && ` · ${projName(activeTransfer.to_project_id)}`}
              </p>
              <div className="space-y-2 mb-4">
                {activeTransfer.checklist?.map((item: any) => (
                  <button key={item.id} onClick={() => toggleChecklistItem(item.id, item.status)} className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors ${item.status === 'completed' ? 'bg-emerald-50' : 'bg-slate-50 hover:bg-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${item.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-slate-200'}`}>
                        {item.status === 'completed' ? <Check size={11} /> : <Clock size={11} className="text-slate-400" />}
                      </div>
                      <span className="text-sm text-slate-700">{item.stage}</span>
                    </div>
                    {item.completed_date && <span className="text-xs text-slate-400">{item.completed_date}</span>}
                  </button>
                ))}
              </div>
              <button
                onClick={completeTransfer}
                disabled={!allChecklistDone}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check size={14} /> {allChecklistDone ? 'Complete Transfer & Move Employee' : 'Complete all checklist items to finish transfer'}
              </button>
            </div>
          )}

          {/* History timeline */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Complete History</h3>
            {history.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No history yet</p>
            ) : (
              <div className="space-y-0">
                {history.map((h, i) => (
                  <div key={h.id} className="flex gap-4 pb-5 relative">
                    {i !== history.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-100" />}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${TYPE_COLOR[h.assignment_type] || 'bg-slate-100 text-slate-600'}`}>
                      <Clock size={13} />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-900">{TYPE_LABEL[h.assignment_type] || h.assignment_type}</span>
                        <span className="text-xs text-slate-400">{h.start_date}{h.end_date ? ` → ${h.end_date}` : ' → Present'}</span>
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        <p>{opName(h.operation_id)}{h.project_id ? ` · ${projName(h.project_id)}` : ''}</p>
                        <p>{deptName(h.department_id)} · {h.job_title}</p>
                        <p>SAR {Number(h.salary || 0).toLocaleString()}/month</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Initiate Transfer Modal */}
      {transferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setTransferOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Initiate Transfer</h2>
              <button onClick={() => setTransferOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                Currently in: <span className="font-medium text-slate-700">{employee.operations?.name}</span>
                {employee.projects && ` · ${employee.projects.project_code} ${employee.projects.project_name}`}
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Transfer To Country</label>
                <select value={form.to_operation_id} onChange={(e) => setForm({ ...form, to_operation_id: e.target.value, to_project_id: '' })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select destination…</option>
                  {operations.filter((o) => o.id !== employee.operation_id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              {form.to_operation_id && projectsForTransfer.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Destination Project (optional)</label>
                  <select value={form.to_project_id} onChange={(e) => setForm({ ...form, to_project_id: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">No specific project</option>
                    {projectsForTransfer.map((p) => <option key={p.id} value={p.id}>{p.project_code} — {p.project_name}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Target Join Date</label>
                <input type="date" value={form.target_join_date} onChange={(e) => setForm({ ...form, target_join_date: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Reason</label>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Business need, project requirement…" />
              </div>
              <p className="text-xs text-slate-400">
                This creates a standard checklist (Medical, Biometric, Skill Test, Visa Transfer, Exit/Entry Clearance).
                The employee only moves to the new country once every step is marked complete.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setTransferOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={initiateTransfer} disabled={!form.to_operation_id} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                <Plus size={14} /> Start Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
