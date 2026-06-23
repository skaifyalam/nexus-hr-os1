'use client';
import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Settings, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'dropdown', label: 'Dropdown' },
];

export default function CustomSectionClient({ section, initialFields, initialRecords }: {
  section: any; initialFields: any[]; initialRecords: any[];
}) {
  const [fields, setFields] = useState(initialFields);
  const [records, setRecords] = useState(initialRecords);
  const [recordModal, setRecordModal] = useState(false);
  const [fieldModal, setFieldModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [delConfirm, setDelConfirm] = useState<string | null>(null);
  const [recordForm, setRecordForm] = useState<Record<string, any>>({});
  const [fieldForm, setFieldForm] = useState({ name: '', field_type: 'text', required: false, options: '' });
  const [configOpen, setConfigOpen] = useState(false);
  const [sectionName, setSectionName] = useState(section.name);
  const [idFormat, setIdFormat] = useState(section.id_format || '{SEQ4}');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const openAdd = () => {
    setEditingRecord(null);
    setRecordForm({});
    setRecordModal(true);
  };

  const openEdit = (rec: any) => {
    setEditingRecord(rec.id);
    setRecordForm(rec.data || {});
    setRecordModal(true);
  };

  const saveRecord = async () => {
    if (editingRecord) {
      const { data } = await supabase.from('custom_records')
        .update({ data: recordForm, updated_at: new Date().toISOString() })
        .eq('id', editingRecord).select().single();
      if (data) setRecords((p) => p.map((r) => r.id === editingRecord ? data : r));
    } else {
      // Generate ID via DB function
      const { data: idData } = await supabase.rpc('generate_custom_record_id', { p_section_id: section.id });
      const { data } = await supabase.from('custom_records')
        .insert({ section_id: section.id, record_id: idData, data: recordForm })
        .select().single();
      if (data) setRecords((p) => [data, ...p]);
    }
    setRecordModal(false);
  };

  const deleteRecord = async (id: string) => {
    await supabase.from('custom_records').delete().eq('id', id);
    setRecords((p) => p.filter((r) => r.id !== id));
    setDelConfirm(null);
  };

  const addField = async () => {
    if (!fieldForm.name.trim()) return;
    const fieldKey = fieldForm.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const options = fieldForm.field_type === 'dropdown'
      ? fieldForm.options.split('\n').map((o) => o.trim()).filter(Boolean)
      : null;
    const { data } = await supabase.from('custom_fields').insert({
      section_id: section.id,
      name: fieldForm.name,
      field_key: fieldKey,
      field_type: fieldForm.field_type,
      required: fieldForm.required,
      options,
      display_order: fields.length,
    }).select().single();
    if (data) setFields((p) => [...p, data]);
    setFieldForm({ name: '', field_type: 'text', required: false, options: '' });
    setFieldModal(false);
  };

  const deleteField = async (id: string) => {
    await supabase.from('custom_fields').delete().eq('id', id);
    setFields((p) => p.filter((f) => f.id !== id));
  };

  const saveConfig = async () => {
    setSaving(true);
    await supabase.from('custom_sections').update({ name: sectionName, id_format: idFormat }).eq('id', section.id);
    setSaving(false);
    setConfigOpen(false);
  };

  const renderField = (field: any) => {
    const value = recordForm[field.field_key] ?? '';
    const base = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
    if (field.field_type === 'boolean') return (
      <button type="button" onClick={() => setRecordForm({ ...recordForm, [field.field_key]: !value })}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-colors ${value ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
        {value ? '✓ Yes' : 'No'}
      </button>
    );
    if (field.field_type === 'dropdown') return (
      <select value={value} onChange={(e) => setRecordForm({ ...recordForm, [field.field_key]: e.target.value })} className={`${base} bg-white`}>
        <option value="">Select…</option>
        {(field.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    return (
      <input type={field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : 'text'}
        value={value} onChange={(e) => setRecordForm({ ...recordForm, [field.field_key]: e.target.value })}
        className={base} />
    );
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{section.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{records.length} records · {fields.length} fields</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setConfigOpen(!configOpen)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">
            <Settings size={14} /> Configure
          </button>
          <button onClick={() => setFieldModal(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">
            <Plus size={14} /> Add Field
          </button>
          <button onClick={openAdd} disabled={fields.length === 0} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm disabled:opacity-40">
            <Plus size={14} /> Add Record
          </button>
        </div>
      </div>

      {/* Config panel */}
      {configOpen && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Section Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Section Name</label>
              <input value={sectionName} onChange={(e) => setSectionName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">ID Format</label>
              <input value={idFormat} onChange={(e) => setIdFormat(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="{SEQ4}" />
              <p className="text-xs text-slate-400">Tokens: {'{SEQ3}'} {'{SEQ4}'} {'{SEQ5}'} {'{YEAR}'} {'{MONTH}'}</p>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Fields</p>
            {fields.length === 0 ? <p className="text-xs text-slate-400">No fields yet — add your first field</p> : (
              <div className="space-y-2">
                {fields.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">{f.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-500">{f.field_type}</span>
                      {f.required && <span className="text-xs text-red-500">required</span>}
                    </div>
                    <button onClick={() => deleteField(f.id)} className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setConfigOpen(false)} className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
            <button onClick={saveConfig} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}

      {/* No fields yet */}
      {fields.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <p className="text-sm font-medium text-slate-600 mb-1">No fields defined yet</p>
          <p className="text-xs text-slate-400 mb-4">Click "Add Field" to define what data this section stores</p>
          <button onClick={() => setFieldModal(true)} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
            <Plus size={14} /> Add First Field
          </button>
        </div>
      )}

      {/* Records table */}
      {fields.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">ID</th>
                  {fields.map((f) => <th key={f.id} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{f.name}</th>)}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{rec.record_id}</td>
                    {fields.map((f) => (
                      <td key={f.id} className="px-4 py-3 text-sm text-slate-600">
                        {f.field_type === 'boolean'
                          ? (rec.data[f.field_key] ? '✓ Yes' : 'No')
                          : rec.data[f.field_key] || '—'}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(rec)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={13} /></button>
                        <button onClick={() => setDelConfirm(rec.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={fields.length + 2} className="text-center py-10 text-sm text-slate-400">No records yet — click "Add Record" to start</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Record Modal */}
      {recordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setRecordModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingRecord ? 'Edit Record' : 'Add Record'}</h2>
              <button onClick={() => setRecordModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {fields.map((f) => (
                <div key={f.id} className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{f.name}{f.required && <span className="text-red-500 ml-1">*</span>}</label>
                  {renderField(f)}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setRecordModal(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={saveRecord} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">{editingRecord ? 'Save Changes' : 'Add Record'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Field Modal */}
      {fieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setFieldModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Add Field</h2>
              <button onClick={() => setFieldModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Field Name</label>
                <input value={fieldForm.name} onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })} placeholder="e.g. License Number" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Field Type</label>
                <select value={fieldForm.field_type} onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {fieldForm.field_type === 'dropdown' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Options <span className="text-slate-400 font-normal">(one per line)</span></label>
                  <textarea value={fieldForm.options} onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })} rows={4} placeholder={"Option A\nOption B\nOption C"} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={fieldForm.required} onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })} className="rounded" />
                <span className="text-sm text-slate-700">Required field</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setFieldModal(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={addField} disabled={!fieldForm.name} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">Add Field</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDelConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete Record</h2>
            <p className="text-sm text-slate-600 mb-6">This permanently deletes this record. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelConfirm(null)} className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={() => deleteRecord(delConfirm)} className="px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-xl">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
