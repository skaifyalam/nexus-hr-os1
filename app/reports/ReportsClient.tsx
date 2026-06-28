'use client';
import { useState } from 'react';
import { Sparkles, Loader, Download, Clock, BarChart3, FileText, Layout, AlignLeft, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const REPORT_TYPES = [
  { value: 'narrative', label: 'Narrative', desc: 'Flowing professional prose with analysis', icon: AlignLeft },
  { value: 'tabular', label: 'Tabular', desc: 'Data tables and structured breakdowns', icon: BarChart3 },
  { value: 'summary', label: 'Executive Summary', desc: 'Key metrics and highlights for leadership', icon: Layout },
];

const CHIPS = [
  'Headcount breakdown by department and nationality',
  'Recruitment pipeline status and candidate summary',
  'Document expiry alerts — iqama and passport',
  'Monthly leave utilization report',
  'Salary cost analysis by department',
  'Open requisitions and hiring progress',
  'Performance review summary',
  'Attrition and turnover analysis',
  'Workforce compliance dashboard',
  'Executive board presentation summary',
];

// Renders markdown to styled React elements
const renderMarkdown = (text: string) => {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('# ')) return (
      <h1 key={i} className="text-2xl font-bold text-slate-900 mt-2 mb-4 pb-3 border-b-2 border-indigo-100">{line.slice(2)}</h1>
    );
    if (line.startsWith('## ')) return (
      <h2 key={i} className="text-lg font-bold text-slate-800 mt-6 mb-3">{line.slice(3)}</h2>
    );
    if (line.startsWith('### ')) return (
      <h3 key={i} className="text-base font-semibold text-slate-700 mt-4 mb-2">{line.slice(4)}</h3>
    );
    if (line.startsWith('- ') || line.startsWith('* ')) return (
      <div key={i} className="flex gap-2.5 py-0.5 ml-2">
        <span className="text-indigo-400 mt-1.5 flex-shrink-0 text-xs">●</span>
        <span className="text-sm text-slate-700 leading-relaxed">{renderInline(line.slice(2))}</span>
      </div>
    );
    if (line.match(/^\d+\.\s/)) return (
      <div key={i} className="flex gap-2.5 py-0.5 ml-2">
        <span className="text-indigo-500 font-medium text-sm flex-shrink-0">{line.match(/^\d+/)?.[0]}.</span>
        <span className="text-sm text-slate-700 leading-relaxed">{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
      </div>
    );
    if (line.startsWith('| ')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      const isHeader = cells.every(c => c && !c.includes('-'));
      if (cells.every(c => /^[-:]+$/.test(c))) return null;
      return (
        <div key={i} className={`flex border-b ${isHeader ? 'bg-indigo-50 border-indigo-200 font-semibold' : 'border-slate-100 hover:bg-slate-50'}`}>
          {cells.map((c, j) => (
            <div key={j} className={`flex-1 px-3 py-2 text-sm ${isHeader ? 'text-indigo-700 font-semibold' : 'text-slate-600'}`}>{c}</div>
          ))}
        </div>
      );
    }
    if (line.trim() === '---' || line.trim() === '***') return <hr key={i} className="border-slate-200 my-4" />;
    if (line.trim() === '') return <div key={i} className="h-2" />;
    return (
      <p key={i} className="text-sm text-slate-700 leading-relaxed my-0.5">{renderInline(line)}</p>
    );
  }).filter(Boolean);
};

const renderInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

