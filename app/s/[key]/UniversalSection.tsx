'use client';
import { useState, useRef, useMemo } from 'react';
import {
  Plus, X, Search, Upload, Loader, Download, LayoutGrid, Table2,
  Settings, Sparkles, Check, Trash2, Edit2, FileSpreadsheet, GitBranch, Clock,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

export default function UniversalSection({ section, initialFields, initialRecords, initialStageFlows = [], companyId, userEmail = '' }: {
  section: any; initialFields: any[]; initialRecords: any[]; initialStageFlows?: any[]; companyId: string; userEmail?: string;
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
  const [manualBuild, setManualBuild] = useState(false);
  const [mfLabel, setMfLabel] = useState('');
  const [mfType, setMfType] = useState('text');
  const [fieldsPanel, setFieldsPanel] = useState(false);
  const [stageFlows, setStageFlows] = useState<any[]>(initialStageFlows);
  const [flowPanel, setFlowPanel] = useState(false);
  const [statusChange, setStatusChange] = useState<{ record: any; newStatus: string } | null>(null);
  const [scDate, setScDate] = useState('');
  const [scRemarks, setScRemarks] = useState('');
  const [historyFor, setHistoryFor] = useState<any>(null);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [editFieldId, setEditFieldId] = useState<string | null>(null);
  const [efLabel, setEfLabel] = useState('');
  const [efType, setEfType] = useState('text');
  const [efOptions, setEfOptions] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const configured = fields.length > 0;
  const [forceSetup, setForceSetup] = useState(false);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

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

        if (headers.length === 0) { setError('No column headers found in row 1 of your file.'); setAnalyzing(false); return; }

        const dataRows = allRows.slice(1).filter(r => r.some(c => c !== '' && c != null));
        const sampleRows = dataRows.slice(0, 10).map(r => {
          const o: any = {}; headers.forEach((h: string, i: number) => o[h] = r[i] ?? ''); return o;
        });

        const res = await fetch('/api/analyze-fields', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headers, sample_rows: sampleRows, section_key: section.section_key, company_id: companyId }),
        });

        if (!res.ok) {
          const errText = await res.text();
          setError(`Server error (${res.status}): ${errText.slice(0, 200)}`);
          setAnalyzing(false);
          return;
        }

        const data = await res.json();
        if (data.error) { setError(`AI error: ${data.error}`); setAnalyzing(false); return; }
        if (!data.fields || data.fields.length === 0) {
          setError('AI did not detect any fields. Your file headers may be unclear — try "start with blank" and add fields manually.');
          setAnalyzing(false);
          return;
        }

        setFields(data.fields);
        setForceSetup(false);
        await supabase.from('company_sections').update({ is_configured: true }).eq('id', section.id);
      } catch (err: any) {
        setError(`Upload failed: ${err.message}`);
      }
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

  const addManualField = async () => {
    if (!mfLabel.trim()) return;
    const fieldKey = mfLabel.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-3);
    const { data } = await supabase.from('section_field_configs').insert({
      company_id: companyId,
      section_key: section.section_key,
      field_key: fieldKey,
      field_label: mfLabel.trim(),
      field_type: mfType,
      is_id_field: mfType === 'id_field',
      display_order: fields.length + 1,
    }).select().single();
    if (data) setFields(p => [...p, data]);
    await supabase.from('company_sections').update({ is_configured: true }).eq('id', section.id);
    setMfLabel(''); setMfType('text');
  };

  const deleteField = async (id: string) => {
    await supabase.from('section_field_configs').delete().eq('id', id);
    setFields(p => p.filter(f => f.id !== id));
  };

  // ─── Stage tracking ─────────────────────────────────────────
  const remarksField = useMemo(() => fields.find(f => /remark|comment|note/i.test(f.field_label)), [fields]);
  const dateFields = useMemo(() => fields.filter(f => f.field_type === 'date'), [fields]);

  // Returns the date for a record's CURRENT stage (from the mapped date field),
  // falling back to the LATEST date across all date fields (most recent milestone)
  const stageDateFor = (r: any) => {
    const status = r.data?.[stageField?.field_key];
    if (status) {
      const flow = stageFlows.find(f => f.status_value === status);
      if (flow?.date_field_key) {
        const v = r.data?.[flow.date_field_key];
        if (v) return v;
      }
    }
    // Fallback: latest date among all date-type fields
    let latest: any = null;
    let latestTime = 0;
    dateFields.forEach(df => {
      const v = r.data?.[df.field_key];
      if (!v) return;
      const t = new Date(v).getTime();
      if (!isNaN(t) && t > latestTime) { latestTime = t; latest = v; }
    });
    return latest;
  };

  const fmtDate = (v: any) => {
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Called when a status value changes anywhere (inline or kanban)
  const requestStatusChange = (record: any, newStatus: string) => {
    if (!stageField) return;
    const current = record.data?.[stageField.field_key];
    if (current === newStatus) return;
    setScDate(new Date().toISOString().split('T')[0]);
    setScRemarks('');
    setStatusChange({ record, newStatus });
  };

  const confirmStatusChange = async () => {
    if (!statusChange || !stageField) return;
    const { record, newStatus } = statusChange;
    const fromStatus = record.data?.[stageField.field_key] || null;

    const newData = { ...record.data, [stageField.field_key]: newStatus };

    // Auto-fill mapped date field if this status has one
    const flow = stageFlows.find(f => f.status_value === newStatus);
    if (flow?.date_field_key && scDate) {
      newData[flow.date_field_key] = scDate;
    }
    // Append remarks to the remarks field if present
    if (scRemarks && remarksField) {
      newData[remarksField.field_key] = scRemarks;
    }

    const { data: updated } = await supabase.from('section_records')
      .update({ data: newData, updated_at: new Date().toISOString() })
      .eq('id', record.id).select().single();
    if (updated) setRecords(p => p.map(r => r.id === record.id ? updated : r));

    // Log to history
    await supabase.from('stage_history').insert({
      company_id: companyId,
      section_key: section.section_key,
      record_pk: record.id,
      record_id: record.record_id || record.data?.[idField?.field_key] || '',
      from_status: fromStatus,
      to_status: newStatus,
      change_date: scDate || new Date().toISOString().split('T')[0],
      remarks: scRemarks || null,
      changed_by: userEmail,
    });

    setStatusChange(null);
  };

  const openHistory = async (record: any) => {
    setHistoryFor(record);
    const { data } = await supabase.from('stage_history')
      .select('*').eq('record_pk', record.id).order('created_at', { ascending: false });
    setHistoryRows(data || []);
  };

  // Save a status→date mapping
  const saveFlow = async (statusValue: string, dateFieldKey: string | null) => {
    const existing = stageFlows.find(f => f.status_value === statusValue);
    if (existing) {
      const { data } = await supabase.from('stage_flows')
        .update({ date_field_key: dateFieldKey }).eq('id', existing.id).select().single();
      if (data) setStageFlows(p => p.map(f => f.id === existing.id ? data : f));
    } else {
      const { data } = await supabase.from('stage_flows').insert({
        company_id: companyId, section_key: section.section_key,
        status_value: statusValue, date_field_key: dateFieldKey,
      }).select().single();
      if (data) setStageFlows(p => [...p, data]);
    }
  };

  const startEditField = (f: any) => {
    setEditFieldId(f.id); setEfLabel(f.field_label); setEfType(f.field_type);
    setEfOptions((f.options || []).join('\n'));
  };

  const saveFieldEdit = async () => {
    if (!editFieldId) return;
    const opts = efType === 'dropdown' ? efOptions.split('\n').map(o => o.trim()).filter(Boolean) : [];
    const { data } = await supabase.from('section_field_configs').update({
      field_label: efLabel,
      field_type: efType,
      is_id_field: efType === 'id_field',
      options: opts,
      id_format: efType === 'id_field' ? '{SEQ4}' : null,
    }).eq('id', editFieldId).select().single();
    if (data) setFields(p => p.map(f => f.id === editFieldId ? data : f));
    setEditFieldId(null);
  };

  // ─── Bulk import data ───────────────────────────────────────
  const importData = (file: File) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'binary' });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const valid = rows.filter(r => Object.values(r).some(v => v !== ''));

      // Normalize for fuzzy matching: lowercase, strip punctuation & extra spaces
      const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

      const newRecords = [];
      for (const row of valid) {
        const data: any = {};
        const rowKeys = Object.keys(row);
        fields.forEach(f => {
          // Try exact match first, then fuzzy match on normalized strings
          let mk = rowKeys.find(k => k.trim().toLowerCase() === f.field_label.trim().toLowerCase());
          if (!mk) mk = rowKeys.find(k => norm(k) === norm(f.field_label));
          if (!mk) mk = rowKeys.find(k => norm(k).includes(norm(f.field_label)) || norm(f.field_label).includes(norm(k)));
          if (mk && row[mk] !== '') data[f.field_key] = row[mk];
        });
        let recordId = idField ? data[idField.field_key] : null;
        if (idField && !recordId) {
          const { data: idVal } = await supabase.rpc('generate_section_id', { p_section_pk: section.id });
          recordId = idVal; data[idField.field_key] = idVal;
        }
        newRecords.push({ company_id: companyId, section_key: section.section_key, record_id: recordId, data });
      }
      if (newRecords.length > 0) {
        // UPSERT: update existing records (matched by record_id), insert new ones
        const existingById = new Map(records.filter(r => r.record_id).map(r => [String(r.record_id).trim(), r]));
        const toInsert: any[] = [];
        const updatedList: any[] = [];

        for (const nr of newRecords) {
          const match = nr.record_id ? existingById.get(String(nr.record_id).trim()) : null;
          if (match) {
            // Merge: imported values overwrite, existing values kept where import is empty
            const merged = { ...match.data, ...nr.data };
            const { data: upd } = await supabase.from('section_records')
              .update({ data: merged, updated_at: new Date().toISOString() })
              .eq('id', match.id).select().single();
            if (upd) updatedList.push(upd);
          } else {
            toInsert.push(nr);
          }
        }

        let inserted: any[] = [];
        if (toInsert.length > 0) {
          const { data } = await supabase.from('section_records').insert(toInsert).select();
          inserted = data || [];
        }

        setRecords(p => {
          const updMap = new Map(updatedList.map(u => [u.id, u]));
          const merged = p.map(r => updMap.get(r.id) || r);
          return [...inserted, ...merged];
        });
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

  // First 7 fields, but ALWAYS include the stage/status field (even if it's column 11 of 24)
  const tableFields = (() => {
    const base = fields.slice(0, 7);
    if (stageField && !base.find(f => f.id === stageField.id)) {
      return [...fields.slice(0, 6), stageField];
    }
    return base;
  })();

  // ═══ EMPTY STATE — section not configured yet ═══════════════
  if (!configured || forceSetup) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{section.label}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Set up this section by uploading your Excel — AI builds it to match your structure</p>
          {forceSetup && configured && (
            <button onClick={() => setForceSetup(false)} className="text-xs text-indigo-600 hover:underline mt-2">← Back to existing data ({fields.length} fields)</button>
          )}
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
              <p className="text-xs text-slate-400 mt-4">Or <button onClick={() => setManualBuild(true)} className="text-indigo-600 hover:underline">build fields manually</button> without a file</p>
            </>
          )}
        </div>

        {/* Manual field builder */}
        {manualBuild && (
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5 mt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Your First Field</h3>
            <p className="text-xs text-slate-500 mb-4">Name your own fields — nothing is preset. Add as many as you need.</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Field Name</label>
                <input value={mfLabel} onChange={e => setMfLabel(e.target.value)} placeholder="e.g. Passport No" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Type</label>
                <select value={mfType} onChange={e => setMfType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {['text','number','date','email','phone','dropdown','boolean','id_field'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={addManualField} disabled={!mfLabel.trim()} className="w-full px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Add Field</button>
              </div>
            </div>
            {fields.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                {fields.map(f => (
                  <span key={f.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs text-slate-700">
                    {f.field_label} <span className="text-slate-400">({f.field_type})</span>
                    <button onClick={() => deleteField(f.id)} className="text-slate-400 hover:text-red-500"><X size={11} /></button>
                  </span>
                ))}
                <button onClick={() => setManualBuild(false)} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium ml-2">Done ({fields.length} fields)</button>
              </div>
            )}
          </div>
        )}
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
          <button onClick={() => setFieldsPanel(true)} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Settings size={14} />Fields</button>
          {stageField && <button onClick={() => setFlowPanel(true)} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><GitBranch size={14} />Stage Flow</button>}
          <button onClick={exportData} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Download size={14} />Export</button>
          <button onClick={() => importRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">{importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}Import</button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && importData(e.target.files[0])} />
          <button onClick={() => { setForm({}); setEditingId(null); setAddOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />Add Record</button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search all fields…" className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
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
                {paged.map(r => (
                  <tr key={r.id} className={`hover:bg-slate-50/50 group ${selected.has(r.id) ? 'bg-indigo-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded cursor-pointer" />
                    </td>
                    {tableFields.map(f => (
                      <td key={f.id} className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {f.id === stageField?.id && stages.length > 0 ? (
                          <div>
                            <select
                              value={r.data?.[f.field_key] || ''}
                              onChange={e => requestStatusChange(r, e.target.value)}
                              className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[180px]"
                            >
                              <option value="">—</option>
                              {stages.map((s: string) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {stageDateFor(r) && <p className="text-xs text-slate-400 mt-1">📅 {fmtDate(stageDateFor(r))}</p>}
                          </div>
                        ) : f.is_id_field ? <span className="font-mono text-xs text-slate-400">{r.data?.[f.field_key]}</span>
                         : f.field_type === 'boolean' ? (r.data?.[f.field_key] ? '✓' : '—')
                         : String(r.data?.[f.field_key] || '—')}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {stageField && <button onClick={() => openHistory(r)} title="Stage history" className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Clock size={13} /></button>}
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
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-50">
            <p className="text-xs text-slate-400">
              Showing {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} records
              {fields.length > 7 && <span> · 7 of {fields.length} fields (all in export & edit)</span>}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50">← Prev</button>
                <span className="text-xs text-slate-400 px-1">Page {safePage + 1} / {totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1} className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50">Next →</button>
              </div>
            )}
          </div>
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
                      {stageDateFor(r) && <p className="text-xs text-indigo-500 mt-1">📅 {fmtDate(stageDateFor(r))}</p>}
                      <select value={stage} onChange={e => requestStatusChange(r, e.target.value)} className="mt-2 w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
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

      {/* Status change popup — date + remarks */}
      {statusChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setStatusChange(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Stage Change</h2>
            <p className="text-xs text-slate-500 mb-4">
              <span className="text-slate-400">{statusChange.record.data?.[stageField?.field_key] || 'None'}</span>
              <span className="mx-1.5">→</span>
              <span className="font-medium text-indigo-600">{statusChange.newStatus}</span>
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Date</label>
                <input type="date" value={scDate} onChange={e => setScDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                {(() => {
                  const flow = stageFlows.find(f => f.status_value === statusChange.newStatus);
                  const df = flow?.date_field_key ? fields.find(f => f.field_key === flow.date_field_key) : null;
                  return df ? <p className="text-xs text-emerald-600">Will fill: {df.field_label}</p>
                    : <p className="text-xs text-slate-400">No date field mapped to this stage (set in Stage Flow)</p>;
                })()}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Remarks <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea value={scRemarks} onChange={e => setScRemarks(e.target.value)} rows={2} placeholder="e.g. Passed medical, awaiting biometric slot" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setStatusChange(null)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={confirmStatusChange} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Update Stage</button>
            </div>
          </div>
        </div>
      )}

      {/* Stage history modal */}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setHistoryFor(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Stage History</h2>
                <p className="text-xs text-slate-400">{historyFor.data?.[nameField?.field_key] || historyFor.record_id}</p>
              </div>
              <button onClick={() => setHistoryFor(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6">
              {historyRows.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No stage changes recorded yet</p>
              ) : (
                <div className="space-y-0">
                  {historyRows.map((h, i) => (
                    <div key={h.id} className="flex gap-3 pb-4 relative">
                      {i < historyRows.length - 1 && <div className="absolute left-[5px] top-4 bottom-0 w-0.5 bg-slate-100" />}
                      <div className="w-3 h-3 rounded-full bg-indigo-500 mt-1 flex-shrink-0 ring-4 ring-indigo-50" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {h.from_status && <><span className="text-xs text-slate-400">{h.from_status}</span><span className="text-slate-300">→</span></>}
                          <span className="text-sm font-medium text-slate-800">{h.to_status}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{new Date(h.change_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{h.changed_by ? ` · ${h.changed_by}` : ''}</p>
                        {h.remarks && <p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded-lg px-2.5 py-1.5">{h.remarks}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stage Flow settings panel */}
      {flowPanel && stageField && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setFlowPanel(false)} />
          <div className="relative bg-white w-[420px] h-full shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Stage Flow</h2>
                <p className="text-xs text-slate-400">Map each stage to the date field it should fill</p>
              </div>
              <button onClick={() => setFlowPanel(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2">
              {stages.length === 0 && <p className="text-xs text-slate-400">No stages found. Add options to your {stageField.field_label} field first.</p>}
              {stages.map((sv: string) => {
                const flow = stageFlows.find(f => f.status_value === sv);
                return (
                  <div key={sv} className="border border-slate-200 rounded-xl p-3">
                    <p className="text-sm font-medium text-slate-800 mb-2">{sv}</p>
                    <select
                      value={flow?.date_field_key || ''}
                      onChange={e => saveFlow(sv, e.target.value || null)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">No date needed for this stage</option>
                      {dateFields.map(df => <option key={df.field_key} value={df.field_key}>Fills → {df.field_label}</option>)}
                    </select>
                  </div>
                );
              })}
              {dateFields.length === 0 && stages.length > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3">No date-type fields in this section. Set your date columns to type "date" in Fields, then map them here.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage Fields panel */}
      {fieldsPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => { setFieldsPanel(false); setEditFieldId(null); }} />
          <div className="relative bg-white w-96 h-full shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div><h2 className="text-sm font-semibold text-slate-900">Manage Fields</h2><p className="text-xs text-slate-400">{fields.length} fields · {section.label}</p></div>
              <button onClick={() => { setFieldsPanel(false); setEditFieldId(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2">
              <button onClick={() => { setFieldsPanel(false); setForceSetup(true); }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 mb-2">
                <Upload size={13} />Re-upload Excel to rebuild fields
              </button>
              {fields.map(f => (
                <div key={f.id} className="border border-slate-200 rounded-xl p-3">
                  {editFieldId === f.id ? (
                    <div className="space-y-2">
                      <input value={efLabel} onChange={e => setEfLabel(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <select value={efType} onChange={e => setEfType(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {['text','number','date','email','phone','dropdown','boolean','id_field'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {efType === 'dropdown' && <textarea value={efOptions} onChange={e => setEfOptions(e.target.value)} rows={3} placeholder="One option per line" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />}
                      <div className="flex gap-2">
                        <button onClick={saveFieldEdit} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg">Save</button>
                        <button onClick={() => setEditFieldId(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{f.field_label}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{f.field_type}</span>
                          {f.is_id_field && <span className="text-xs px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded">Auto ID</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => startEditField(f)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={13} /></button>
                        <button onClick={() => deleteField(f.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add new field inline */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 mt-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Add a field</p>
                <div className="space-y-2">
                  <input value={mfLabel} onChange={e => setMfLabel(e.target.value)} placeholder="Field name" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <div className="flex gap-2">
                    <select value={mfType} onChange={e => setMfType(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {['text','number','date','email','phone','dropdown','boolean','id_field'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button onClick={addManualField} disabled={!mfLabel.trim()} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-40">Add</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
