'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, ChevronLeft, Loader, Plus, X, Building2, Users, Globe, Settings, GitBranch, Calendar, TrendingUp, AlertTriangle, DoorOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const MODULES = [
  { key: 'recruitment', label: 'Recruitment Pipeline', desc: 'Track candidates from Selection to Onboarded across 13 GCC mobilization stages', icon: GitBranch, recommended: ['epc','oil','construction','contracting'] },
  { key: 'leave', label: 'Leave Management', desc: 'Leave requests, approvals, and balance tracking', icon: Calendar, recommended: [] },
  { key: 'performance', label: 'Performance Management', desc: 'KPI setting, reviews, and AI-generated summaries', icon: TrendingUp, recommended: [] },
  { key: 'disciplinary', label: 'Disciplinary & Grievance', desc: 'Incident logging, warning letters, hearings', icon: AlertTriangle, recommended: [] },
  { key: 'exit', label: 'Exit Management', desc: 'Resignations, clearances, and final settlements', icon: DoorOpen, recommended: [] },
];

const INDUSTRIES = ['EPC / Engineering', 'Oil & Gas', 'Construction', 'Contracting', 'Manufacturing', 'Retail', 'Healthcare', 'Finance', 'Technology', 'Other'];
const SIZES = ['1–50', '51–200', '201–1000', '1000+'];
const COUNTRIES = ['Saudi Arabia', 'Kuwait', 'UAE', 'Qatar', 'Bahrain', 'Oman', 'Other'];

