'use client';
import { useState, useMemo } from 'react';
import { Check, X, Clock, CheckCircle2, XCircle, GitBranch, ChevronRight } from 'lucide-react';
import { decideApproval } from '@/lib/approvals';

export default function ApprovalsInbox({ initialRequests, workflows, myRoleId, isSuper, myName }: {
  initialRequests: any[]; workflows: any[]; myRoleId: string | null; isSuper: boolean; myName: string;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [tab, setTab] = useState<'inbox' | 'all'>('inbox');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const stepsOf = (wfId: string) => workflows.find(w => w.id === wfId)?.steps || [];

  // The role that must act on a request right now
  const currentRoleId = (r: any) => {
    const steps = stepsOf(r.workflow_id);
    return steps[r.current_step]?.role_id || null;
  };
  const currentRoleName = (r: any) => {
    const steps = stepsOf(r.workflow_id);
    return steps[r.current_step]?.role_name || '';
  };

  // Requests awaiting MY action (my role is the current step), still pending
  const myInbox = useMemo(() =>
    requests.filter(r => r.status === 'pending' && (isSuper || currentRoleId(r) === myRoleId)),
  [requests, myRoleId, isSuper]);

  const shown = tab === 'inbox' ? myInbox : requests;

  const decide = async (r: any, decision: 'approved' | 'rejected') => {
    setBusy(r.id);
    const updated = await decideApproval({ request: r, decision, deciderName: myName, note: note || '' });
    if (updated) setRequests(p => p.map(x => x.id === r.id ? updated : x));
    setBusy(null); setNoteFor(null); setNote('');
  };

  const statusBadge = (s: string) =>
    s === 'approved' ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full"><CheckCircle2 size={11} />Approved</span>
    : s === 'rejected' ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full"><XCircle size={11} />Rejected</span>
    : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full"><Clock size={11} />Pending</span>;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
        <p className="text-sm text-slate-500 mt-0.5">Requests routed to you and their progress through the chain</p>
      </div>

      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('inbox')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'inbox' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
          My Inbox{myInbox.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">{myInbox.length}</span>}
        </button>
        <button onClick={() => setTab('all')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>All Requests</button>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
          <GitBranch size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600 mb-1">{tab === 'inbox' ? 'Nothing awaiting your approval' : 'No approval requests yet'}</p>
          <p className="text-xs text-slate-400">{tab === 'inbox' ? "You're all caught up." : 'Requests appear here once processes with workflows are submitted.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(r => {
            const steps = stepsOf(r.workflow_id);
            const canAct = r.status === 'pending' && (isSuper || currentRoleId(r) === myRoleId);
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{r.title || r.process_key}</p>
                    <p className="text-xs text-slate-400">Requested by {r.requested_by} · {new Date(r.created_at).toLocaleDateString('en-GB')}</p>
                  </div>
                  {statusBadge(r.status)}
                </div>

                {/* Chain progress */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  {steps.map((s: any, i: number) => {
                    const done = r.status === 'approved' || i < r.current_step;
                    const active = r.status === 'pending' && i === r.current_step;
                    return (
                      <div key={i} className="flex items-center gap-1.5">
                        {i > 0 && <ChevronRight size={12} className="text-slate-300" />}
                        <span className={`text-xs px-2 py-0.5 rounded-lg ${done ? 'bg-emerald-50 text-emerald-600' : active ? 'bg-amber-100 text-amber-700 font-medium' : 'bg-slate-100 text-slate-400'}`}>
                          {done && '✓ '}{s.role_name}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* History */}
                {(r.history || []).length > 0 && (
                  <div className="text-xs text-slate-400 space-y-0.5 mb-3">
                    {r.history.map((h: any, i: number) => (
                      <p key={i}>{h.decision === 'approved' ? '✓' : '✗'} {h.role_name} — {h.decided_by}{h.note ? ` · "${h.note}"` : ''}</p>
                    ))}
                  </div>
                )}

                {canAct && (
                  <div>
                    {noteFor === r.id && (
                      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note…" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    )}
                    <div className="flex items-center gap-2">
                      <button onClick={() => decide(r, 'approved')} disabled={busy === r.id} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"><Check size={13} />Approve</button>
                      <button onClick={() => decide(r, 'rejected')} disabled={busy === r.id} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"><X size={13} />Reject</button>
                      <button onClick={() => setNoteFor(noteFor === r.id ? null : r.id)} className="text-xs text-slate-400 hover:text-slate-600 ml-1">{noteFor === r.id ? 'Hide note' : 'Add note'}</button>
                      <span className="text-xs text-slate-400 ml-auto">Your step: {currentRoleName(r)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
