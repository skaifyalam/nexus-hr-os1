'use client';
import { useState, useRef } from 'react';
import { Upload, Sparkles, Loader, Plus, Trash2, X, Edit2, Check, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

const SECTIONS = [
  { key: 'employee', label: 'Employee Master' },
  { key: 'candidate', label: 'Recruitment Pipeline' },
  { key: 'requisition', label: 'Requisitions' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'id_field', label: 'Auto ID' },
];

export default function FieldsClient({ initialFields, customSections, companyId }: {
  initialFields: any[]; customSections: any[]; companyId: string;
}) {
  const [fields, setFields] = useState(initialFields);
  const [activeSection, setActiveSection] = useState('employee');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField] = useState({ field_label: '', field_type: 'text', required: false, options: '' });
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const allSections = [
    ...SECTIONS,
    ...customSections.map(cs => ({ key: cs.id, label: cs.name })),
  ];

  const sectionFields = fields
    .filter(f => f.section_key === activeSection)
    .sort((a, b) => a.display_order - b.display_order);

  const handleFile = async (file: File) => {
    setAnalyzing(true); setError(''); setSuccess('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];

        // Read header row directly (row 1) even if no data rows exist
        const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const headers = (allRows[0] || []).map((h: any) => String(h).trim()).filter(Boolean);

        if (headers.length === 0) {
          setError('No column headers found in the first row of the file. Make sure row 1 has your column names.');
          setAnalyzing(false);
          return;
        }

        // Build sample data rows (skip header, take next rows that have data)
        const dataRows = allRows.slice(1).filter(r => r.some(c => c !== '' && c !== null));
        const sampleRows = dataRows.slice(0, 10).map(r => {
          const obj: any = {};
          headers.forEach((h: string, i: number) => { obj[h] = r[i] ?? ''; });
          return obj;
        });

        const res = await fetch('/api/analyze-fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headers,
            sample_rows: sampleRows,
            section_key: activeSection,
            company_id: companyId,
          }),
        });
        const data = await res.json();
        if (data.error) { setError(data.error); setAnalyzing(false); return; }

        setFields(prev => [
          ...prev.filter(f => f.section_key !== activeSection),
          ...data.fields,
        ]);
        setSuccess(`AI detected ${data.count} fields from your file. Review and save below.`);
      } catch (err: any) {
        setError(err.message || 'Analysis failed');
      }
      setAnalyzing(false);
    };
    reader.readAsBinaryString(file);
  };

  const addField = async () => {
    if (!newField.field_label.trim()) return;
    const fieldKey = newField.field_label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const options = newField.field_type === 'dropdown'
      ? newField.options.split('\n').map(o => o.trim()).filter(Boolean)
      : [];

    const { data, error } = await supabase.from('section_field_configs').insert({
      company_id: companyId,
      section_key: activeSection,
      field_key: fieldKey,
      field_label: newField.field_label,
      field_type: newField.field_type,
      options,
      required: newField.required,
      display_order: sectionFields.length + 1,
    }).select().single();

    if (error) { setError(error.message); return; }
    if (data) setFields(prev => [...prev, data]);
    setNewField({ field_label: '', field_type: 'text', required: false, options: '' });
    setAddingField(false);
  };

  const deleteField = async (id: string) => {
    await supabase.from('section_field_configs').delete().eq('id', id);
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const startEdit = (f: any) => {
    setEditingId(f.id);
    setEditForm({ field_label: f.field_label, field_type: f.field_type, required: f.required, options: (f.options || []).join('\n'), id_format: f.id_format || '' });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setError('');
    const options = editForm.field_type === 'dropdown'
      ? editForm.options.split('\n').map((o: string) => o.trim()).filter(Boolean)
      : [];
    const { data, error } = await supabase.from('section_field_configs').update({
      field_label: editForm.field_label,
      field_type: editForm.field_type,
      is_id_field: editForm.field_type === 'id_field',
      required: editForm.required,
      options,
      id_format: editForm.field_type === 'id_field' ? (editForm.id_format || null) : null,
    }).eq('id', editingId).select().single();
    if (error) { setError(`Could not save: ${error.message}`); return; }
    if (data) setFields(prev => prev.map(f => f.id === editingId ? data : f));
    setEditingId(null);
    setSuccess('Field updated. Re-import your data so the change takes effect.');
    setTimeout(() => setSuccess(''), 4000);
  };

  const downloadTemplate = () => {
    if (sectionFields.length === 0) { setError('Add fields first, then download the template.'); return; }
    const headers = sectionFields.map(f => f.field_label);
    const ws = XLSX.utils.aoa_to_sheet([headers, headers.map(() => '')]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${activeSection}-template.xlsx`);
  };

  const activeLabel = allSections.find(s => s.key === activeSection)?.label || activeSection;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Field Configurator</h1>
          <p className="text-sm text-slate-500 mt-0.5">Upload a template or add fields manually — AI detects types and dropdown options automatically</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate}
            className="px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">
            Download Template
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">
            <Upload size={14} />Upload File
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <button onClick={() => setAddingField(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
            <Plus size={14} />Add Field
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4"><AlertCircle size={14}/>{error}<button onClick={() => setError('')} className="ml-auto"><X size={13}/></button></div>}
      {success && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-xl mb-4"><Check size={14}/>{success}</div>}
      {analyzing && <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100 mb-4"><div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div><span className="text-sm text-indigo-700">AI is analyzing your file and detecting field types, dropdowns, and ID patterns…</span></div>}

      <div className="grid grid-cols-4 gap-4">
        {/* Section picker */}
        <div className="col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Sections</p>
          <div className="space-y-1">
            {allSections.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors ${activeSection === s.key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {s.label}
                <span className={`ml-1.5 text-xs ${activeSection === s.key ? 'text-indigo-200' : 'text-slate-400'}`}>
                  ({fields.filter(f => f.section_key === s.key).length})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Fields list */}
        <div className="col-span-3 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{activeLabel} — Fields</h3>
              <p className="text-xs text-slate-400">{sectionFields.length} fields configured</p>
            </div>

            {sectionFields.length === 0 ? (
              <div className="p-12 text-center">
                <Upload size={28} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">No fields configured yet</p>
                <p className="text-xs text-slate-400 mt-1">Upload an Excel template or add fields manually</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {sectionFields.map(f => (
                  <div key={f.id} className="px-5 py-3">
                    {editingId === f.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1"><label className="text-xs text-slate-500">Label</label>
                            <input value={editForm.field_label} onChange={e => setEditForm({...editForm, field_label: e.target.value})} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                          <div className="space-y-1"><label className="text-xs text-slate-500">Type</label>
                            <select value={editForm.field_type} onChange={e => setEditForm({...editForm, field_type: e.target.value})} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select></div>
                          {editForm.field_type === 'id_field' && (
                            <div className="space-y-1"><label className="text-xs text-slate-500">ID Format</label>
                              <input value={editForm.id_format} onChange={e => setEditForm({...editForm, id_format: e.target.value})} placeholder="{COUNTRY}-{YEAR}-{SEQ4}" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                          )}
                        </div>
                        {editForm.field_type === 'dropdown' && (
                          <div className="space-y-1"><label className="text-xs text-slate-500">Options (one per line)</label>
                            <textarea value={editForm.options} onChange={e => setEditForm({...editForm, options: e.target.value})} rows={3} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"/></div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">Save</button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-slate-800">{f.field_label}</span>
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{f.field_type}</span>
                          {f.is_id_field && <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full">Auto ID</span>}
                          {f.required && <span className="text-xs text-red-500">required</span>}
                          {f.id_format && <span className="text-xs font-mono text-slate-400">{f.id_format}</span>}
                          {f.options?.length > 0 && <span className="text-xs text-slate-400">{f.options.length} options</span>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(f)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={13}/></button>
                          {!f.is_system && <button onClick={() => deleteField(f.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13}/></button>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add field form */}
          {addingField && (
            <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Add Field Manually</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Field Label</label>
                  <input value={newField.field_label} onChange={e => setNewField({...newField, field_label: e.target.value})} placeholder="e.g. Visa Number" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Field Type</label>
                  <select value={newField.field_type} onChange={e => setNewField({...newField, field_type: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select></div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newField.required} onChange={e => setNewField({...newField, required: e.target.checked})} className="rounded"/><span className="text-sm text-slate-700">Required</span></label>
                </div>
              </div>
              {newField.field_type === 'dropdown' && (
                <div className="space-y-1.5 mb-4"><label className="text-sm font-medium text-slate-700">Options (one per line)</label>
                  <textarea value={newField.options} onChange={e => setNewField({...newField, options: e.target.value})} rows={3} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"/></div>
              )}
              <div className="flex gap-2">
                <button onClick={addField} disabled={!newField.field_label} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">Add Field</button>
                <button onClick={() => setAddingField(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
