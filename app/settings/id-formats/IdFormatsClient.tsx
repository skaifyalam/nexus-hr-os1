'use client';
import { useState } from 'react';
import { Save, Hash, AlertCircle, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const TOKENS = ['{SEQ3}', '{SEQ4}', '{SEQ5}', '{YEAR}', '{MONTH}', '{COUNTRY}', '{DEPT}'];

const ENTITY_LABELS: Record<string, string> = {
  employee: 'Employee ID',
  requisition: 'Requisition ID',
  candidate: 'Candidate ID',
  transfer: 'Transfer ID',
  leave: 'Leave Request ID',
  performance: 'Performance Review ID',
  disciplinary: 'Disciplinary Record ID',
  exit: 'Exit Record ID',
};

const preview = (format: string, seq: number = 47) => {
  return format
    .replace('{YEAR}', new Date().getFullYear().toString())
    .replace('{MONTH}', String(new Date().getMonth() + 1).padStart(2, '0'))
    .replace('{COUNTRY}', 'SA')
    .replace('{DEPT}', 'ENG')
    .replace('{SEQ3}', String(seq).padStart(3, '0'))
    .replace('{SEQ4}', String(seq).padStart(4, '0'))
    .replace('{SEQ5}', String(seq).padStart(5, '0'));
};

export default function IdFormatsClient({ initialFormats }: { initialFormats: any[] }) {
  const [formats, setFormats] = useState(initialFormats);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState('');
  const supabase = createClient();

  const update = (id: string, value: string) => {
    setFormats((p) => p.map((f) => (f.id === id ? { ...f, format_string: value } : f)));
  };

  const save = async (fmt: any) => {
    setSaving(fmt.id);
    setError('');
    const { error } = await supabase.from('id_formats').update({ format_string: fmt.format_string }).eq('id', fmt.id);
    if (error) { setError(error.message); }
    else { setSaved(fmt.id); setTimeout(() => setSaved(null), 2000); }
    setSaving(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">ID Format Engine</h1>
        <p className="text-sm text-slate-500 mt-0.5">Define how every auto-generated ID looks across the system</p>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-6">
        <p className="text-sm font-medium text-indigo-800 mb-2">Available tokens</p>
        <div className="flex flex-wrap gap-2">
          {TOKENS.map((t) => (
            <span key={t} className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-mono text-indigo-700">{t}</span>
          ))}
        </div>
        <p className="text-xs text-indigo-600 mt-2">
          {'{SEQ3/4/5}'} = auto-incrementing number padded to that many digits &nbsp;·&nbsp;
          {'{COUNTRY}'} = country code (SA, KW) &nbsp;·&nbsp;
          {'{DEPT}'} = department code &nbsp;·&nbsp;
          Any fixed text you type appears as-is (e.g. NBTC-, /, -)
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4">
          <AlertCircle size={14} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      <div className="space-y-3">
        {formats.map((fmt) => (
          <div key={fmt.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Hash size={14} className="text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900">{ENTITY_LABELS[fmt.entity_type] || fmt.entity_type}</span>
                </div>
                <input
                  value={fmt.format_string}
                  onChange={(e) => update(fmt.id, e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-2">
                  Preview: <span className="font-mono font-medium text-slate-700">{preview(fmt.format_string)}</span>
                </p>
              </div>
              <button
                onClick={() => save(fmt)}
                disabled={saving === fmt.id}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors flex-shrink-0 ${saved === fmt.id ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                <Save size={13} />
                {saved === fmt.id ? 'Saved!' : saving === fmt.id ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
