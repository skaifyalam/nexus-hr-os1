'use client';
import { Clock, TrendingUp, AlertTriangle, Timer } from 'lucide-react';

export default function AnalyticsClient({ transitions, dwellByStage, longestStuck, totalChanges }: {
  transitions: any[]; dwellByStage: any[]; longestStuck: any[]; totalChanges: number;
}) {
  const maxDwell = Math.max(...dwellByStage.map(d => d.avgDays), 1);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Delay Analysis</h1>
        <p className="text-sm text-slate-500 mt-0.5">Where your pipeline loses time — computed from {totalChanges.toLocaleString()} stage changes</p>
      </div>

      {totalChanges === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
          <Clock size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600 mb-1">No stage history yet</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">As you change candidate statuses (with dates), this screen automatically builds delay insights — average days per stage, bottlenecks, and who's stuck longest.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Average days per stage */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Timer size={16} className="text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">Average Days Spent In Each Stage</h3>
            </div>
            <div className="space-y-2.5">
              {dwellByStage.slice(0, 15).map((d, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{d.label}</span>
                    <span className="text-slate-400"><span className="font-semibold text-slate-700">{d.avgDays}</span> days avg · {d.count} moves</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${d.avgDays > maxDwell * 0.66 ? 'bg-red-400' : d.avgDays > maxDwell * 0.33 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${(d.avgDays / maxDwell) * 100}%` }} />
                  </div>
                </div>
              ))}
              {dwellByStage.length === 0 && <p className="text-xs text-slate-400">Not enough data yet — need candidates moving through multiple stages.</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Slowest transitions */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-800">Slowest Transitions</h3>
              </div>
              <div className="space-y-2">
                {transitions.slice(0, 10).map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-xs text-slate-600 truncate flex-1">{t.label}</span>
                    <span className="text-xs font-semibold text-slate-700 ml-2">{t.avgDays}d</span>
                  </div>
                ))}
                {transitions.length === 0 && <p className="text-xs text-slate-400">No transitions recorded yet.</p>}
              </div>
            </div>

            {/* Longest stuck now */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-red-500" />
                <h3 className="text-sm font-semibold text-slate-800">Stuck Longest (current)</h3>
              </div>
              <div className="space-y-2">
                {longestStuck.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-slate-500 truncate">{s.record_id || '—'}</p>
                      <p className="text-xs text-slate-400 truncate">{s.status}</p>
                    </div>
                    <span className={`text-xs font-semibold ml-2 ${s.days > 30 ? 'text-red-500' : s.days > 14 ? 'text-amber-500' : 'text-slate-600'}`}>{s.days}d</span>
                  </div>
                ))}
                {longestStuck.length === 0 && <p className="text-xs text-slate-400">No data yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
