'use client';
import { useState } from 'react';
import { Plus, Edit2, Trash2, X, AlertCircle, Building2, Upload, Download, Loader } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

export default function AgenciesSettingsClient({ initialAgencies, candCounts, companyId }: { initialAgencies: any[]; candCounts: any[]; companyId: string }) {
  const [agencies, setAgencies] = useState(initialAgencies);
  const [modal, setModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ name: '', country: '', contact_name: '', contact_email: '', contact_phone: '', status: 'active' });
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const supabase = createClient();

  const countFor = (id: string) => candCounts.filter((c) => c.agency_id === id).length;

  // Export all agencies to Excel
  const exportAgencies = () => {
    const rows = agencies.map(a => ({
      'Agency Name': a.name || '', 'Country': a.country || '',
      'Contact Name': a.contact_name || '', 'Contact Email': a.contact_email || '',
      'Contact Phone': a.contact_phone || '', 'Status': a.status || 'active',
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Agency Name': '', 'Country': '', 'Contact Name': '', 'Contact Email': '', 'Contact Phone': '', 'Status': '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agencies');
    XLSX.writeFile(wb, `agencies-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Import agencies from Excel (upsert by name — updates existing, adds new)
  const importAgencies = (file: File) => {
    setImporting(true); setImportMsg('Reading…');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (rows.length === 0) { setImportMsg('No rows found in the file.'); setImporting(false); return; }
        // Flexible column matching
        const col = (row: any, names: string[]) => {
          const keys = Object.keys(row);
          for (const n of names) {
            const k = keys.find(k => k.toLowerCase().replace(/[^a-z]/g, '') === n.toLowerCase().replace(/[^a-z]/g, ''));
            if (k) return row[k];
          }
          return '';
        };
        const existingByName = new Map(agencies.map(a => [String(a.name).trim().toLowerCase(), a]));
        const toInsert: any[] = []; const toUpdate: any[] = [];
        for (const row of rows) {
          const name = String(col(row, ['agency name', 'name', 'agency'])).trim();
          if (!name) continue;
          const rec = {
            name, country: String(col(row, ['country'])).trim(),
            contact_name: String(col(row, ['contact name', 'contact'])).trim(),
            contact_email: String(col(row, ['contact email', 'email'])).trim(),
            contact_phone: String(col(row, ['contact phone', 'phone'])).trim(),
            status: String(col(row, ['status'])).trim().toLowerCase() || 'active',
            company_id: companyId,
          };
          const existing = existingByName.get(name.toLowerCase());
          if (existing) toUpdate.push({ id: existing.id, ...rec });
          else toInsert.push(rec);
        }
        let added = 0, updated = 0;
        if (toInsert.length > 0) {
          const { data } = await supabase.from('agencies').insert(toInsert).select();
          if (data) { setAgencies(p => [...p, ...data]); added = data.length; }
        }
        for (const u of toUpdate) {
          const { id, ...fields } = u;
          const { data } = await supabase.from('agencies').update(fields).eq('id', id).select().single();
          if (data) { setAgencies(p => p.map(a => a.id === id ? data : a)); updated++; }
        }
        setImportMsg(`✓ Imported ${added} new, updated ${updated} existing.`);
      } catch (err: any) {
        setImportMsg(`Import failed: ${err.message}`);
      }
      setImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const blank = { name: '', country: '', contact_name: '', contact_email: '', contact_phone: '', status: 'active' };

  const openAdd = () => { setForm(blank); setModal({ open: true, editing: null }); setError(''); };
  const openEdit = (a: any) => { setForm({ name: a.name, country: a.country || '', contact_name: a.contact_name || '', contact_email: a.contact_email || '', contact_phone: a.contact_phone || '', status: a.status || 'active' }); setModal({ open: true, editing: a.id }); setError(''); };

  const save = async () => {
    if (!form.name.trim()) { setError('Agency name is required.'); return; }
    if (modal.editing) {
      const { data, error } = await supabase.from('agencies').update(form).eq('id', modal.editing).select().single();
      if (error) { setError(error.message); return; }
      setAgencies((p) => p.map((a) => (a.id === modal.editing ? data : a)));
    } else {
      const { data, error } = await supabase.from('agencies').insert({ ...form, company_id: companyId }).select().single();
      if (error) { setError(error.message); return; }
      setAgencies((p) => [...p, data]);
    }
    setModal({ open: false, editing: null });
  };

  const del = async (id: string) => {
    const linked = countFor(id);
    if (linked > 0) {
      const ok = confirm(
        `This agency has ${linked} candidate record(s) linked in the legacy candidates table — ` +
        `these may be old/hidden records not visible in your Recruitment Pipeline. ` +
        `\n\nDelete the agency and unlink those records? (The candidate rows are not deleted, just unlinked.)`
      );
      if (!ok) return;
      // Unlink legacy candidates from this agency, then delete the agency
      const { error: unlinkErr } = await supabase.from('candidates').update({ agency_id: null }).eq('agency_id', id);
      if (unlinkErr) { setError(unlinkErr.message); return; }
    }
    const { error } = await supabase.from('agencies').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    setAgencies((p) => p.filter((a) => a.id !== id));
    setError('');
  };

  const fields: [string, string, string][] = [
    ['name', 'Agency Name', 'e.g. Gulf Manpower Sourcing'],
    ['country', 'Country', 'e.g. India'],
    ['contact_name', 'Contact Person', 'e.g. Rajesh Kumar'],
    ['contact_email', 'Contact Email', 'e.g. ops@agency.com'],
    ['contact_phone', 'Contact Phone', 'e.g. +91 99999 00000'],
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agencies</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage overseas recruitment agencies</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" id="agency-import" onChange={e => e.target.files?.[0] && importAgencies(e.target.files[0])} />
          <button onClick={() => document.getElementById('agency-import')?.click()} disabled={importing} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-40">
            {importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />} Import
          </button>
          <button onClick={exportAgencies} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">
            <Download size={14} /> Export
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
            <Plus size={14} /> Add Agency
          </button>
        </div>
      </div>

      {importMsg && (
        <div className={`text-sm p-3 rounded-xl mb-4 ${importMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>{importMsg}</div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4">
          <AlertCircle size={14} className="flex-shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="divide-y divide-slate-50">
          {agencies.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                  <Building2 size={15} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{a.name}</p>
                  <p className="text-xs text-slate-400">
                    {a.country && `${a.country} · `}
                    {a.contact_email && `${a.contact_email} · `}
                    {countFor(a.id)} candidates
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>{a.status}</span>
                <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={14} /></button>
                <button onClick={() => del(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {agencies.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No agencies yet</p>}
        </div>
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModal({ open: false, editing: null })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{modal.editing ? 'Edit Agency' : 'Add Agency'}</h2>
              <button onClick={() => setModal({ open: false, editing: null })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-3">
              {fields.map(([key, label, placeholder]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{label}</label>
                  <input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal({ open: false, editing: null })} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={save} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">{modal.editing ? 'Save Changes' : 'Add Agency'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