export default function ReportsClient({ initialReports, companyId, userEmail }: {
  initialReports: any[]; companyId: string; userEmail: string;
}) {
  const [reports, setReports] = useState(initialReports);
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState('narrative');
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<any>(null);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const supabase = createClient();

  const generate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true); setError(''); setCurrent(null);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, report_type: type, company_id: companyId, user_email: userEmail }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }

      setCurrent(data);
      // Add to history list
      setReports(p => [{
        id: data.report_id,
        title: data.title,
        prompt,
        report_type: type,
        created_at: new Date().toISOString(),
      }, ...p]);
    } catch (err: any) {
      setError(err.message || 'Report generation failed');
    }
    setLoading(false);
  };

  const loadReport = async (id: string) => {
    const { data } = await supabase.from('ai_reports').select('*').eq('id', id).single();
    if (data) { setCurrent(data); setPrompt(data.prompt); setType(data.report_type); }
    setHistoryOpen(false);
  };

  const downloadTxt = () => {
    if (!current) return;
    const blob = new Blob([`${current.title}\nGenerated by NEXUS HR AI\n${'='.repeat(50)}\n\n${current.content}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${current.title.replace(/\s+/g, '-')}.txt`; a.click();
  };

  const typeInfo = REPORT_TYPES.find(t => t.value === type);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Report Studio</h1>
          <p className="text-sm text-slate-500 mt-0.5">Generate intelligent HR reports from plain English — powered by your real data</p>
        </div>
        <button onClick={() => setHistoryOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">
          <Clock size={14} />History {reports.length > 0 && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-xs">{reports.length}</span>}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Input panel */}
        <div className="col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <label className="text-sm font-semibold text-slate-700 block mb-2">What report do you need?</label>
            <textarea
              value={prompt} onChange={e => setPrompt(e.target.value)}
              rows={4} placeholder="E.g. Give me a headcount breakdown by department and nationality with document expiry alerts…"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-3"
            />

            <p className="text-xs font-medium text-slate-500 mb-2">Report Type</p>
            <div className="space-y-2 mb-4">
              {REPORT_TYPES.map(t => (
                <button key={t.value} onClick={() => setType(t.value)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${type === t.value ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-200'}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${type === t.value ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}>
                    <t.icon size={13} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{t.label}</p>
                    <p className="text-xs text-slate-400">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <button onClick={generate} disabled={!prompt.trim() || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {loading ? <><Loader size={14} className="animate-spin" />Generating…</> : <><Sparkles size={14} />Generate Report</>}
            </button>
          </div>

          {/* Chips */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Reports</p>
            <div className="space-y-1.5">
              {CHIPS.map(c => (
                <button key={c} onClick={() => setPrompt(c)}
                  className="w-full text-left text-xs p-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-xl transition-colors leading-relaxed">
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Report output */}
        <div className="col-span-2">
          {loading && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
              <div className="flex gap-2 justify-center mb-4">
                {[0,1,2,3].map(i => <div key={i} className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />)}
              </div>
              <p className="text-sm font-medium text-slate-600">NEXUS AI is generating your report…</p>
              <p className="text-xs text-slate-400 mt-1">Pulling live data from your database and analysing…</p>
            </div>
          )}

          {!loading && !current && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
              <BarChart3 size={40} className="text-slate-200 mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-500">Your report will appear here</p>
              <p className="text-xs text-slate-400 mt-1">Select a quick report or type your own prompt</p>
            </div>
          )}

          {!loading && current && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              {/* Report header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-t-2xl">
                <div>
                  <p className="text-sm font-bold text-slate-900">{current.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">Generated by NEXUS HR AI</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500 capitalize">{current.report_type} report</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
                <button onClick={downloadTxt}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                  <Download size={12} />Download
                </button>
              </div>

              {/* Report content */}
              <div className="p-6 space-y-0.5 max-h-[70vh] overflow-y-auto">
                {renderMarkdown(current.content || '')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
          <div className="relative bg-white w-80 h-full shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Report History</h2>
              <button onClick={() => setHistoryOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={15} /></button>
            </div>
            <div className="p-3 space-y-2">
              {reports.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No reports yet</p>}
              {reports.map(r => (
                <button key={r.id} onClick={() => loadReport(r.id)}
                  className="w-full text-left p-3 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-colors">
                  <p className="text-xs font-semibold text-slate-800 leading-snug">{r.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400 capitalize">{r.report_type}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
