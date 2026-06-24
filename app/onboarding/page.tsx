'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Loader, Check, Plus, X, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const MODULES = [
  { key: 'recruitment', label: 'Recruitment Pipeline', desc: 'Candidate mobilization — Selection to Onboarded', icon: '🎯' },
  { key: 'leave', label: 'Leave Management', desc: 'Leave requests, approvals, balances', icon: '📅' },
  { key: 'performance', label: 'Performance Management', desc: 'KPI tracking and review cycles', icon: '📈' },
  { key: 'disciplinary', label: 'Disciplinary & Grievance', desc: 'Incidents, warnings, hearings', icon: '⚠️' },
  { key: 'exit', label: 'Exit Management', desc: 'Resignations, clearances, settlements', icon: '🚪' },
];

const ICONS = ['folder', 'building', 'shield', 'users', 'briefcase', 'tool', 'truck', 'clipboard', 'star', 'globe'];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<'wizard' | 'ai' | 'review'>('wizard');
  const [wizard, setWizard] = useState({ name: '', industry: '', size: '', country: '' });
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [suggested, setSuggested] = useState<{ modules: string[]; custom: any[] } | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [customSections, setCustomSections] = useState<{ name: string; icon: string }[]>([]);
  const [newSection, setNewSection] = useState({ name: '', icon: 'folder' });
  const [saving, setSaving] = useState(false);

  const startAI = async () => {
    if (!wizard.name) return;
    setStep('ai');
    const firstMsg = { role: 'user', content: `We are ${wizard.name}, a ${wizard.industry} company with ${wizard.size} employees, operating in ${wizard.country}.` };
    const initialMsgs = [firstMsg];
    setMessages(initialMsgs);
    await sendToAI(initialMsgs, wizard);
  };

  const sendToAI = async (msgs: any[], context?: any) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/onboarding-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs, company_context: context || wizard }),
      });
      const data = await res.json();
      const text = data.text || "Could you tell me more about your company?";
      const aiMsg = { role: 'ai', content: text };
      setMessages((p) => [...p, aiMsg]);

      if (data.action?.action === 'suggest_setup') {
        setSuggested({ modules: data.action.modules || [], custom: data.action.custom_sections || [] });
        setSelectedModules(data.action.modules || []);
        setCustomSections(data.action.custom_sections || []);
        setStep('review');
      }
    } catch (err) {
      setMessages((p) => [...p, { role: 'ai', content: "Sorry, I had a connection issue. Please type your message again." }]);
    } finally {
      setAiLoading(false);
    }
  };

  const send = async () => {
    if (!input.trim() || aiLoading) return;
    const userMsg = { role: 'user', content: input };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    sendToAI(newMsgs);
  };

  const toggleModule = (key: string) => {
    setSelectedModules((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key]);
  };

  const addCustomSection = () => {
    if (!newSection.name.trim()) return;
    setCustomSections((p) => [...p, { ...newSection }]);
    setNewSection({ name: '', icon: 'folder' });
  };

  const finish = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user?.id).single();

    let companyId = profile?.company_id;

    // Create company if not yet created
    if (!companyId) {
      const { data: company } = await supabase.from('company_profile').insert({
        name: wizard.name, industry: wizard.industry, size_range: wizard.size,
        headquarters_country: wizard.country, onboarding_complete: true,
      }).select().single();
      companyId = company?.id;
      await supabase.from('profiles').update({ company_id: companyId }).eq('id', user?.id);
    } else {
      await supabase.from('company_profile').update({
        name: wizard.name, industry: wizard.industry, onboarding_complete: true,
      }).eq('id', companyId);
    }

    // Install selected modules
    if (selectedModules.length > 0) {
      const moduleRows = selectedModules.map((key, i) => ({
        company_id: companyId,
        module_key: key,
        label: MODULES.find((m) => m.key === key)?.label || key,
        sidebar_order: i + 10,
      }));
      await supabase.from('installed_modules').insert(moduleRows);
    }

    // Create custom sections
    for (const cs of customSections) {
      await supabase.from('custom_sections').insert({
        company_id: companyId, name: cs.name, icon: cs.icon || 'folder', sidebar_order: 50,
      });
    }

    // Save onboarding messages
    const msgRows = messages.map((m) => ({ company_id: companyId, role: m.role, content: m.content }));
    if (msgRows.length > 0) await supabase.from('onboarding_messages').insert(msgRows);

    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* STEP 1: Wizard */}
      {step === 'wizard' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 w-full max-w-lg p-8">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center mb-5">
            <span className="text-white text-sm font-bold">N</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome to NEXUS HR</h1>
          <p className="text-sm text-slate-500 mb-6">Let's set up your platform in 2 minutes</p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Company Name</label>
              <input value={wizard.name} onChange={(e) => setWizard({ ...wizard, name: e.target.value })} placeholder="e.g. NBTC Group" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Industry</label>
              <input value={wizard.industry} onChange={(e) => setWizard({ ...wizard, industry: e.target.value })} placeholder="e.g. EPC / Oil & Gas / Construction" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Company Size</label>
              <select value={wizard.size} onChange={(e) => setWizard({ ...wizard, size: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select…</option>
                {['1-50', '51-200', '201-1000', '1000+'].map((s) => <option key={s} value={s}>{s} employees</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Primary Country of Operation</label>
              <input value={wizard.country} onChange={(e) => setWizard({ ...wizard, country: e.target.value })} placeholder="e.g. Saudi Arabia" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button onClick={startAI} disabled={!wizard.name || !wizard.industry || !wizard.country} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 mt-2">
              <Sparkles size={15} /> Continue with AI Setup
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: AI Chat */}
      {step === 'ai' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 w-full max-w-xl">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">NEXUS AI Setup Assistant</p>
              <p className="text-xs text-slate-400">Helping you configure your platform</p>
            </div>
          </div>
          <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl px-4 py-3 flex gap-1.5">
                  {[0,1,2].map((i) => <div key={i} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 p-4 border-t border-slate-100">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Tell the AI about your needs…" className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={send} disabled={aiLoading} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"><Send size={14} /></button>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Confirm */}
      {step === 'review' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Your Setup — Review & Confirm</h2>
            <p className="text-sm text-slate-500 mt-0.5">Based on your conversation. Change anything before finishing.</p>
          </div>
          <div className="p-6 space-y-6">
            {/* Modules */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Optional Modules</p>
              <div className="space-y-2">
                {MODULES.map((m) => (
                  <button key={m.key} onClick={() => toggleModule(m.key)} className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${selectedModules.includes(m.key) ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{m.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{m.label}</p>
                        <p className="text-xs text-slate-400">{m.desc}</p>
                      </div>
                    </div>
                    {selectedModules.includes(m.key) && <Check size={15} className="text-indigo-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Sections */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Custom Sections</p>
              <div className="space-y-2 mb-3">
                {customSections.map((cs, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-sm text-slate-700">{cs.name}</span>
                    <button onClick={() => setCustomSections((p) => p.filter((_, j) => j !== i))} className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><X size={13} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newSection.name} onChange={(e) => setNewSection({ ...newSection, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addCustomSection()} placeholder="Add custom section (e.g. Subcontractors)" className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={addCustomSection} className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl"><Plus size={16} className="text-slate-600" /></button>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100">
            <button onClick={() => setStep('ai')} className="text-sm text-slate-500 hover:text-slate-700">← Back to chat</button>
            <button onClick={finish} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
              {saving ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Setting up…' : 'Finish Setup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
