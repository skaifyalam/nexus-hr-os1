'use client';
import { useState, useRef, useMemo } from 'react';
import { Plus, X, Search, Upload, Loader, Download, LayoutGrid, Table2, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

export default function DynamicPipeline({ fields, initialCandidates, companyId }: {
  fields: any[]; initialCandidates: any[]; companyId: string;
}) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [addOpen, setAddOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [stageFilter, setStageFilter] = useState('all');
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Identify the "status/stage" field (the one that drives the pipeline)
  const stageField = useMemo(() =>
    fields.find(f => /status|stage/i.test(f.field_label)) || null,
  [fields]);

  const idField = useMemo(() => fields.find(f => f.is_id_field), [fields]);

  // Get unique stage values from the stage field's options or from data
  const stages = useMemo(() => {
    if (stageField?.options?.length > 0) return stageField.options;
    const set = new Set<string>();
    candidates.forEach(c => {
      const v = c.custom_data?.[stageField?.field_key];
      if (v) set.add(String(v));
    });
    return Array.from(set);
  }, [stageField, candidates]);

  const filtered = candidates.filter(c => {
    const matchSearch = !search || JSON.stringify(c.custom_data || {}).toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || c.custom_data?.[stageField?.field_key] === stageFilter;
    return matchSearch && matchStage;
  });

  const getVal = (c: any, key: string) => c.custom_data?.[key] ?? '';

  const save = async () => {
    // Generate ID if there's an ID field
    let recordData = { ...form };
    if (idField && !recordData[idField.field_key]) {
      const { data: idVal } = await supabase.rpc('generate_next_id', {
        p_entity_type: 'candidate', p_country_code: '', p_dept_code: '',
      });
      recordData[idField.field_key] = idVal || `CAND-${Date.now().toString().slice(-6)}`;
    }

    const { data, error } = await supabase.from('candidates').insert({
      company_id: companyId,
      candidate_id: recordData[idField?.field_key] || `CAND-${Date.now().toString().slice(-6)}`,
      first_name: recordData[fields.find(f => /name/i.test(f.field_label))?.field_key] || 'Unnamed',
      custom_data: recordData,
      stage: recordData[stageField?.field_key] || 'selection',
    }).select().single();

    if (!error && data) {
      setCandidates(p => [data, ...p]);
      setForm({});
      setAddOpen(false);
    }
  };

  const handleImport = (file: File) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'binary' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const records = rows.filter(r => Object.values(r).some(v => v !== '')).map(row => {
        const custom_data: any = {};
        fields.forEach(f => {
          // Match by label
          const matchKey = Object.keys(row).find(k => k.trim().toLowerCase() === f.field_label.trim().toLowerCase());
          if (matchKey) custom_data[f.field_key] = row[matchKey];
        });
        return {
          company_id: companyId,
          candidate_id: custom_data[idField?.field_key] || `CAND-${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
          first_name: custom_data[fields.find(f => /name/i.test(f.field_label))?.field_key] || 'Unnamed',
          custom_data,
          stage: custom_data[stageField?.field_key] || 'selection',
        };
      });

      if (records.length > 0) {
        const { data } = await supabase.from('candidates').insert(records).select();
        if (data) setCandidates(p => [...data, ...p]);
      }
      setImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const exportData = () => {
    const headers = fields.map(f => f.field_label);
    const rows = candidates.map(c => fields.map(f => c.custom_data?.[f.field_key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
    XLSX.writeFile(wb, `candidate-pipeline-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const updateStage = async (candidateId: string, newStage: string) => {
    const c = candidates.find(x => x.id === candidateId);
    const newData = { ...c.custom_data, [stageField.field_key]: newStage };
    const { data } = await supabase.from('candidates')
      .update({ custom_data: newData, stage: newStage }).eq('id', candidateId).select().single();
    if (data) setCandidates(p => p.map(x => x.id === candidateId ? data : x));
  };

  // Show first 6 fields in table for readability
  const tableFields = fields.slice(0, 7);

  const renderInput = (field: any) => {
    const val = form[field.field_key] ?? '';
    const base = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
    if (field.field_type === 'dropdown' && field.options?.length > 0) {
      return (
        <select value={val} onChange={e => setForm({ ...form, [field.field_key]: e.target.value })} className={`${base} bg-white`}>
          <option value="">Select…</option>
          {field.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (field.field_type === 'boolean') {
      return (
        <button type="button" onClick={() => setForm({ ...form, [field.field_key]: !val })}
          className={`px-4 py-2.5 rounded-xl border text-sm ${val ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200'}`}>
          {val ? '✓ Yes' : 'No'}
        </button>
      );
    }
    return (
      <input type={field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : 'text'}
        value={val} onChange={e => setForm({ ...form, [field.field_key]: e.target.value })} className={base} />
    );
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recruitment Pipeline</h1>
          <p className="text-sm text-slate-500 mt-0.5">{candidates.length} candidates · using your {fields.length} custom fields</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportData} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">
            <Download size={14} />Export Excel
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">
            {importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}Import
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
          <button onClick={() => { setForm({}); setAddOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
            <Plus size={14} />Add Candidate
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all fields…" className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
        </div>
        {stageField && stages.length > 0 && (
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All {stageField.field_label}</option>
            {stages.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${view === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}><Table2 size={13} />Table</button>
          {stageField && <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${view === 'kanban' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}><LayoutGrid size={13} />Kanban</button>}
        </div>
      </div>

      {/* Table view */}
      {view === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-100">
                {tableFields.map(f => <th key={f.id} className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">{f.field_label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    {tableFields.map(f => (
                      <td key={f.id} className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {f.is_id_field ? <span className="font-mono text-xs text-slate-400">{getVal(c, f.field_key)}</span>
                         : f.field_type === 'boolean' ? (getVal(c, f.field_key) ? '✓' : '—')
                         : String(getVal(c, f.field_key) || '—')}
                      </td>
                    ))}
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={tableFields.length} className="text-center py-10 text-sm text-slate-400">No candidates yet — add one or import your Excel</td></tr>}
              </tbody>
            </table>
          </div>
          {fields.length > 7 && <p className="text-xs text-slate-400 px-4 py-2 border-t border-slate-50">Showing 7 of {fields.length} fields in table. Full data in export & candidate detail.</p>}
        </div>
      )}

      {/* Kanban view */}
      {view === 'kanban' && stageField && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage: string) => {
            const cols = filtered.filter(c => getVal(c, stageField.field_key) === stage);
            return (
              <div key={stage} className="flex-shrink-0 w-56">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-slate-600">{stage}</span>
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{cols.length}</span>
                </div>
                <div className="space-y-2">
                  {cols.map(c => {
                    const nameField = fields.find(f => /name/i.test(f.field_label));
                    return (
                      <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                        <p className="text-xs font-semibold text-slate-800">{getVal(c, nameField?.field_key) || 'Unnamed'}</p>
                        {idField && <p className="text-xs text-slate-400 font-mono mt-0.5">{getVal(c, idField.field_key)}</p>}
                        <select value={stage} onChange={e => updateStage(c.id, e.target.value)} className="mt-2 w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
                          {stages.map((s: string) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">Add Candidate</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {fields.filter(f => !f.is_id_field).map(f => (
                <div key={f.id} className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{f.field_label}{f.required && <span className="text-red-500 ml-1">*</span>}</label>
                  {renderInput(f)}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={save} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Add Candidate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
