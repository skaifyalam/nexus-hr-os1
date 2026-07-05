import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import ComplianceClient from './ComplianceClient';

async function fetchAllRecords(supabase: any, companyId: string, sectionKey: string) {
  let all: any[] = [];
  const CHUNK = 1000;
  for (let from = 0; ; from += CHUNK) {
    const { data } = await supabase.from('section_records').select('data')
      .eq('company_id', companyId).eq('section_key', sectionKey)
      .range(from, from + CHUNK - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < CHUNK) break;
  }
  return all;
}

export default async function CompliancePage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  const _access = await getFeatureAccess(profile, 'compliance');
  if (_access === 'none') redirect('/dashboard');
  const companyId = profile?.company_id || '';

  const [{ data: rules }, { data: allFields }] = await Promise.all([
    supabase.from('localization_rules').select('*').eq('company_id', companyId).order('created_at'),
    supabase.from('section_field_configs').select('*').eq('company_id', companyId).order('display_order'),
  ]);

  // Compute stats per rule server-side
  const sectionCache: Record<string, any[]> = {};
  const stats: Record<string, any> = {};

  for (const rule of rules || []) {
    if (!sectionCache[rule.section_key]) {
      sectionCache[rule.section_key] = await fetchAllRecords(supabase, companyId, rule.section_key);
    }
    const records = sectionCache[rule.section_key];
    const localVals = (rule.local_values || []).map((v: string) => String(v).trim().toLowerCase());

    const total = records.length;
    const locals = records.filter(r => {
      const nat = String(r.data?.[rule.nationality_field_key] ?? '').trim().toLowerCase();
      return localVals.includes(nat);
    });
    const localCount = locals.length;
    const currentPct = total > 0 ? (localCount / total) * 100 : 0;
    const p = Number(rule.target_pct) / 100;

    // How many locals to hire (keeping others constant) to reach target:
    // (L + x) / (T + x) >= p  →  x >= (p*T - L) / (1 - p)
    let hiresNeeded = 0;
    if (p > 0 && p < 1 && currentPct / 100 < p) {
      hiresNeeded = Math.ceil((p * total - localCount) / (1 - p));
    }
    // Max non-local hires while staying compliant: L/(T+y) >= p → y <= L/p - T
    let nonLocalHeadroom = 0;
    if (p > 0 && currentPct / 100 >= p) {
      nonLocalHeadroom = Math.max(0, Math.floor(localCount / p - total));
    }

    // Profession breakdown among locals (Iqama profession tracking)
    let professions: { label: string; count: number }[] = [];
    if (rule.profession_field_key) {
      const groups: Record<string, number> = {};
      locals.forEach(r => {
        const prof = String(r.data?.[rule.profession_field_key] ?? 'Unknown') || 'Unknown';
        groups[prof] = (groups[prof] || 0) + 1;
      });
      professions = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([label, count]) => ({ label, count }));
    }

    stats[rule.id] = { total, localCount, currentPct, hiresNeeded, nonLocalHeadroom, professions };
  }

  return (
    <Shell current="/compliance" profile={profile} sections={sections} companyId={companyId}>
      <ComplianceClient
        initialRules={rules || []}
        stats={stats}
        sections={sections || []}
        allFields={allFields || []}
        companyId={companyId}
      />
    </Shell>
  );
}
