'use client';
import { useState } from 'react';
import { Save, Hash, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const TOKENS = ['{SEQ3}','{SEQ4}','{SEQ5}','{YEAR}','{MONTH}'];

const preview = (format: string) =>
  (format || '{SEQ4}')
    .replace('{YEAR}', new Date().getFullYear().toString())
    .replace('{MONTH}', String(new Date().getMonth()+1).padStart(2,'0'))
    .replace('{SEQ3}', '047').replace('{SEQ4}', '0047').replace('{SEQ5}', '00047');

export default function IdFormatsClient({ initialSections, companyId }: { initialSections: any[]; companyId: string }) {
  const [sections, setSections] = useState(initialSections);
  const [saved, setSaved] = useState<string|null>(null);
  const supabase = createClient();

  const update = (id: string, value: string) =>
    setSections(p => p.map(s => s.id === id ? { ...s, id_format: value } : s));

  const save = async (sec: any) => {
    await supabase.from('company_sections').update({ id_format: sec.id_format }).eq('id', sec.id);
    setSaved(sec.id); setTimeout(() => setSaved(null), 2000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">ID Format Engine</h1>
        <p className="text-sm text-slate-500 mt-0.5">Define how auto-generated IDs look for each section</p>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-5">
        <p className="text-sm font-medium text-indigo-800 mb-2">Available tokens</p>
        <div className="flex flex-wrap gap-2">
          {TOKENS.map(t => <span key={t} className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-mono text-indigo-700">{t}</span>)}
        </div>
        <p className="text-xs text-indigo-600 mt-2">{'{SEQ3/4/5}'} = auto-number (zero-padded) · {'{YEAR}'}/{'{MONTH}'} = current date · Any fixed text (like EMP-) appears as-is</p>
      </div>

      <div className="space-y-3">
        {sections.map(sec => (
          <div key={sec.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Hash size={14} className="text-slate-400"/>
                  <span className="text-sm font-semibold text-slate-900">{sec.label}</span>
                </div>
                <input value={sec.id_format || ''} onChange={e => update(sec.id, e.target.value)}
                  placeholder="{SEQ4}"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                <p className="text-xs text-slate-400 mt-2">Preview: <span className="font-mono font-medium text-slate-700">{preview(sec.id_format)}</span></p>
              </div>
              <button onClick={() => save(sec)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-xl transition-colors flex-shrink-0 mt-6 ${saved === sec.id ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                {saved === sec.id ? <><Check size={13}/>Saved</> : <><Save size={13}/>Save</>}
              </button>
            </div>
          </div>
        ))}
        {sections.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-400">
            No sections yet. Add sections first, then set their ID formats here.
          </div>
        )}
      </div>
    </div>
  );
}
