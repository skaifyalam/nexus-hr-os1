'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Trash2, ShieldCheck, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ComplianceClient({ initialRules, stats, sections, allFields, companyId }: {
  initialRules: any[]; stats: Record<string, any>; sections: any[]; allFields: any[]; companyId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [rules, setRules] = useState(initialRules);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fName, setFName] = useState('');
  const [fSection, setFSection] = useState('employee');
  const [fNatField, setFNatField] = useState('');
  const [fLocalVals, setFLocalVals] = useState<string[]>([]);
  const [fTarget, setFTarget] = useState('30');
  const [fProfField, setFProfField] = useState('');

  const sectionFields = (key: string) => allFields.filter(f => f.section_key === key);
  const natOptions = (() => {
    const f = allFields.find(x => x.section_key === fSection && x.field_key === fNatField);
    return f?.options || [];
  })();

  const toggleLocalVal = (v: string) =>
    setFLocalVals(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const addRule = async () => {
    if (!fName.trim() || !fNatField || fLocalVals.length === 0) return;
    setSaving(true);
    const { data } = await supabase.from('localization_rules').insert({
      company_id: companyId,
      name: fName.trim(),
      section_key: fSection,
      nationality_field_key: fNatField,
      local_values: fLocalVals,
      target_pct: Number(fTarget) || 0,
      profession_field_key: fProfField || null,
    }).select().single();
    if (data) {
      setRules(p => [...p, data]);
      router.refresh(); // recompute stats server-side
    }
    setFName(''); setFNatField(''); setFLocalVals([]); setFTarget('30'); setFProfField('');
    setAddOpen(false); setSaving(false);
  };

  const deleteRule = async (id: string) => {
    await supabase.from('localization_rules').delete().eq('id', id);
    setRules(p => p.filter(r => r.id !== id));
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Localization Compliance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Saudization, Qatarization, Emiratization — track your nationalization percentage and hiring targets</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
          <Plus size={14} />Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
          <ShieldCheck size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600 mb-1">No compliance rules yet</p>
          <p className="text-xs text-slate-400 mb-5 max-w-md mx-auto">Define your nationalization requirement — e.g. "Saudization 30%" — and the system tracks your live percentage and tells you exactly how many locals to hire.</p>
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
            <Plus size={15} />Add Your First Rule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {rules.map(rule => {
            const s = stats[rule.id] || { total: 0, localCount: 0, currentPct: 0, hiresNeeded: 0, nonLocalHeadroom: 0, professions: [] };
            const compliant = s.currentPct >= Number(rule.target_pct);
            const pctDisplay = Math.round(s.currentPct * 10) / 10;
            return (
              <div key={rule.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 group relative">
                <button onClick={() => deleteRule(rule.id)} className="absolute top-4 right-4 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14} /></button>

                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${compliant ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                    {compliant ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
                    <p className="text-xs text-slate-400">{s.total} total · {s.localCount} local</p>
                  </div>
                </div>

                {/* Percentage bar */}
                <div className="mb-1 flex items-end justify-between">
                  <span className={`text-3xl font-bold ${compliant ? 'text-emerald-600' : 'text-red-500'}`}>{pctDisplay}%</span>
                  <span className="text-xs text-slate-400">target {rule.target_pct}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative mb-4">
                  <div className={`h-full rounded-full ${compliant ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${Math.min(100, s.currentPct)}%` }} />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700" style={{ left: `${Math.min(100, rule.target_pct)}%` }} />
                </div>

                {/* Guidance */}
                {compliant ? (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700">
                    <span className="font-semibold">Compliant.</span>{' '}
                    {s.nonLocalHeadroom > 0
                      ? <>You can hire up to <span className="font-semibold">{s.nonLocalHeadroom} non-local{s.nonLocalHeadroom !== 1 ? 's' : ''}</span> and stay above {rule.target_pct}%.</>
                      : <>Any non-local hire will drop you below target — hire locals first.</>}
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700">
                    <span className="font-semibold">Below target.</span>{' '}
                    Hire <span className="font-semibold">{s.hiresNeeded} local{s.hiresNeeded !== 1 ? 's' : ''}</span> (with no other changes) to reach {rule.target_pct}%.
                  </div>
                )}

                {/* Profession breakdown */}
                {s.professions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Local professions (Iqama)</p>
                    <div className="space-y-1.5">
                      {s.professions.map((p: any, i: number) => {
                        const max = Math.max(...s.professions.map((x: any) => x.count), 1);
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-slate-600 truncate">{p.label}</span>
                              <span className="text-slate-400 ml-2">{p.count}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(p.count / max) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Rule Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">Add Compliance Rule</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Rule name</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Saudization — KSA Operations" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Section</label>
                  <select value={fSection} onChange={e => { setFSection(e.target.value); setFNatField(''); setFLocalVals([]); setFProfField(''); }} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {sections.filter(s => s.section_key !== 'requisition').map(s => <option key={s.section_key} value={s.section_key}>{s.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Nationality field</label>
                  <select value={fNatField} onChange={e => { setFNatField(e.target.value); setFLocalVals([]); }} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select…</option>
                    {sectionFields(fSection).map(f => <option key={f.field_key} value={f.field_key}>{f.field_label}</option>)}
                  </select>
                </div>
              </div>

              {fNatField && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Which values count as "local"?</label>
                  {natOptions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {natOptions.map((o: string) => (
                        <button key={o} onClick={() => toggleLocalVal(o)} className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${fLocalVals.includes(o) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                          {o}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input value={fLocalVals.join(', ')} onChange={e => setFLocalVals(e.target.value.split(',').map(v => v.trim()).filter(Boolean))} placeholder="e.g. Saudi Arabia, Saudi" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Target %</label>
                  <input type="number" min="0" max="100" value={fTarget} onChange={e => setFTarget(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Profession field <span className="text-slate-400 font-normal">(optional)</span></label>
                  <select value={fProfField} onChange={e => setFProfField(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">None</option>
                    {sectionFields(fSection).map(f => <option key={f.field_key} value={f.field_key}>{f.field_label}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-400">Profession field enables Iqama profession tracking for your local workforce.</p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={addRule} disabled={saving || !fName.trim() || !fNatField || fLocalVals.length === 0} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">{saving ? 'Saving…' : 'Add Rule'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
