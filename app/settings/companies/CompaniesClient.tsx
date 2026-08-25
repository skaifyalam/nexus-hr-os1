'use client';
import { useState } from 'react';
import { Plus, X, Edit2, Trash2, Building2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function CompaniesClient({
  initialCompanies, counts = {}, companyId = '',
}: { initialCompanies: any[]; counts?: Record<string, number>; companyId?: string }) {
  const supabase = createClient();
  const [companies, setCompanies] = useState<any[]>(initialCompanies);
  const [modal, setModal] = useState<{ open: boolean; editing: string | null }>({ open: false, editing: null });
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const openAdd = () => { setName(''); setModal({ open: true, editing: null }); setError(''); };
  const openEdit = (c: any) => { setName(c.name); setModal({ open: true, editing: c.id }); setError(''); };

  const save = async () => {
    if (!name.trim()) { setError('Company name is required.'); return; }
    if (modal.editing) {
      const { data, error: e } = await supabase.from('sub_companies')
        .update({ name: name.trim() }).eq('id', modal.editing).select().single();
      if (e) { setError(e.message); return; }
      if (data) setCompanies(p => p.map(c => (c.id === modal.editing ? data : c)));
    } else {
      const { data, error: e } = await supabase.from('sub_companies')
        .insert({ company_id: companyId, name: name.trim() }).select().single();
      if (e) { setError(e.message); return; }
      if (data) setCompanies(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setModal({ open: false, editing: null });
  };

  const remove = async (id: string) => {
    if ((counts[id] || 0) > 0) {
      setError('Cannot delete — people are still assigned to this company. Reassign them first.');
      return;
    }
    if (!confirm('Delete this company?')) return;
    const { error: e } = await supabase.from('sub_companies').delete().eq('id', id);
    if (e) { setError(e.message); return; }
    setCompanies(p => p.filter(c => c.id !== id));
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Sub-companies managed under your account — used to label who each person belongs to
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
          <Plus size={15} />Add Company
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {companies.map(c => (
          <div key={c.id} className="flex items-center justify-between px-5 py-4 border-b border-slate-50 last:border-0 group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Building2 size={16} className="text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Users size={10} /> {counts[c.id] || 0} employees
                </p>
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={14} /></button>
              <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {companies.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-10">
            No companies yet — they appear here automatically when you link a Company column on import, or add one manually.
          </p>
        )}
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModal({ open: false, editing: null })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">{modal.editing ? 'Edit' : 'Add'} Company</h2>
              <button onClick={() => setModal({ open: false, editing: null })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Company Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Contracting"
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModal({ open: false, editing: null })} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={save} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">{modal.editing ? 'Save Changes' : 'Add Company'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
