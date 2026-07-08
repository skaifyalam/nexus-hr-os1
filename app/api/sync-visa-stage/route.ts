import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Reverse sync: a candidate's pipeline status changed → if that status is mapped
// to a visa stage, advance their visa allocation to match.
export async function POST(req: Request) {
  try {
    const { personRecordId, newStatus } = await req.json();
    if (!personRecordId || !newStatus) return NextResponse.json({ synced: false });

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ synced: false });

    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
    const companyId = profile?.company_id;
    if (!companyId) return NextResponse.json({ synced: false });

    // Get the company's visa stage map
    const { data: company } = await supabase.from('company_profile')
      .select('visa_stage_map').eq('id', companyId).maybeSingle();
    const map = company?.visa_stage_map || {};

    // Which visa stage does this pipeline status map to? (reverse lookup)
    const visaStage = Object.keys(map).find(vs => map[vs] === newStatus);
    if (!visaStage) return NextResponse.json({ synced: false }); // not a mapped status

    // Find this person's active visa allocation
    const { data: allocs } = await supabase.from('visa_allocations')
      .select('*').eq('company_id', companyId).eq('person_record_id', personRecordId)
      .not('stage', 'in', '("cancelled","missed")');
    if (!allocs || allocs.length === 0) return NextResponse.json({ synced: false, reason: 'no_allocation' });

    // Advance the allocation to the mapped visa stage (with date stamps)
    const today = new Date().toISOString().split('T')[0];
    const alloc = allocs[0];
    const upd: any = { stage: visaStage };
    if (visaStage === 'ewakala_issued') upd.ewakala_issued_date = today;
    if (visaStage === 'passport_submitted') upd.passport_submitted_date = today;
    if (visaStage === 'stamped') { upd.stamped_date = today; upd.status = 'used'; }
    await supabase.from('visa_allocations').update(upd).eq('id', alloc.id);

    return NextResponse.json({ synced: true, visaStage });
  } catch (err: any) {
    return NextResponse.json({ synced: false, error: err.message });
  }
}
