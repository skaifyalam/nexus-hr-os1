'use client';
import { useState, useRef, useMemo } from 'react';
import {
  Plus, X, Search, Upload, Loader, Download, LayoutGrid, Table2,
  Settings, Sparkles, Check, Trash2, Edit2, FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

export default function UniversalSection({ section, initialFields, initialRecords, companyId }: {
  section: any; initialFields: any[]; initialRecords: any[]; companyId: string;
}) {
  const [fields, setFields] = useState(initialFields);
  const [records, setRecords] = useState(initialRecords);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const uploadRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const configured = fields.length > 0;
  const stageField = useMemo(() => fields.find(f => /status|stage/i.test(f.field_label)), [fields]);
  const idField = useMemo(() => fields.find(f => f.is_id_field), [fields]);
  const nameField = useMemo(() => fields.find(f => /name|title/i.test(f.field_label)) || fields[0], [fields]);

  const stages = useMemo(() => {
    if (stageField?.options?.length > 0) return stageField.options;
    const set = new Set<string>();
    records.forEach(r => { const v = r.data?.[stageField?.field_key]; if (v) set.add(String(v)); });
    return Array.from(set);
  }, [stageField, records]);

  const filtered = records.filter(r => {
    const matchSearch = !search || JSON.stringify(r.data || {}).toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || r.data?.[stageField?.field_key] === stageFilter;
    return matchSearch && matchStage;
  });

  // ─── STEP 1: Upload template to configure the section ────────
  const analyzeFile = (file: File) => {
    setAnalyzing(true); setError('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const headers = (allRows[0] || []).map((h: any) => String(h).trim()).filter(Boolean);

        if (headers.length === 0) { setError('No column headers found in row 1.'); setAnalyzing(false); return; }

        const dataRows = allRows.slice(1).filter(r => r.some(c => c !== '' && c != null));
        const sampleRows = dataRows.slice(0, 10).map(r => {
          const o: any = {}; headers.forEach((h: string, i: number) => o[h] = r[i] ?? ''); return o;
        });

        const res = await fetch('/api/analyze-fields', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headers, sample_rows: sampleRows, section_key: section.section_key, company_id: companyId }),
        });
        const data = await res.json();
        if (data.error) { setError(data.error); setAnalyzing(false); return; }

        setFields(data.fields || []);
        await supabase.from('company_sections').update({ is_configured: true }).eq('id', section.id);
      } catch (err: any) { setError(err.message); }
      setAnalyzing(false);
    };
    reader.readAsBinaryString(file);
  };

  // ─── Save a record ──────────────────────────────────────────
  const saveRecord = async () => {
    if (editingId) {
      const { data } = await supabase.from('section_records')
        .update({ data: form, updated_at: new Date().toISOString() }).eq('id', editingId).select().single();
      if (data) setRecords(p => p.map(r => r.id === editingId ? data : r));
    } else {
      let recordId = idField ? form[idField.field_key] : null;
      if (idField && !recordId) {
        const { data: idVal } = await supabase.rpc('generate_section_id', { p_section_pk: section.id });
        recordId = idVal; form[idField.field_key] = idVal;
      }
      const { data } = await supabase.from('section_records')
        .insert({ company_id: companyId, section_key: section.section_key, record_id: recordId, data: form }).select().single();
      if (data) setRecords(p => [data, ...p]);
    }
    setForm({}); setEditingId(null); setAddOpen(false);
  };

  const editRecord = (r: any) => { setForm(r.data || {}); setEditingId(r.id); setAddOpen(true); };
  const deleteRecord = async (id: string) => {
    await supabase.from('section_records').delete().eq('id', id);
    setRecords(p => p.filter(r => r.id !== id));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(r => r.id)));
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    await supabase.from('section_records').delete().in('id', ids);
    setRecords(p => p.filter(r => !selected.has(r.id)));
    setSelected(new Set());
  };

  const clearAll = async () => {
    await supabase.from('section_records').delete()
      .eq('company_id', companyId).eq('section_key', section.section_key);
    setRecords([]);
    setSelected(new Set());
  };

  // ─── Bulk import data ───────────────────────────────────────
  const importData = (file: File) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'binary' });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const valid = rows.filter(r => Object.values(r).some(v => v !== ''));

      const newRecords = [];
      for (const row of valid) {
        const data: any = {};
        fields.forEach(f => {
          const mk = Object.keys(row).find(k => k.trim().toLowerCase() === f.field_label.trim().toLowerCase());
          if (mk) data[f.field_key] = row[mk];
        });
        let recordId = idField ? data[idField.field_key] : null;
        if (idField && !recordId) {
          const { data: idVal } = await supabase.rpc('generate_section_id', { p_section_pk: section.id });
          recordId = idVal; data[idField.field_key] = idVal;
        }
        newRecords.push({ company_id: companyId, section_key: section.section_key, record_id: recordId, data });
      }
      if (newRecords.length > 0) {
        const { data } = await supabase.from('section_records').insert(newRecords).select();
        if (data) setRecords(p => [...data, ...p]);
      }
      setImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  // ─── Export in original template format ─────────────────────
  const exportData = () => {
    const headers = fields.map(f => f.field_label);
    const rows = records.map(r => fields.map(f => r.data?.[f.field_key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, section.label);
    XLSX.writeFile(wb, `${section.label.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const updateStage = async (recId: string, newStage: string) => {
    const rec = records.find(r => r.id === recId);
    const newData = { ...rec.data, [stageField.field_key]: newStage };
    const { data } = await supabase.from('section_records').update({ data: newData }).eq('id', recId).select().single();
    if (data) setRecords(p => p.map(r => r.id === recId ? data : r));
  };

  const renderInput = (f: any) => {
    const val = form[f.field_key] ?? '';
    const base = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
    if (f.field_type === 'dropdown' && f.options?.length > 0)
      return <select value={val} onChange={e => setForm({ ...form, [f.field_key]: e.target.value })} className={`${base} bg-white`}><option value="">Select…</option>{f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>;
    if (f.field_type === 'boolean')
      return <button type="button" onClick={() => setForm({ ...form, [f.field_key]: !val })} className={`px-4 py-2.5 rounded-xl border text-sm ${val ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200'}`}>{val ? '✓ Yes' : 'No'}</button>;
    return <input type={f.field_type === 'date' ? 'date' : f.field_type === 'number' ? 'number' : 'text'} value={val} onChange={e => setForm({ ...form, [f.field_key]: e.target.value })} className={base} />;
  };

  const tableFields = fields.slice(0, 7);

  // ═══ EMPTY STATE — section not configured yet ═══════════════
  if (!configured) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{section.label}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Set up this section by uploading your Excel — AI builds it to match your structure</p>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>}
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          {analyzing ? (
            <div className="py-6">
              <div className="flex gap-2 justify-center mb-4">{[0,1,2,3].map(i => <div key={i} className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.12}s` }} />)}</div>
              <p className="text-sm font-medium text-slate-600">AI is reading your file and building this section…</p>
              <p className="text-xs text-slate-400 mt-1">Detecting columns, types, dropdowns, and ID patterns</p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet size={24} className="text-indigo-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">Upload your Excel to build this section</h3>
              <p className="text-sm text-slate-500 mb-5 max-w-md mx-auto">AI reads your column headers and automatically creates the right fields, dropdowns, and ID format — in your exact structure.</p>
              <button onClick={() => uploadRef.current?.click()} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
                <Upload size={15} />Upload Excel File
              </button>
              <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && analyzeFile(e.target.files[0])} />
              <p className="text-xs text-slate-400 mt-4">Or <button onClick={async () => {
                // Manual: create one blank text field to start
                const { data } = await supabase.from('section_field_configs').insert({
                  company_id: companyId, section_key: section.section_key, field_key: 'name', field_label: 'Name', field_type: 'text', display_order: 1,
                }).select().single();
                if (data) setFields([data]);
                await supabase.from('company_sections').update({ is_configured: true }).eq('id', section.id);
              }} className="text-indigo-600 hover:underline">start with a blank field</button> and build manually</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ═══ CONFIGURED — full section UI ═══════════════════════════
  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{section.label}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{records.length} records · {fields.length} fields</p>
        </div>
        <div className="flex gap-2">
          {records.length > 0 && (
            <button onClick={() => { if (confirm(`Delete ALL ${records.length} records in ${section.label}? This cannot be undone.`)) clearAll(); }} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-red-200 rounded-xl text-red-600 hover:bg-red-50"><Trash2 size={14} />Clear All</button>
          )}
          <button onClick={exportData} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Download size={14} />Export</button>
          <button onClick={() => importRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">{importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}Import</button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && importData(e.target.files[0])} />
          <button onClick={() => { setForm({}); setEditingId(null); setAddOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />Add Record</button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all fields…" className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
        </div>
        {stageField && stages.length > 0 && (
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700">
            <option value="all">All {stageField.field_label}</option>
            {stages.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {stageField && (
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${view === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}><Table2 size={13} />Table</button>
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${view === 'kanban' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}><LayoutGrid size={13} />Kanban</button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-600 text-white rounded-xl px-4 py-2.5 mb-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-medium transition-colors">
            <Trash2 size={13} />Delete Selected
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-indigo-100 hover:text-white ml-auto">Clear selection</button>
        </div>
      )}

      {view === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-100">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleSelectAll} className="rounded cursor-pointer" />
                </th>
                {tableFields.map(f => <th key={f.id} className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">{f.field_label}</th>)}
                <th className="px-4 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(r => (
                  <tr key={r.id} className={`hover:bg-slate-50/50 group ${selected.has(r.id) ? 'bg-indigo-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded cursor-pointer" />
                    </td>
                    {tableFields.map(f => (
                      <td key={f.id} className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {f.is_id_field ? <span className="font-mono text-xs text-slate-400">{r.data?.[f.field_key]}</span>
                         : f.field_type === 'boolean' ? (r.data?.[f.field_key] ? '✓' : '—')
                         : String(r.data?.[f.field_key] || '—')}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => editRecord(r)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={13} /></button>
                        <button onClick={() => deleteRecord(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={tableFields.length + 2} className="text-center py-10 text-sm text-slate-400">No records — add one or import your Excel</td></tr>}
              </tbody>
            </table>
          </div>
          {fields.length > 7 && <p className="text-xs text-slate-400 px-4 py-2 border-t border-slate-50">Showing 7 of {fields.length} fields. Full data in export & edit view.</p>}
        </div>
      )}

      {view === 'kanban' && stageField && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage: string) => {
            const cols = filtered.filter(r => r.data?.[stageField.field_key] === stage);
            return (
              <div key={stage} className="flex-shrink-0 w-56">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-slate-600">{stage}</span>
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{cols.length}</span>
                </div>
                <div className="space-y-2">
                  {cols.map(r => (
                    <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                      <p className="text-xs font-semibold text-slate-800">{r.data?.[nameField?.field_key] || 'Untitled'}</p>
                      {idField && <p className="text-xs text-slate-400 font-mono mt-0.5">{r.data?.[idField.field_key]}</p>}
                      <select value={stage} onChange={e => updateStage(r.id, e.target.value)} className="mt-2 w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
                        {stages.map((s: string) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit' : 'Add'} Record</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {fields.map(f => (
                <div key={f.id} className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{f.field_label}{f.required && <span className="text-red-500 ml-1">*</span>}</label>
                  {renderInput(f)}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={saveRecord} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">{editingId ? 'Save Changes' : 'Add Record'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
