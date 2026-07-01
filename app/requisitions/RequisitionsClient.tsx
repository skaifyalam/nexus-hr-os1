'use client';
import { useState } from 'react';
import {
  Plus, X, Search, Settings, Trash2, ChevronDown, ChevronRight,
  Layers, FileText, Edit2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const TYPES = ['text','number','date','email','phone','dropdown','boolean'];

export default function RequisitionsClient({ headerFields, lineFields, initialHeaders, companyId }: {
  headerFields: any[]; lineFields: any[]; initialHeaders: any[]; companyId: string;
}) {
  const [hFields, setHFields] = useState(headerFields);
  const [lFields, setLFields] = useState(lineFields);
  const [headers, setHeaders] = useState(initialHeaders);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [addOpen, setAddOpen] = useState(false);
  const [fieldsPanel, setFieldsPanel] = useState<'header' | 'line' | null>(null);
  const [headerForm, setHeaderForm] = useState<Record<string, any>>({});
  const [lineRows, setLineRows] = useState<Record<string, any>[]>([{}]);
  const supabase = createClient();

  const configured = hFields.length > 0 || lFields.length > 0;
  const toggleExpand = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filtered = headers.filter(h => !search || JSON.stringify(h).toLowerCase().includes(search.toLowerCase()));

  const saveReq = async () => {
    const { data: reqId } = await supabase.rpc('generate_req_id', { p_company_id: companyId });
    const { data: header } = await supabase.from('req_headers').insert({
      company_id: companyId, req_id: reqId, data: headerForm, status: 'open',
    }).select().single();
    if (!header) return;
    const rowsToSave = mode === 'single' ? [lineRows[0] || {}] : lineRows;
    const validRows = rowsToSave.filter(r => Object.values(r).some(v => v !== '' && v != null));
    let savedLines: any[] = [];
    if (validRows.length > 0) {
      const lineData = validRows.map(r => ({ header_id: header.id, company_id: companyId, data: r }));
      const { data: lines } = await supabase.from('req_lines').insert(lineData).select();
      savedLines = lines || [];
    }
    setHeaders(p => [{ ...header, req_lines: savedLines }, ...p]);
    setHeaderForm({}); setLineRows([{}]); setAddOpen(false);
  };

  const deleteReq = async (id: string) => {
    await supabase.from('req_headers').delete().eq('id', id);
    setHeaders(p => p.filter(h => h.id !== id));
  };

  const addLineRow = () => setLineRows(p => [...p, {}]);
  const removeLineRow = (i: number) => setLineRows(p => p.filter((_, j) => j !== i));
  const updateLineRow = (i: number, key: string, val: any) =>
    setLineRows(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r));

  const addField = async (scope: 'header' | 'line', label: string, type: string, options: string[] = []) => {
    if (!label.trim()) return;
    const sectionKey = scope === 'header' ? 'requisition' : 'requisition_line';
    const fieldKey = label.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-3);
    const list = scope === 'header' ? hFields : lFields;
    const { data } = await supabase.from('section_field_configs').insert({
      company_id: companyId, section_key: sectionKey,
      field_key: fieldKey, field_label: label.trim(), field_type: type,
      options: type === 'dropdown' ? options : [],
      display_order: list.length + 1,
    }).select().single();
    if (data) {
      if (scope === 'header') setHFields(p => [...p, data]);
      else setLFields(p => [...p, data]);
    }
  };

  const editField = async (scope: 'header' | 'line', id: string, label: string, type: string, options: string[] = []) => {
    const { data } = await supabase.from('section_field_configs').update({
      field_label: label.trim(),
      field_type: type,
      options: type === 'dropdown' ? options : [],
      is_id_field: type === 'id_field',
    }).eq('id', id).select().single();
    if (data) {
      if (scope === 'header') setHFields(p => p.map(f => f.id === id ? data : f));
      else setLFields(p => p.map(f => f.id === id ? data : f));
    }
  };

  const deleteField = async (scope: 'header' | 'line', id: string) => {
    await supabase.from('section_field_configs').delete().eq('id', id);
    if (scope === 'header') setHFields(p => p.filter(f => f.id !== id));
    else setLFields(p => p.filter(f => f.id !== id));
  };

  const renderGridInput = (f: any, value: any, onChange: (v: any) => void) => {
    const base = "w-full border-0 bg-transparent px-1.5 py-1 text-sm focus:outline-none focus:bg-indigo-50 rounded";
    if (f.field_type === 'dropdown' && f.options?.length > 0)
      return <select value={value || ''} onChange={e => onChange(e.target.value)} className={`${base} bg-white`}><option value="">—</option>{f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>;
    if (f.field_type === 'boolean')
      return <button type="button" onClick={() => onChange(!value)} className={`px-2 py-1 rounded text-xs ${value ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{value ? 'Yes' : 'No'}</button>;
    return <input type={f.field_type === 'date' ? 'date' : f.field_type === 'number' ? 'number' : 'text'} value={value || ''} onChange={e => onChange(e.target.value)} className={base} />;
  };

  const renderInput = (f: any, value: any, onChange: (v: any) => void) => {
    const base = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
    if (f.field_type === 'dropdown' && f.options?.length > 0)
      return <select value={value || ''} onChange={e => onChange(e.target.value)} className={`${base} bg-white`}><option value="">Select…</option>{f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>;
    if (f.field_type === 'boolean')
      return <button type="button" onClick={() => onChange(!value)} className={`px-3 py-2 rounded-xl border text-sm ${value ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200'}`}>{value ? '✓ Yes' : 'No'}</button>;
    return <input type={f.field_type === 'date' ? 'date' : f.field_type === 'number' ? 'number' : 'text'} value={value || ''} onChange={e => onChange(e.target.value)} className={base} />;
  };

  if (!configured) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Requisitions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Set up what a requisition looks like — add fields for the requisition and for each position line</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SetupCard title="Requisition Fields" subtitle="Header-level: project, department, date needed, requested by…" scope="header" onAdd={addField} fields={hFields} onDelete={deleteField} onEdit={editField} />
          <SetupCard title="Position Line Fields" subtitle="Per-position: job title, headcount, salary, category…" scope="line" onAdd={addField} fields={lFields} onDelete={deleteField} onEdit={editField} />
        </div>
        {(hFields.length > 0 || lFields.length > 0) && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">Fields added. Refresh the page to start creating requisitions.</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Requisitions</h1>
          <p className="text-sm text-slate-500 mt-0.5">{headers.length} requisitions · {headers.reduce((s, h) => s + (h.req_lines?.length || 0), 0)} total positions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFieldsPanel('header')} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Settings size={14} />Fields</button>
          <button onClick={() => { setHeaderForm({}); setLineRows([{}]); setMode('single'); setAddOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><FileText size={14} />Single</button>
          <button onClick={() => { setHeaderForm({}); setLineRows([{}, {}, {}]); setMode('bulk'); setAddOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Layers size={14} />Bulk Add</button>
        </div>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requisitions…" className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
            <Layers size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No requisitions yet</p>
            <p className="text-xs text-slate-400 mt-1">Click Single or Bulk Add to create one</p>
          </div>
        )}
        {filtered.map(h => {
          const isOpen = expanded.has(h.id);
          const lines = h.req_lines || [];
          const hcField = lFields.find(f => /headcount|vacanc|quantity|qty|number/i.test(f.field_label));
          const totalHeadcount = lines.reduce((s: number, l: any) => s + (hcField ? Number(l.data?.[hcField.field_key] || 0) : 1), 0);
          return (
            <div key={h.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 cursor-pointer" onClick={() => toggleExpand(h.id)}>
                <div className="flex items-center gap-3">
                  <button className="text-slate-400">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold text-indigo-600">{h.req_id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${h.status === 'open' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{h.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{hFields.slice(0, 3).map(f => h.data?.[f.field_key]).filter(Boolean).join(' · ') || 'No details'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">{lines.length} position{lines.length !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-slate-400">{totalHeadcount} headcount</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteReq(h.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                  {hFields.length > 0 && (
                    <div className="grid grid-cols-4 gap-3 mb-4 pb-4 border-b border-slate-200">
                      {hFields.map(f => (
                        <div key={f.id}>
                          <p className="text-xs text-slate-400">{f.field_label}</p>
                          <p className="text-sm text-slate-700">{String(h.data?.[f.field_key] || '—')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {lines.length > 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
                      <table className="w-full">
                        <thead><tr className="border-b border-slate-100">
                          {lFields.map(f => <th key={f.id} className="text-left text-xs font-medium text-slate-500 px-3 py-2 whitespace-nowrap">{f.field_label}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {lines.map((l: any) => (
                            <tr key={l.id}>
                              {lFields.map(f => <td key={f.id} className="px-3 py-2 text-sm text-slate-600 whitespace-nowrap">{String(l.data?.[f.field_key] || '—')}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-xs text-slate-400 text-center py-3">No positions on this requisition</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-slate-900">{mode === 'bulk' ? 'Bulk Requisition' : 'New Requisition'}</h2>
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  <button onClick={() => { setMode('single'); setLineRows([lineRows[0] || {}]); }} className={`px-3 py-1 rounded-md text-xs font-medium ${mode === 'single' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Single</button>
                  <button onClick={() => { setMode('bulk'); if (lineRows.length < 2) setLineRows([...lineRows, {}, {}]); }} className={`px-3 py-1 rounded-md text-xs font-medium ${mode === 'bulk' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Bulk</button>
                </div>
              </div>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6">
              {hFields.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Requisition Details</p>
                  <div className="grid grid-cols-3 gap-3">
                    {hFields.map(f => (
                      <div key={f.id} className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">{f.field_label}</label>
                        {renderInput(f, headerForm[f.field_key], v => setHeaderForm({ ...headerForm, [f.field_key]: v }))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{mode === 'bulk' ? 'Positions' : 'Position'}</p>
                  {mode === 'bulk' && <button onClick={addLineRow} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"><Plus size={12} />Add Row</button>}
                </div>
                {lFields.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">No position fields defined yet. Add them via the Fields button first.</p>
                ) : mode === 'single' ? (
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(lFields.length, 3)}, 1fr)` }}>
                    {lFields.map(f => (
                      <div key={f.id} className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">{f.field_label}</label>
                        {renderInput(f, lineRows[0]?.[f.field_key], v => updateLineRow(0, f.field_key, v))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    {/* Column headers — shown once */}
                    <div className="flex bg-slate-50 border-b border-slate-200 sticky top-0">
                      <div className="w-10 flex-shrink-0 px-2 py-2 text-xs font-semibold text-slate-400 text-center">#</div>
                      {lFields.map(f => (
                        <div key={f.id} className="flex-1 min-w-[140px] px-2 py-2 text-xs font-semibold text-slate-500 border-l border-slate-200">{f.field_label}</div>
                      ))}
                      <div className="w-10 flex-shrink-0" />
                    </div>
                    {/* Data rows — clean, no repeated labels */}
                    {lineRows.map((row, i) => (
                      <div key={i} className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50/40">
                        <div className="w-10 flex-shrink-0 px-2 py-1.5 text-xs text-slate-400 text-center flex items-center justify-center">{i + 1}</div>
                        {lFields.map(f => (
                          <div key={f.id} className="flex-1 min-w-[140px] px-1.5 py-1.5 border-l border-slate-100">
                            {renderGridInput(f, row[f.field_key], v => updateLineRow(i, f.field_key, v))}
                          </div>
                        ))}
                        <div className="w-10 flex-shrink-0 flex items-center justify-center">
                          {lineRows.length > 1 && <button onClick={() => removeLineRow(i)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500"><X size={13} /></button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <p className="text-xs text-slate-400">{mode === 'bulk' ? `${lineRows.length} position rows` : 'Single position'}</p>
              <div className="flex gap-3">
                <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
                <button onClick={saveReq} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Create Requisition</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {fieldsPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setFieldsPanel(null)} />
          <div className="relative bg-white w-96 h-full shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-sm font-semibold text-slate-900">Manage Fields</h2>
              <button onClick={() => setFieldsPanel(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="flex bg-slate-100 m-4 rounded-xl p-1">
              <button onClick={() => setFieldsPanel('header')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${fieldsPanel === 'header' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Requisition</button>
              <button onClick={() => setFieldsPanel('line')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${fieldsPanel === 'line' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Positions</button>
            </div>
            <div className="px-4 pb-4">
              <FieldManager scope={fieldsPanel} fields={fieldsPanel === "header" ? hFields : lFields} onAdd={addField} onDelete={deleteField} onEdit={editField} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ scope, field, onEdit, onDelete }: any) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(field.field_label);
  const [type, setType] = useState(field.field_type);
  const [options, setOptions] = useState((field.options || []).join('\n'));

  const save = () => {
    const opts = type === 'dropdown' ? options.split('\n').map((o: string) => o.trim()).filter(Boolean) : [];
    onEdit(scope, field.id, label, type, opts);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="border border-indigo-200 rounded-xl p-3 space-y-2 bg-indigo-50/30">
        <input value={label} onChange={e => setLabel(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {type === 'dropdown' && (
          <textarea value={options} onChange={e => setOptions(e.target.value)} rows={3} placeholder="One option per line" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        )}
        <div className="flex gap-2">
          <button onClick={save} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg">Save</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2">
      <div>
        <span className="text-sm text-slate-700">{field.field_label}</span>
        <span className="text-xs text-slate-400 ml-1.5">({field.field_type})</span>
        {field.field_type === 'dropdown' && field.options?.length > 0 && (
          <span className="text-xs text-indigo-500 ml-1.5">{field.options.length} options</span>
        )}
      </div>
      <div className="flex gap-1">
        <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={13} /></button>
        <button onClick={() => onDelete(scope, field.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function FieldAdder({ scope, count, onAdd }: any) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');
  const [options, setOptions] = useState('');
  const add = () => {
    const opts = type === 'dropdown' ? options.split('\n').map(o => o.trim()).filter(Boolean) : [];
    onAdd(scope, label, type, opts);
    setLabel(''); setType('text'); setOptions('');
  };
  return (
    <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 mt-3">
      <p className="text-xs font-medium text-slate-500 mb-2">Add a field</p>
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Field name" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      {type === 'dropdown' && (
        <textarea value={options} onChange={e => setOptions(e.target.value)} rows={3} placeholder="One option per line" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      )}
      <button onClick={add} disabled={!label.trim()} className="w-full px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-40">Add Field</button>
    </div>
  );
}

function SetupCard({ title, subtitle, scope, onAdd, fields, onDelete, onEdit }: any) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-400 mt-0.5 mb-4">{subtitle}</p>
      <div className="space-y-2 mb-3">
        {fields.map((f: any) => (
          <FieldRow key={f.id} scope={scope} field={f} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
      <FieldAdder scope={scope} count={fields.length} onAdd={onAdd} />
    </div>
  );
}

function FieldManager({ scope, fields, onAdd, onDelete, onEdit }: any) {
  return (
    <div className="space-y-2">
      {fields.map((f: any) => (
        <FieldRow key={f.id} scope={scope} field={f} onEdit={onEdit} onDelete={onDelete} />
      ))}
      <FieldAdder scope={scope} count={fields.length} onAdd={onAdd} />
    </div>
  );
}