const STEPS = ['Company Info', 'Countries', 'Modules', 'Custom Sections', 'Done'];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [info, setInfo] = useState({ name: '', industry: '', size: '' });
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [otherCountry, setOtherCountry] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>(['recruitment']);
  const [customSections, setCustomSections] = useState<{ name: string }[]>([]);
  const [newSection, setNewSection] = useState('');

  const toggleCountry = (c: string) => setSelectedCountries(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleModule = (k: string) => setSelectedModules(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);

  const addSection = () => {
    if (!newSection.trim()) return;
    setCustomSections(p => [...p, { name: newSection.trim() }]);
    setNewSection('');
  };

  const canNext = () => {
    if (step === 0) return info.name.trim() && info.industry && info.size;
    if (step === 1) return selectedCountries.length > 0;
    return true;
  };

  const finish = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Create or update company profile
      const allCountries = [...selectedCountries, otherCountry.trim() ? otherCountry.trim() : ''].filter(Boolean);

      let companyId: string | null = null;
      const { data: existingProfile } = await supabase.from('profiles').select('company_id').eq('id', user?.id).single();

      if (existingProfile?.company_id) {
        companyId = existingProfile.company_id;
        await supabase.from('company_profile').update({
          name: info.name,
          industry: info.industry,
          size_range: info.size,
          headquarters_country: allCountries[0] || '',
          onboarding_complete: true,
        }).eq('id', companyId);
      } else {
        const { data: company } = await supabase.from('company_profile').insert({
          name: info.name,
          industry: info.industry,
          size_range: info.size,
          headquarters_country: allCountries[0] || '',
          onboarding_complete: true,
        }).select().single();
        companyId = company?.id;
        await supabase.from('profiles').update({ company_id: companyId }).eq('id', user?.id);
      }

      // Create operations (countries)
      for (let i = 0; i < allCountries.length; i++) {
        const countryName = allCountries[i];
        const codeMap: Record<string, string> = {
          'Saudi Arabia': 'SA', 'Kuwait': 'KW', 'UAE': 'AE',
          'Qatar': 'QA', 'Bahrain': 'BH', 'Oman': 'OM',
        };
        await supabase.from('operations').insert({
          name: `${countryName} Operations`,
          country_code: codeMap[countryName] || countryName.slice(0, 2).toUpperCase(),
        });
      }

      // Install selected modules
      if (selectedModules.length > 0) {
        const rows = selectedModules.map((key, i) => ({
          company_id: companyId,
          module_key: key,
          label: MODULES.find(m => m.key === key)?.label || key,
          sidebar_order: i + 10,
        }));
        await supabase.from('installed_modules').insert(rows);
      }

      // Create custom sections
      for (let i = 0; i < customSections.length; i++) {
        await supabase.from('custom_sections').insert({
          company_id: companyId,
          name: customSections[i].name,
          icon: 'folder',
          sidebar_order: 50 + i,
        });
      }

      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const progress = ((step) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 w-full max-w-xl">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-sm font-bold">N</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">NEXUS HR</p>
              <p className="text-xs text-slate-400">Setup Wizard</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-2">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${i < step ? 'bg-indigo-600 text-white' : i === step ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded-full transition-colors ${i < step ? 'bg-indigo-600' : 'bg-slate-100'}`} />}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        </div>

        {/* Step content */}
        <div className="px-8 py-6 min-h-72">

          {/* Step 0: Company Info */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Tell us about your company</h2>
                <p className="text-sm text-slate-500 mt-0.5">This sets up your workspace</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Company Name <span className="text-red-500">*</span></label>
                  <input value={info.name} onChange={e => setInfo({ ...info, name: e.target.value })} placeholder="e.g. NBTC Group" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Industry <span className="text-red-500">*</span></label>
                  <select value={info.industry} onChange={e => setInfo({ ...info, industry: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select industry…</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Company Size <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-4 gap-2">
                    {SIZES.map(s => (
                      <button key={s} onClick={() => setInfo({ ...info, size: s })} className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${info.size === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Countries */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Where do you operate?</h2>
                <p className="text-sm text-slate-500 mt-0.5">Select all countries — HR staff will be scoped to their country</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {COUNTRIES.filter(c => c !== 'Other').map(c => (
                  <button key={c} onClick={() => toggleCountry(c)} className={`flex items-center justify-between p-3 rounded-xl border text-sm text-left transition-colors ${selectedCountries.includes(c) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-200'}`}>
                    {c}
                    {selectedCountries.includes(c) && <Check size={14} className="text-indigo-600" />}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Other country (optional)</label>
                <input value={otherCountry} onChange={e => setOtherCountry(e.target.value)} placeholder="e.g. Pakistan" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}

          {/* Step 2: Modules */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Which modules do you need?</h2>
                <p className="text-sm text-slate-500 mt-0.5">You can always add or remove these later from Settings</p>
              </div>
              <div className="space-y-2">
                {MODULES.map(m => {
                  const isRec = m.recommended.some(r => info.industry.toLowerCase().includes(r));
                  return (
                    <button key={m.key} onClick={() => toggleModule(m.key)} className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors ${selectedModules.includes(m.key) ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-200 hover:border-indigo-200'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedModules.includes(m.key) ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}>
                        <m.icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800">{m.label}</p>
                          {isRec && <span className="text-xs px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full">Recommended</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
                      </div>
                      {selectedModules.includes(m.key) && <Check size={15} className="text-indigo-600 flex-shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Custom Sections */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Any custom sections?</h2>
                <p className="text-sm text-slate-500 mt-0.5">Add any section that doesn't fit the standard modules — you define the fields yourself</p>
              </div>
              <div className="space-y-2 mb-2">
                {[
                  { name: 'Subcontractors', hint: 'Track subcontractor companies and contacts' },
                  { name: 'HSE Inspections', hint: 'Health, safety, and environment records' },
                  { name: 'Assets & Equipment', hint: 'Company vehicles, tools, equipment' },
                  { name: 'Training Records', hint: 'Certifications and training history' },
                ].map(suggestion => (
                  <button key={suggestion.name} onClick={() => {
                    if (!customSections.find(s => s.name === suggestion.name)) {
                      setCustomSections(p => [...p, { name: suggestion.name }]);
                    }
                  }} className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-sm transition-colors ${customSections.find(s => s.name === suggestion.name) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-200'}`}>
                    <div>
                      <p className="font-medium">{suggestion.name}</p>
                      <p className="text-xs text-slate-400">{suggestion.hint}</p>
                    </div>
                    {customSections.find(s => s.name === suggestion.name)
                      ? <Check size={14} className="text-indigo-600 flex-shrink-0" />
                      : <Plus size={14} className="text-slate-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
              {customSections.filter(s => !['Subcontractors','HSE Inspections','Assets & Equipment','Training Records'].includes(s.name)).map((cs, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <span className="text-sm text-indigo-700">{cs.name}</span>
                  <button onClick={() => setCustomSections(p => p.filter((_, j) => j !== i + 4))} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={newSection} onChange={e => setNewSection(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSection()} placeholder="Add your own section…" className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={addSection} disabled={!newSection.trim()} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 disabled:opacity-40"><Plus size={16} /></button>
              </div>
              <p className="text-xs text-slate-400">You can also add more sections any time from the sidebar</p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center">
                <Check size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{info.name} is ready</h2>
                <p className="text-sm text-slate-500 mt-1">Your NEXUS HR platform is configured and ready to use</p>
              </div>
              <div className="w-full bg-slate-50 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your setup</p>
                <div className="text-sm text-slate-700 space-y-1">
                  <p>🏢 <span className="font-medium">{info.name}</span> · {info.industry} · {info.size} employees</p>
                  <p>🌍 {selectedCountries.join(', ')}{otherCountry ? `, ${otherCountry}` : ''}</p>
                  <p>📦 {selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''} installed</p>
                  {customSections.length > 0 && <p>🗂 {customSections.length} custom section{customSections.length !== 1 ? 's' : ''}: {customSections.map(s => s.name).join(', ')}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100">
          {step > 0 && step < 4 ? (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:text-slate-900 transition-colors">
              <ChevronLeft size={15} /> Back
            </button>
          ) : <div />}

          {step < 3 && (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              Next <ChevronRight size={15} />
            </button>
          )}

          {step === 3 && (
            <button onClick={() => setStep(4)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
              Review Setup <ChevronRight size={15} />
            </button>
          )}

          {step === 4 && (
            <button onClick={finish} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
              {saving ? <><Loader size={14} className="animate-spin" /> Setting up…</> : <>Launch NEXUS HR <ChevronRight size={15} /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
