import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import AnalyticsClient from './AnalyticsClient';

export default async function AnalyticsPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  const companyId = profile?.company_id || '';

  // Pull all stage history for the company
  let history: any[] = [];
  const CHUNK = 1000;
  for (let from = 0; ; from += CHUNK) {
    const { data } = await supabase.from('stage_history').select('*')
      .eq('company_id', companyId).order('change_date', { ascending: true })
      .range(from, from + CHUNK - 1);
    if (!data || data.length === 0) break;
    history = history.concat(data);
    if (data.length < CHUNK) break;
  }

  // Compute average days between consecutive stages, per record
  const byRecord: Record<string, any[]> = {};
  history.forEach(h => {
    (byRecord[h.record_pk] = byRecord[h.record_pk] || []).push(h);
  });

  const transitionDays: Record<string, number[]> = {}; // "From → To" : [days...]
  const stageDwell: Record<string, number[]> = {};      // time spent IN a stage before moving on
  const stuckNow: any[] = [];
  const today = new Date();

  Object.values(byRecord).forEach(events => {
    events.sort((a, b) => new Date(a.change_date).getTime() - new Date(b.change_date).getTime());
    for (let i = 1; i < events.length; i++) {
      const prev = events[i - 1], cur = events[i];
      const days = Math.round((new Date(cur.change_date).getTime() - new Date(prev.change_date).getTime()) / 86400000);
      if (days >= 0) {
        const key = `${prev.to_status} → ${cur.to_status}`;
        (transitionDays[key] = transitionDays[key] || []).push(days);
        (stageDwell[prev.to_status] = stageDwell[prev.to_status] || []).push(days);
      }
    }
    // Current stage dwell (last event to today)
    const last = events[events.length - 1];
    if (last) {
      const days = Math.round((today.getTime() - new Date(last.change_date).getTime()) / 86400000);
      stuckNow.push({ record_id: last.record_id, status: last.to_status, days, since: last.change_date });
    }
  });

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;

  const transitions = Object.entries(transitionDays)
    .map(([label, days]) => ({ label, avgDays: avg(days), count: days.length }))
    .sort((a, b) => b.avgDays - a.avgDays);

  const dwellByStage = Object.entries(stageDwell)
    .map(([label, days]) => ({ label, avgDays: avg(days), count: days.length }))
    .sort((a, b) => b.avgDays - a.avgDays);

  const longestStuck = stuckNow.sort((a, b) => b.days - a.days).slice(0, 15);

  return (
    <Shell current="/analytics" profile={profile} sections={sections} companyId={companyId}>
      <AnalyticsClient
        transitions={transitions}
        dwellByStage={dwellByStage}
        longestStuck={longestStuck}
        totalChanges={history.length}
      />
    </Shell>
  );
}
