import { createClient } from './supabase/client';

// Create an approval instance for a submitted request, if a workflow exists for the process.
// Returns the created approval_request row, or null if no workflow (auto-approved).
export async function startApproval(opts: {
  companyId: string; processKey: string; sourceId: string; title: string; requestedBy: string;
}): Promise<any | null> {
  const supabase = createClient();
  const { data: wf } = await supabase.from('approval_workflows')
    .select('*').eq('company_id', opts.companyId).eq('process_key', opts.processKey).eq('active', true)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!wf || !(wf.steps || []).length) return null; // no workflow → nothing to route

  const { data } = await supabase.from('approval_requests').insert({
    company_id: opts.companyId, workflow_id: wf.id, process_key: opts.processKey,
    source_id: opts.sourceId, title: opts.title, requested_by: opts.requestedBy,
    current_step: 0, status: 'pending', history: [],
  }).select().single();
  return data;
}

// Approve or reject the current step. Advances to next step, or finalizes.
export async function decideApproval(opts: {
  request: any; decision: 'approved' | 'rejected'; deciderName: string; note?: string;
}): Promise<any> {
  const supabase = createClient();
  const { request, decision, deciderName, note } = opts;
  const { data: wf } = await supabase.from('approval_workflows').select('steps').eq('id', request.workflow_id).maybeSingle();
  const steps = wf?.steps || [];
  const stepMeta = steps[request.current_step] || {};

  const historyEntry = {
    step: request.current_step, role_name: stepMeta.role_name || '',
    decided_by: deciderName, decision, note: note || '', at: new Date().toISOString(),
  };
  const newHistory = [...(request.history || []), historyEntry];

  let update: any;
  if (decision === 'rejected') {
    update = { status: 'rejected', history: newHistory };
  } else if (request.current_step + 1 >= steps.length) {
    update = { status: 'approved', history: newHistory }; // final step approved
  } else {
    update = { current_step: request.current_step + 1, history: newHistory }; // advance
  }

  const { data } = await supabase.from('approval_requests').update(update).eq('id', request.id).select().single();

  // Sync the source record's status when finalized
  if (update.status === 'approved' || update.status === 'rejected') {
    if (request.process_key === 'leave') {
      await supabase.from('leave_requests').update({ status: update.status, decided_by: deciderName }).eq('id', request.source_id);
    } else if (request.process_key === 'conduct') {
      await supabase.from('conduct_records').update({ status: update.status }).eq('id', request.source_id);
    } else if (request.process_key === 'exit') {
      await supabase.from('exit_records').update({ status: update.status }).eq('id', request.source_id);
    } else if (request.process_key === 'grievance') {
      await supabase.from('grievances').update({ status: update.status === 'approved' ? 'in_review' : 'closed' }).eq('id', request.source_id);
    }
  }
  return data;
}
