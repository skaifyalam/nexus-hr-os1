'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, ChevronLeft, Loader } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

const INDUSTRIES = ['EPC / Engineering', 'Oil & Gas', 'Construction', 'Contracting', 'Manufacturing', 'Retail', 'Healthcare', 'Finance', 'Technology', 'Other'];
const SIZES = ['1–50', '51–200', '201–1000', '1000+'];

const STEPS = ['Company Info', 'Done'];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [info, setInfo] = useState({ name: '', industry: '', size: '' });
  const [finishError, setFinishError] = useState('');
  const [isNewCompany, setIsNewCompany] = useState(false);

  // "?new=1&name=X" → creating an ADDITIONAL company from the switcher (pre-fill name).
  // Otherwise → first-time signup naming the company that was auto-created on signup.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      setIsNewCompany(true);
      const nm = params.get('name');
      if (nm) setInfo(prev => ({ ...prev, name: nm }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canNext = () => {
    if (step === 0) return info.name.trim() && info.industry && info.size;
    return true;
  };

  const finish = async () => {
    setSaving(true);
    setFinishError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setFinishError('Not logged in.'); setSaving(false); return; }

      const { data: existingProfile } = await supabase
        .from('profiles').select('company_id').eq('id', user.id).single();
      let companyId = existingProfile?.company_id;

      if (isNewCompany) {
        // Additional company from the switcher: create + switch, then fill details.
        const { data: newId, error: rpcError } = await supabase.rpc('create_additional_company', { p_name: info.name });
        if (rpcError || !newId) {
          setFinishError(`Company creation failed: ${rpcError?.message || 'unknown error'}. Make sure the multi-company SQL has been run.`);
          setSaving(false); return;
        }
        companyId = newId;
        await supabase.rpc('switch_company', { target_company_id: newId });
        const { error: updErr } = await supabase.from('company_profile').update({
          industry: info.industry, size_range: info.size, onboarding_complete: true,
        }).eq('id', newId);
        if (updErr) { setFinishError(`Could not save company details: ${updErr.message}`); setSaving(false); return; }
      } else if (!companyId) {
        // No company yet — create one and link it to the profile.
        const { data: company, error: companyError } = await supabase
          .from('company_profile').insert({
            name: info.name, industry: info.industry, size_range: info.size, onboarding_complete: true,
          }).select().single();
        if (companyError || !company) {
          setFinishError(`Company setup failed: ${companyError?.message || 'unknown error'}`);
          setSaving(false); return;
        }
        companyId = company.id;
        const { error: profileError } = await supabase
          .from('profiles').update({ company_id: companyId }).eq('id', user.id);
        if (profileError) { setFinishError(`Profile link failed: ${profileError.message}`); setSaving(false); return; }
      } else {
        // Normal first-run: name the company that was auto-created on signup.
        // Error is surfaced (not swallowed) so a failed save is never silent.
        const { error: updErr } = await supabase.from('company_profile').update({
          name: info.name, industry: info.industry, size_range: info.size, onboarding_complete: true,
        }).eq('id', companyId);
        if (updErr) { setFinishError(`Could not save company details: ${updErr.message}`); setSaving(false); return; }
      }

      router.push('/dashboard');
    } catch (err: any) {
      setFinishError(err.message || 'Something went wrong.');
      setSaving(false);
    }
  };

  const progress = ((step) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 w-full max-w-xl">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
                <span className="text-white text-sm font-bold">N</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Naibus</p>
                <p className="text-xs text-slate-400">Setup Wizard</p>
              </div>
            </div>
            <button onClick={() => { window.location.href = '/dashboard'; }} className="text-xs font-medium text-slate-400 hover:text-slate-600">
              Back to app
            </button>
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
                <p className="text-sm text-slate-500 mt-0.5">Just the basics — you'll add your data next</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Company Name <span className="text-red-500">*</span></label>
                  <input value={info.name} onChange={e => setInfo({ ...info, name: e.target.value })} placeholder="e.g. Acme Group" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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

          {/* Step 1: Done */}
          {step === 1 && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl flex items-center justify-center">
                <Check size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{info.name} is ready</h2>
                <p className="text-sm text-slate-500 mt-1">Your workspace is set up. Add your data whenever you're ready.</p>
              </div>
              <div className="w-full bg-slate-50 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your company</p>
                <div className="text-sm text-slate-700 space-y-1">
                  <p>🏢 <span className="font-medium">{info.name}</span> · {info.industry} · {info.size} employees</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">Add countries, departments, and sections any time from the sidebar and Admin settings.</p>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:text-slate-900 transition-colors">
              <ChevronLeft size={15} /> Back
            </button>
          ) : <div />}

          {step === 0 && (
            <button onClick={() => setStep(1)} disabled={!canNext()} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              Continue <ChevronRight size={15} />
            </button>
          )}

          {step === 1 && (
            <button onClick={finish} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
              {saving ? <><Loader size={14} className="animate-spin" /> Setting up…</> : <>Launch Naibus <ChevronRight size={15} /></>}
            </button>
          )}
        </div>
        {finishError && (
          <div className="px-8 pb-4 text-xs text-red-600 bg-red-50 border-t border-red-100 py-3 rounded-b-2xl">
            ⚠️ {finishError}
          </div>
        )}
      </div>
    </div>
  );
}
