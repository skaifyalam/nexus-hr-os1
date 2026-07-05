'use client';
import { useState, useMemo } from 'react';
import { Plus, X, Star, Download, Award, TrendingUp, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import PersonPicker from '@/components/PersonPicker';
import { createClient } from '@/lib/supabase/client';

export default function PerformanceClient({ initialReviews, employees, empFields, companyId, userEmail }: {
  initialReviews: any[]; employees: any[]; empFields: any[]; companyId: string; userEmail: string;
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [addOpen, setAddOpen] = useState(false);
  const [cycleFilter, setCycleFilter] = useState('all');
  const supabase = createClient();

  const nameField = useMemo(() => empFields.find(f => /name/i.test(f.field_label))?.field_key, [empFields]);
  const idField = useMemo(() => empFields.find(f => f.is_id_field)?.field_key, [empFields]);
  const empName = (e: any) => (nameField && e.data?.[nameField]) || e.record_id || 'Unnamed';
  const empCode = (e: any) => (idField && e.data?.[idField]) || e.record_id || '';

  const [fEmp, setFEmp] = useState('');
  const [fCycle, setFCycle] = useState('2026 Annual');
  const [fReviewer, setFReviewer] = useState('');
  const [fRating, setFRating] = useState(0);
  const [fGoals, setFGoals] = useState('');
  const [fStrengths, setFStrengths] = useState('');
  const [fImprove, setFImprove] = useState('');

  const cycles = useMemo(() => Array.from(new Set(reviews.map(r => r.cycle).filter(Boolean))), [reviews]);
  const filtered = reviews.filter(r => cycleFilter === 'all' || r.cycle === cycleFilter);
  const avgRating = filtered.length ? (filtered.reduce((s, r) => s + Number(r.rating || 0), 0) / filtered.filter(r => r.rating).length).toFixed(1) : '—';

  const addReview = async () => {
    if (!fEmp || !fCycle) return;
    const emp = employees.find(e => e.id === fEmp);
    const { data } = await supabase.from('performance_reviews').insert({
      company_id: companyId, employee_record_id: fEmp,
      employee_name: emp ? empName(emp) : '', employee_code: emp ? empCode(emp) : '',
      cycle: fCycle, reviewer: fReviewer || userEmail, rating: fRating || null,
      goals: fGoals, strengths: fStrengths, improvements: fImprove, status: 'submitted',
    }).select().single();
    if (data) setReviews(p => [data, ...p]);
    setFEmp(''); setFReviewer(''); setFRating(0); setFGoals(''); setFStrengths(''); setFImprove(''); setAddOpen(false);
  };

  const deleteReview = async (id: string) => {
    await supabase.from('performance_reviews').delete().eq('id', id);
    setReviews(p => p.filter(r => r.id !== id));
  };

  const exportReviews = () => {
    const rows = filtered.map(r => ({ Employee: r.employee_name, Code: r.employee_code, Cycle: r.cycle, Reviewer: r.reviewer, Rating: r.rating || '', Goals: r.goals || '', Strengths: r.strengths || '', Improvements: r.improvements || '', Date: r.review_date }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Performance');
    XLSX.writeFile(wb, `performance-reviews.xlsx`);
  };

  const Stars = ({ value, onChange }: { value: number; onChange?: (v: number) => void }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)} disabled={!onChange} className={onChange ? 'cursor-pointer' : 'cursor-default'}>
          <Star size={onChange ? 22 : 14} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Performance</h1>
          <p className="text-sm text-slate-500 mt-0.5">{reviews.length} reviews · avg rating {avgRating}★</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportReviews} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Download size={14} />Export</button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />New Review</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3"><Award size={17} /></div>
          <p className="text-2xl font-bold text-slate-900">{filtered.length}</p>
          <p className="text-xs text-slate-500">Reviews</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3"><Star size={17} /></div>
          <p className="text-2xl font-bold text-slate-900">{avgRating}</p>
          <p className="text-xs text-slate-500">Average rating</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3"><TrendingUp size={17} /></div>
          <p className="text-2xl font-bold text-slate-900">{filtered.filter(r => Number(r.rating) >= 4).length}</p>
          <p className="text-xs text-slate-500">Top performers (4★+)</p>
        </div>
      </div>

      {cycles.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setCycleFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${cycleFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>All</button>
          {cycles.map(c => <button key={c} onClick={() => setCycleFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${cycleFilter === c ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{c}</button>)}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
          <Award size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600 mb-1">No reviews yet</p>
          <p className="text-xs text-slate-400">Create a performance review for an employee to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{r.employee_name}</span>
                    {r.employee_code && <span className="text-xs font-mono text-slate-400">{r.employee_code}</span>}
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{r.cycle}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Reviewed by {r.reviewer || '—'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {r.rating && <Stars value={Number(r.rating)} />}
                  <button onClick={() => deleteReview(r.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><X size={13} /></button>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {r.goals && <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs font-semibold text-slate-400 uppercase mb-1">Goals</p><p className="text-xs text-slate-600">{r.goals}</p></div>}
                {r.strengths && <div className="bg-emerald-50 rounded-xl p-3"><p className="text-xs font-semibold text-emerald-500 uppercase mb-1">Strengths</p><p className="text-xs text-slate-600">{r.strengths}</p></div>}
                {r.improvements && <div className="bg-amber-50 rounded-xl p-3"><p className="text-xs font-semibold text-amber-500 uppercase mb-1">Improvements</p><p className="text-xs text-slate-600">{r.improvements}</p></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">New Performance Review</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Employee</label>
                  <PersonPicker people={employees} fields={empFields} value={fEmp} onChange={setFEmp} placeholder="Search by name or employee ID…" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Cycle</label>
                  <input value={fCycle} onChange={e => setFCycle(e.target.value)} placeholder="e.g. 2026 Annual" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Rating</label>
                <Stars value={fRating} onChange={setFRating} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Reviewer</label>
                <input value={fReviewer} onChange={e => setFReviewer(e.target.value)} placeholder="Manager name" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Goals</label>
                <textarea value={fGoals} onChange={e => setFGoals(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Strengths</label>
                  <textarea value={fStrengths} onChange={e => setFStrengths(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Improvements</label>
                  <textarea value={fImprove} onChange={e => setFImprove(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={addReview} disabled={!fEmp || !fCycle} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Save Review</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
