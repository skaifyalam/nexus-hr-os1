import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import { loadPeopleForPicker } from '@/lib/people';
import { getFeatureAccess } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import VisaClient from './VisaClient';

export const dynamic = 'force-dynamic';

export default async function VisaPage() {
  const supabase = createServerClient();
  const { profile, sections, user } = await getShellData();
  const _access = await getFeatureAccess(profile, 'visa');
  if (_access === 'none') redirect('/dashboard');
  const companyId = profile?.company_id || '';

  const [{ data: blocks }, { data: allocations }, { data: candFields }, { data: agencies }, { data: company }] = await Promise.all([
    supabase.from('visa_blocks').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('visa_allocations').select('*').eq('company_id', companyId),
    supabase.from('section_field_configs').select('*').eq('company_id', companyId).eq('section_key', 'candidate').order('display_order'),
    supabase.from('agencies').select('id, name').eq('company_id', companyId).order('name'),
    supabase.from('company_profile').select('candidate_status_field_key, visa_stage_map').eq('id', companyId).maybeSingle(),
  ]);

  // Detect the candidate status field (stored override, else auto-detect by label)
  const statusFieldKey = company?.candidate_status_field_key
    || (candFields || []).find((f: any) => /status|stage/i.test(f.field_label))?.field_key
    || '';

  // Gather the company's REAL candidate stage values (from field options or actual data)
  let candidateStages: string[] = [];
  if (statusFieldKey) {
    const fieldCfg = (candFields || []).find((f: any) => f.field_key === statusFieldKey);
    if (fieldCfg?.options?.length) candidateStages = fieldCfg.options.map((o: any) => String(o));
    else {
      const set = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('section_records').select('data')
          .eq('company_id', companyId).eq('section_key', 'candidate').range(from, from + 999);
        if (!data || data.length === 0) break;
        data.forEach((r: any) => { const v = r.data?.[statusFieldKey]; if (v) set.add(String(v)); });
        if (data.length < 1000) break;
      }
      candidateStages = Array.from(set).sort();
    }
  }

  // Load candidates + employees for allocation picker (trimmed — fast on large datasets)
  const [{ people: cands }, { people: emps }] = await Promise.all([
    loadPeopleForPicker(companyId, 'candidate'),
    loadPeopleForPicker(companyId, 'employee'),
  ]);
  const people = [...cands, ...emps];

  // ─── Auto-surface "pending for visa" candidates ───
  // A candidate is pending if their pipeline status matches a visa-linked stage (from the map)
  // AND they don't already have an active visa allocation.
  const stageMap = company?.visa_stage_map || {};
  const visaLinkedStatuses = new Set(Object.values(stageMap).filter(Boolean).map((s: any) => String(s)));
  const allocatedPersonIds = new Set((allocations || []).filter((a: any) => a.stage !== 'cancelled').map((a: any) => a.person_record_id));

  let pendingVisa: any[] = [];
  if (statusFieldKey && visaLinkedStatuses.size > 0) {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('section_records').select('id, record_id, data')
        .eq('company_id', companyId).eq('section_key', 'candidate').range(from, from + 999);
      if (!data || data.length === 0) break;
      for (const r of data) {
        const status = r.data?.[statusFieldKey];
        if (status && visaLinkedStatuses.has(String(status)) && !allocatedPersonIds.has(r.id)) {
          pendingVisa.push({ id: r.id, record_id: r.record_id, data: r.data, _status: String(status) });
        }
      }
      if (data.length < 1000) break;
    }
  }

  return (
    <Shell current="/visa" profile={profile} sections={sections} companyId={companyId}>
      <VisaClient initialBlocks={blocks || []} initialAllocations={allocations || []} people={people} candFields={candFields || []} agencies={agencies || []} statusFieldKey={statusFieldKey} candidateStages={candidateStages} initialStageMap={company?.visa_stage_map || {}} pendingVisa={pendingVisa} companyId={companyId} />
    </Shell>
  );
}
