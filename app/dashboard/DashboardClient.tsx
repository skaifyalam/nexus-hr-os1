'use client';
import { useState, useEffect } from 'react';
import {
  Plus, X, Trash2, BarChart3, PieChart, Hash, List, TrendingUp,
  Loader, Settings2, LayoutDashboard,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const COLORS = ['indigo', 'violet', 'emerald', 'amber', 'rose', 'sky', 'teal', 'orange'];
const COLOR_MAP: Record<string, { bg: string; text: string; bar: string }> = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', bar: 'bg-indigo-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', bar: 'bg-violet-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', bar: 'bg-rose-500' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-600', bar: 'bg-sky-500' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-600', bar: 'bg-teal-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', bar: 'bg-orange-500' },
};

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#14b8a6', '#f97316', '#a855f7', '#84cc16', '#ec4899', '#06b6d4'];

export default function DashboardClient({ initialWidgets, sections, allFields, companyId }: {
  initialWidgets: any[]; sections: any[]; allFields: any[]; companyId: string;
}) {
  const [widgets, setWidgets] = useState(initialWidgets);
  const [dragW, setDragW] = useState<string | null>(null);
  const [dragOverW, setDragOverW] = useState<string | null>(null);

  const reorder = async (targetId: string) => {
    setDragOverW(null);
    if (!dragW || dragW === targetId) { setDragW(null); return; }
    const list = [...widgets];
    const fromIdx = list.findIndex(w => w.id === dragW);
    const toIdx = list.findIndex(w => w.id === targetId);
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setWidgets(list);
    setDragW(null);
    // Persist new order
    await Promise.all(list.map((w, i) =>
      supabase.from('dashboard_widgets').update({ display_order: i }).eq('id', w.id)
    ));
  };
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const supabase = createClient();

  // Widget builder form
  const [wTitle, setWTitle] = useState('');
  const [wSection, setWSection] = useState('');
  const [wMetric, setWMetric] = useState('count');
  const [wField, setWField] = useState('');
  const [wFilterField, setWFilterField] = useState('');
  const [wFilterValue, setWFilterValue] = useState('');
  const [wDisplay, setWDisplay] = useState('card');
  const [wColor, setWColor] = useState('indigo');

  const sectionFields = (key: string) => allFields.filter(f => f.section_key === key);
  const fieldOptions = (key: string, fieldKey: string) => {
    const f = allFields.find(x => x.section_key === key && x.field_key === fieldKey);
    return f?.options || [];
  };

  const loadData = async (widgetList: any[]) => {
    if (widgetList.length === 0) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/widget-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: widgetList, company_id: companyId }),
      });
      const json = await res.json();
      const map: Record<string, any> = {};
      (json.results || []).forEach((r: any) => { map[r.id] = r; });
      setData(map);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(widgets); }, []);

  const addWidget = async () => {
    if (!wTitle.trim() || !wSection) return;
    const { data: widget } = await supabase.from('dashboard_widgets').insert({
      company_id: companyId,
      widget_key: `w_${Date.now()}`,
      widget_label: wTitle,
      section_key: wSection,
      metric: wMetric,
      field_key: wField || null,
      filter_field: wFilterField || null,
      filter_value: wFilterValue || null,
      display: wDisplay,
      color: wColor,
      display_order: widgets.length,
    }).select().single();

    if (widget) {
      const updated = [...widgets, widget];
      setWidgets(updated);
      loadData(updated);
    }
    // reset
    setWTitle(''); setWSection(''); setWMetric('count'); setWField('');
    setWFilterField(''); setWFilterValue(''); setWDisplay('card'); setWColor('indigo');
    setAddOpen(false);
  };

  const removeWidget = async (id: string) => {
    await supabase.from('dashboard_widgets').delete().eq('id', id);
    setWidgets(p => p.filter(w => w.id !== id));
  };

  const sectionLabel = (key: string) => sections.find(s => s.section_key === key)?.label || key;

  // Auto-suggest a title
  useEffect(() => {
    if (!wSection) return;
    const sec = sectionLabel(wSection);
    if (wMetric === 'count') setWTitle(`Total ${sec}`);
    else if (wMetric === 'breakdown' && wField) {
      const f = allFields.find(x => x.section_key === wSection && x.field_key === wField);
      setWTitle(`${sec} by ${f?.field_label || ''}`);
    } else if (wMetric === 'sum' && wField) {
      const f = allFields.find(x => x.section_key === wSection && x.field_key === wField);
      setWTitle(`Total ${f?.field_label || ''}`);
    } else if (wMetric === 'filtered_count' && wFilterValue) {
      setWTitle(`${wFilterValue} ${sec}`);
    }
  }, [wSection, wMetric, wField, wFilterValue]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your custom metrics — built from your live data</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
          <Plus size={14} />Add Widget
        </button>
      </div>

      {widgets.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <LayoutDashboard size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600 mb-1">Build your dashboard</p>
          <p className="text-xs text-slate-400 mb-5 max-w-sm mx-auto">Add widgets for any metric you care about — total counts, breakdowns by any field, sums, all from your live data.</p>
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
            <Plus size={15} />Add Your First Widget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {widgets.map(w => {
            const d = data[w.id] || {};
            const c = COLOR_MAP[w.color] || COLOR_MAP.indigo;
            const isWide = w.display === 'bar' || w.display === 'pie' || w.metric === 'breakdown';
            return (
              <div key={w.id}
                draggable
                onDragStart={() => setDragW(w.id)}
                onDragOver={e => { e.preventDefault(); setDragOverW(w.id); }}
                onDragLeave={() => setDragOverW(d2 => d2 === w.id ? null : d2)}
                onDrop={() => reorder(w.id)}
                className={`bg-white rounded-2xl border shadow-sm p-5 group relative cursor-grab active:cursor-grabbing transition-all ${dragOverW === w.id ? 'ring-2 ring-indigo-400 border-indigo-300' : 'border-slate-100'} ${dragW === w.id ? 'opacity-40' : ''} ${isWide ? 'col-span-3 md:col-span-1' : ''} ${(w.display === 'bar' || w.display === 'pie') ? 'col-span-3 md:col-span-2' : ''}`}>
                <button onClick={() => removeWidget(w.id)} className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><X size={14} /></button>

                {/* COUNT / SUM card */}
                {(w.metric === 'count' || w.metric === 'sum' || w.metric === 'filtered_count') && (
                  <>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.bg} ${c.text}`}>
                      {w.metric === 'sum' ? <TrendingUp size={16} /> : <Hash size={16} />}
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-0.5">
                      {loading ? <Loader size={20} className="animate-spin text-slate-300" /> : (d.value ?? 0).toLocaleString()}
                    </div>
                    <div className="text-xs font-medium text-slate-500">{w.widget_label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{sectionLabel(w.section_key)}</div>
                  </>
                )}

                {/* BREAKDOWN - bars */}
                {w.metric === 'breakdown' && w.display !== 'pie' && (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 size={15} className={c.text} />
                      <p className="text-sm font-semibold text-slate-800">{w.widget_label}</p>
                    </div>
                    {loading ? <Loader size={18} className="animate-spin text-slate-300" /> : (
                      <div className="space-y-2">
                        {(d.breakdown || []).map((item: any, i: number) => {
                          const max = Math.max(...(d.breakdown || []).map((x: any) => x.count), 1);
                          return (
                            <div key={i}>
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="text-slate-600 truncate">{item.label}</span>
                                <span className="text-slate-400 font-medium ml-2">{item.count}</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${c.bar} rounded-full`} style={{ width: `${(item.count / max) * 100}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        {(!d.breakdown || d.breakdown.length === 0) && <p className="text-xs text-slate-400">No data yet</p>}
                      </div>
                    )}
                  </>
                )}

                {/* BREAKDOWN - pie */}
                {w.metric === 'breakdown' && w.display === 'pie' && (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <PieChart size={15} className={c.text} />
                      <p className="text-sm font-semibold text-slate-800">{w.widget_label}</p>
                    </div>
                    {loading ? <Loader size={18} className="animate-spin text-slate-300" /> : (
                      <PieView breakdown={d.breakdown || []} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Widget Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Add Widget</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Section */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Which section?</label>
                <select value={wSection} onChange={e => { setWSection(e.target.value); setWField(''); setWFilterField(''); }} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select section…</option>
                  {sections.map(s => <option key={s.section_key} value={s.section_key}>{s.label}</option>)}
                </select>
              </div>

              {/* Metric */}
              {wSection && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">What to measure?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: 'count', label: 'Total count', icon: Hash },
                      { v: 'breakdown', label: 'Breakdown by field', icon: BarChart3 },
                      { v: 'filtered_count', label: 'Count where…', icon: List },
                      { v: 'sum', label: 'Sum of a number', icon: TrendingUp },
                    ].map(m => (
                      <button key={m.v} onClick={() => setWMetric(m.v)} className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-sm transition-colors ${wMetric === m.v ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        <m.icon size={14} />{m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Field for breakdown/sum */}
              {wSection && (wMetric === 'breakdown' || wMetric === 'sum') && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{wMetric === 'sum' ? 'Which number field?' : 'Group by which field?'}</label>
                  {wMetric === 'sum' && sectionFields(wSection).filter(f => f.field_type === 'number').length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                      No number fields in {sectionLabel(wSection)}. To sum a column (like Salary or Headcount), open that section → <span className="font-medium">Fields</span> → edit the field → set its type to <span className="font-medium">number</span>. Then it will appear here.
                    </div>
                  ) : (
                    <select value={wField} onChange={e => setWField(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Select field…</option>
                      {sectionFields(wSection)
                        .filter(f => wMetric === 'sum' ? f.field_type === 'number' : true)
                        .map(f => <option key={f.field_key} value={f.field_key}>{f.field_label}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* Filter for filtered_count */}
              {wSection && wMetric === 'filtered_count' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Field</label>
                    <select value={wFilterField} onChange={e => { setWFilterField(e.target.value); setWFilterValue(''); }} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Select…</option>
                      {sectionFields(wSection).map(f => <option key={f.field_key} value={f.field_key}>{f.field_label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Equals</label>
                    {fieldOptions(wSection, wFilterField).length > 0 ? (
                      <select value={wFilterValue} onChange={e => setWFilterValue(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select…</option>
                        {fieldOptions(wSection, wFilterField).map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input value={wFilterValue} onChange={e => setWFilterValue(e.target.value)} placeholder="value" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    )}
                  </div>
                </div>
              )}

              {/* Display type for breakdown */}
              {wMetric === 'breakdown' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">How to display?</label>
                  <div className="flex gap-2">
                    {[{ v: 'bar', label: 'Bars', icon: BarChart3 }, { v: 'pie', label: 'Pie', icon: PieChart }].map(dt => (
                      <button key={dt.v} onClick={() => setWDisplay(dt.v)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm ${wDisplay === dt.v ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        <dt.icon size={14} />{dt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title */}
              {wSection && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Widget title</label>
                  <input value={wTitle} onChange={e => setWTitle(e.target.value)} placeholder="Widget name" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}

              {/* Color */}
              {wSection && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Color</label>
                  <div className="flex gap-2">
                    {COLORS.map(col => (
                      <button key={col} onClick={() => setWColor(col)} className={`w-7 h-7 rounded-lg ${COLOR_MAP[col].bar} ${wColor === col ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={addWidget} disabled={!wTitle.trim() || !wSection} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Add Widget</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple SVG pie chart
function PieView({ breakdown }: { breakdown: any[] }) {
  const PIE_COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#14b8a6', '#f97316', '#a855f7', '#84cc16', '#ec4899', '#06b6d4'];
  const total = breakdown.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <p className="text-xs text-slate-400">No data yet</p>;
  let cumulative = 0;
  const slices = breakdown.map((item, i) => {
    const start = (cumulative / total) * 360;
    cumulative += item.count;
    const end = (cumulative / total) * 360;
    const largeArc = end - start > 180 ? 1 : 0;
    const x1 = 50 + 40 * Math.cos((Math.PI * (start - 90)) / 180);
    const y1 = 50 + 40 * Math.sin((Math.PI * (start - 90)) / 180);
    const x2 = 50 + 40 * Math.cos((Math.PI * (end - 90)) / 180);
    const y2 = 50 + 40 * Math.sin((Math.PI * (end - 90)) / 180);
    return { path: `M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z`, color: PIE_COLORS[i % PIE_COLORS.length], label: item.label, count: item.count };
  });
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0">
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
      </svg>
      <div className="space-y-1 flex-1 min-w-0">
        {slices.slice(0, 8).map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-slate-600 truncate">{s.label}</span>
            <span className="text-slate-400 ml-auto">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
