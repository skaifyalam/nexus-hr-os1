'use client';
import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Globe, Briefcase, Users, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function OperationsClient({
  initialOperations, initialProjects, employeeCounts, companyId = '',
}: { initialOperations: any[]; initialProjects: any[]; employeeCounts: any[]; companyId?: string }) {
  const [operations, setOperations] = useState(initialOperations);
  const [projects, setProjects] = useState(initialProjects);
  const [opModal, setOpModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [projModal, setProjModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [opForm, setOpForm] = useState({ name: '', country_code: '' });
  const [projForm, setProjForm] = useState({ operation_id: '', project_code: '', project_name: '', client: '' });
  const [error, setError] = useState('');
  const supabase = createClient();

  const countEmployeesIn = (operationId: string) => employeeCounts.filter((e) => e.operation_id === operationId).length;
  const countEmployeesOnProject = (projectId: string) => employeeCounts.filter((e) => e.current_project_id === projectId).length;

  // ─── OPERATIONS (Countries) ────────────────────────────────
  const openAddOp = () => { setOpForm({ name: '', country_code: '' }); setOpModal({ open: true, editing: null }); setError(''); };
  const openEditOp = (o: any) => { setOpForm({ name: o.name, country_code: o.country_code || '' }); setOpModal({ open: true, editing: o.id }); setError(''); };

  const saveOp = async () => {
    if (!opForm.name.trim()) { setError('Country / operation name is required.'); return; }
    if (opModal.editing) {
      const { data, error } = await supabase.from('operations').update(opForm).eq('id', opModal.editing).select().single();
      if (error) { setError(error.message); return; }
      setOperations((p) => p.map((o) => (o.id === opModal.editing ? data : o)));
    } else {
      const { data, error } = await supabase.from('operations').insert({ ...opForm, company_id: companyId }).select().single();
      if (error) { setError(error.message); return; }
      setOperations((p) => [...p, data]);
    }
    setOpModal({ open: false, editing: null });
  };

  const deleteOp = async (id: string) => {
    if (countEmployeesIn(id) > 0) {
      setError('Cannot delete — employees are currently assigned to this country. Reassign or remove them first.');
      return;
    }
    const { error } = await supabase.from('operations').delete().eq('id', id);
    if (error) { setError('Cannot delete — this country still has projects linked to it. Delete its projects first.'); return; }
    setOperations((p) => p.filter((o) => o.id !== id));
  };

  // ─── PROJECTS ───────────────────────────────────────────────
  const openAddProj = () => { setProjForm({ operation_id: operations[0]?.id || '', project_code: '', project_name: '', client: '' }); setProjModal({ open: true, editing: null }); setError(''); };
  const openEditProj = (p: any) => { setProjForm({ operation_id: p.operation_id, project_code: p.project_code || '', project_name: p.project_name || '', client: p.client || '' }); setProjModal({ open: true, editing: p.id }); setError(''); };

  const saveProj = async () => {
    if (!projForm.project_name.trim() || !projForm.operation_id) { setError('Project name and country are required.'); return; }
    if (projModal.editing) {
      const { data, error } = await supabase.from('projects').update(projForm).eq('id', projModal.editing).select().single();
      if (error) { setError(error.message); return; }
      setProjects((p) => p.map((x) => (x.id === projModal.editing ? data : x)));
    } else {
      const { data, error } = await supabase.from('projects').insert({ ...projForm, company_id: companyId }).select().single();
      if (error) { setError(error.message); return; }
      setProjects((p) => [...p, data]);
    }
    setProjModal({ open: false, editing: null });
  };

  const deleteProj = async (id: string) => {
    if (countEmployeesOnProject(id) > 0) {
      setError('Cannot delete — employees are currently assigned to this project. Reassign them first.');
      return;
    }
    await supabase.from('projects').delete().eq('id', id);
    setProjects((p) => p.filter((x) => x.id !== id));
  };

  const opName = (id: string) => operations.find((o) => o.id === id)?.name || '—';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Countries & Projects</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage operations and projects — changes apply instantly across the whole app, no technical setup needed</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4">
          <AlertCircle size={15} className="flex-shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Countries */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Globe size={15} className="text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">Countries / Operations</h3>
            </div>
            <button onClick={openAddOp} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <Plus size={12} /> Add Country
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {operations.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{o.name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    {o.country_code && <span className="px-1.5 py-0.5 bg-slate-100 rounded font-medium">{o.country_code}</span>}
                    <span className="flex items-center gap-1"><Users size={10} /> {countEmployeesIn(o.id)} employees</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditOp(o)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={13} /></button>
                  <button onClick={() => deleteOp(o.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
            {operations.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No countries yet — add your first one</p>}
          </div>
        </div>

        {/* Projects */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Briefcase size={15} className="text-violet-600" />
              <h3 className="text-sm font-semibold text-slate-900">Projects</h3>
            </div>
            <button onClick={openAddProj} disabled={operations.length === 0} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40">
              <Plus size={12} /> Add Project
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.project_code ? `${p.project_code} — ` : ''}{p.project_name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    <span>{opName(p.operation_id)}</span>
                    {p.client && <span>· {p.client}</span>}
                    <span className="flex items-center gap-1"><Users size={10} /> {countEmployeesOnProject(p.id)} employees</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditProj(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={13} /></button>
                  <button onClick={() => deleteProj(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
            {projects.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No projects yet — add your first one</p>}
          </div>
        </div>
      </div>

      {/* Add/Edit Country Modal */}
      {opModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpModal({ open: false, editing: null })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{opModal.editing ? 'Edit Country' : 'Add Country'}</h2>
              <button onClick={() => setOpModal({ open: false, editing: null })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Country / Operation Name</label>
                <input value={opForm.name} onChange={(e) => setOpForm({ ...opForm, name: e.target.value })} placeholder="e.g. Qatar Operations" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Country Code (optional)</label>
                <input value={opForm.country_code} onChange={(e) => setOpForm({ ...opForm, country_code: e.target.value.toUpperCase() })} placeholder="e.g. QA" maxLength={3} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setOpModal({ open: false, editing: null })} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={saveOp} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">{opModal.editing ? 'Save Changes' : 'Add Country'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Project Modal */}
      {projModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setProjModal({ open: false, editing: null })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{projModal.editing ? 'Edit Project' : 'Add Project'}</h2>
              <button onClick={() => setProjModal({ open: false, editing: null })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Country</label>
                <select value={projForm.operation_id} onChange={(e) => setProjForm({ ...projForm, operation_id: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Project Code (optional)</label>
                <input value={projForm.project_code} onChange={(e) => setProjForm({ ...projForm, project_code: e.target.value })} placeholder="e.g. S.045" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Project Name</label>
                <input value={projForm.project_name} onChange={(e) => setProjForm({ ...projForm, project_name: e.target.value })} placeholder="e.g. Berri" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Client (optional)</label>
                <input value={projForm.client} onChange={(e) => setProjForm({ ...projForm, client: e.target.value })} placeholder="e.g. Saudi Aramco" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setProjModal({ open: false, editing: null })} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={saveProj} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">{projModal.editing ? 'Save Changes' : 'Add Project'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
