'use client';
import { useState } from 'react';
import { Plus, Edit2, Trash2, X, AlertCircle, Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function DepartmentsClient({ initialDepartments, memberCounts, companyId }: { initialDepartments: any[]; memberCounts: Record<string, number>; companyId: string }) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [modal, setModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ name: '', code: '' });
  const [error, setError] = useState('');
  const supabase = createClient();

  const countFor = (id: string) => memberCounts[id] || 0;

  const openAdd = () => { setForm({ name: '', code: '' }); setModal({ open: true, editing: null }); setError(''); };
  const openEdit = (d: any) => { setForm({ name: d.name, code: d.code || '' }); setModal({ open: true, editing: d.id }); setError(''); };

  const save = async () => {
    if (!form.name.trim()) { setError('Department name is required.'); return; }
    if (modal.editing) {
      const { data, error } = await supabase.from('departments').update(form).eq('id', modal.editing).select().single();
      if (error) { setError(error.message); return; }
      setDepartments((p) => p.map((d) => (d.id === modal.editing ? data : d)));
    } else {
      const { data, error } = await supabase.from('departments').insert({ ...form, company_id: companyId }).select().single();
      if (error) { setError(error.message); return; }
      setDepartments((p) => [...p, data]);
    }
    setModal({ open: false, editing: null });
  };

  const del = async (id: string) => {
    if (countFor(id) > 0) { setError('Cannot delete — employees are assigned to this department. Reassign them first.'); return; }
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    setDepartments((p) => p.filter((d) => d.id !== id));
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage departments — changes apply instantly across the whole app</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
          <Plus size={14} /> Add Department
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4">
          <AlertCircle size={14} className="flex-shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="divide-y divide-slate-50">
          {departments.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Building2 size={15} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{d.name}</p>
                  <p className="text-xs text-slate-400">
                    {d.code && <span className="px-1.5 py-0.5 bg-slate-100 rounded font-mono mr-2">{d.code}</span>}
                    {countFor(d.id)} employees
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={14} /></button>
                <button onClick={() => del(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {departments.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No departments yet</p>}
        </div>
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModal({ open: false, editing: null })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{modal.editing ? 'Edit Department' : 'Add Department'}</h2>
              <button onClick={() => setModal({ open: false, editing: null })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Department Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Quality Control" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Department Code <span className="text-slate-400 font-normal">(used in ID formats)</span></label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. QC" maxLength={6} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal({ open: false, editing: null })} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={save} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">{modal.editing ? 'Save Changes' : 'Add Department'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
