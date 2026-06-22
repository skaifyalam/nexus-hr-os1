'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Check, Clock, Send, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { STAGES, STAGE_LABELS, DOCUMENT_TYPES } from '@/lib/stages';

export default function CandidateProfileClient({
  candidate, documents, history, messages, profile,
}: { candidate: any; documents: any[]; history: any[]; messages: any[]; profile: any }) {
  const [docs, setDocs] = useState(documents);
  const [msgs, setMsgs] = useState(messages);
  const [newMsg, setNewMsg] = useState('');
  const [stage, setStage] = useState(candidate.stage);
  const supabase = createClient();

  const backLink = profile?.role === 'agency_user' ? '/agency' : '/recruitment';

  const toggleDoc = async (docType: string) => {
    const existing = docs.find((d) => d.document_type === docType);
    if (existing) {
      const { data } = await supabase.from('candidate_documents').update({ verified: !existing.verified }).eq('id', existing.id).select().single();
      if (data) setDocs((p) => p.map((d) => (d.id === data.id ? data : d)));
    } else {
      const { data } = await supabase.from('candidate_documents').insert({ candidate_id: candidate.id, document_type: docType, verified: true }).select().single();
      if (data) setDocs((p) => [...p, data]);
    }
  };

  const updateStage = async (newStage: string) => {
    setStage(newStage);
    await supabase.from('candidates').update({ stage: newStage }).eq('id', candidate.id);
  };

  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    const { data } = await supabase.from('candidate_messages').insert({
      candidate_id: candidate.id,
      sender_name: profile?.full_name || profile?.email,
      sender_role: profile?.role,
      message: newMsg,
    }).select().single();
    if (data) { setMsgs((p) => [...p, data]); setNewMsg(''); }
  };

  const isDocVerified = (docType: string) => docs.find((d) => d.document_type === docType)?.verified;

  return (
    <div>
      <Link href={backLink} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-5 transition-colors w-fit">
        <ChevronRight size={14} className="rotate-180" /> Back to Pipeline
      </Link>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-2xl flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4">
            {candidate.first_name?.[0]}
          </div>
          <h2 className="text-lg font-bold text-slate-900">{candidate.first_name} {candidate.last_name}</h2>
          <p className="text-sm text-slate-500">{candidate.requisitions?.position || 'No requisition linked'}</p>
          <p className="text-xs text-slate-400">{candidate.candidate_id}</p>

          <div className="mt-4 space-y-2 text-left border-t border-slate-100 pt-4 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Nationality</span><span className="text-slate-700 font-medium">{candidate.nationality}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Passport</span><span className="text-slate-700 font-medium">{candidate.passport_number || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Country</span><span className="text-slate-700 font-medium">{candidate.operations?.name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Agency</span><span className="text-slate-700 font-medium">{candidate.agencies?.name || 'Unassigned'}</span></div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 text-left">
            <label className="text-xs font-medium text-slate-700 block mb-1.5">Current Stage</label>
            <select value={stage} onChange={(e) => updateStage(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        <div className="col-span-2 space-y-4">
          {/* Document checklist */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><FileText size={14} /> Document Checklist</h3>
            <div className="grid grid-cols-2 gap-2">
              {DOCUMENT_TYPES.map((docType) => {
                const verified = isDocVerified(docType);
                return (
                  <button key={docType} onClick={() => toggleDoc(docType)} className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm transition-colors text-left ${verified ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    <div className={`w-5 h-5 rounded-lg flex-shrink-0 flex items-center justify-center ${verified ? 'bg-emerald-500 text-white' : 'bg-slate-200'}`}><Check size={11} /></div>
                    {docType}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stage history */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Mobilization History</h3>
            {history.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No history yet</p>
            ) : (
              <div className="space-y-0">
                {history.map((h, i) => (
                  <div key={h.id} className="flex gap-4 pb-4 relative">
                    {i !== history.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-100" />}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${h.completed_at ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {h.completed_at ? <Check size={13} /> : <Clock size={13} />}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <span className="text-sm font-semibold text-slate-900">{STAGE_LABELS[h.stage] || h.stage}</span>
                      <p className="text-xs text-slate-400">
                        {new Date(h.started_at).toLocaleDateString()} {h.completed_at ? `→ ${new Date(h.completed_at).toLocaleDateString()}` : '→ In Progress'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Communication log */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Agency ↔ Company HR Communication</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto mb-3">
              {msgs.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No messages yet</p>}
              {msgs.map((m) => (
                <div key={m.id} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700">{m.sender_name} <span className="text-slate-400 font-normal capitalize">({(m.sender_role || '').replace('_', ' ')})</span></span>
                    <span className="text-xs text-slate-400">{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-600">{m.message}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Write a note for the other side…" className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={sendMessage} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"><Send size={14} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
