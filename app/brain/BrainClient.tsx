'use client';
import { useState, useRef } from 'react';
import {
  Upload, Brain, Send, Trash2, X, Loader, FileText,
  ChevronDown, ChevronUp, Sparkles, MessageSquare, BookOpen
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const DOC_TYPES = [
  { value: 'policy', label: 'Company Policy' },
  { value: 'labour_law', label: 'Labour Law' },
  { value: 'sop', label: 'Standard Operating Procedure' },
  { value: 'contract', label: 'Contract Template' },
  { value: 'client_requirement', label: 'Client Requirements' },
  { value: 'other', label: 'Other' },
];

export default function BrainClient({ initialDocs, initialConvs, companyId, userEmail }: {
  initialDocs: any[]; initialConvs: any[]; companyId: string; userEmail: string;
}) {
  const [docs, setDocs] = useState(initialDocs);
  const [convs, setConvs] = useState(initialConvs);
  const [tab, setTab] = useState<'upload' | 'ask'>('upload');
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [delConfirm, setDelConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', document_type: 'policy' });
  const [content, setContent] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setContent(e.target?.result as string || '');
    reader.readAsText(file);
    if (!form.title) setForm(f => ({ ...f, title: file.name.replace(/\.[^/.]+$/, '') }));
  };

  const upload = async () => {
    if (!form.title.trim() || !content.trim()) {
      setUploadError('Please provide a title and document content.');
      return;
    }
    setUploadError('');
    setUploading(true);

    try {
      // Call AI to process document
      const res = await fetch('/api/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_document',
          title: form.title,
          doc_type: form.document_type,
          content,
        }),
      });
      const { summary, keyPoints, chunks } = await res.json();

      // Save document to database
      const { data: doc, error } = await supabase.from('brain_documents').insert({
        company_id: companyId,
        title: form.title,
        document_type: form.document_type,
        content: content.slice(0, 50000), // store up to 50k chars
        ai_summary: summary,
        ai_key_points: keyPoints || [],
        uploaded_by: userEmail,
      }).select().single();

      if (error) { setUploadError(error.message); setUploading(false); return; }

      // Save chunks for better retrieval
      if (chunks?.length > 0 && doc) {
        const chunkRows = chunks.map((text: string, i: number) => ({
          document_id: doc.id,
          company_id: companyId,
          chunk_text: text,
          chunk_index: i,
        }));
        await supabase.from('brain_chunks').insert(chunkRows);
      }

      setDocs(p => [doc, ...p]);
      setForm({ title: '', document_type: 'policy' });
      setContent('');
      setTab('ask');
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const ask = async () => {
    if (!question.trim() || asking) return;
    const q = question;
    setQuestion('');
    setAsking(true);

    // Optimistically add the question to chat
    const tempId = `temp-${Date.now()}`;
    setConvs(p => [{ id: tempId, question: q, answer: '...', sources: [], created_at: new Date().toISOString() }, ...p]);

    try {
      const res = await fetch('/api/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ask', question: q, company_id: companyId }),
      });
      const { answer, sources } = await res.json();

      // Save to database
      const { data: conv } = await supabase.from('brain_conversations').insert({
        company_id: companyId,
        question: q,
        answer,
        sources: sources || [],
        asked_by: userEmail,
      }).select().single();

      setConvs(p => p.map(c => c.id === tempId ? (conv || { ...c, answer, sources }) : c));
    } catch {
      setConvs(p => p.map(c => c.id === tempId ? { ...c, answer: 'Sorry, I could not process your question. Please try again.' } : c));
    }
    setAsking(false);
  };

  const deleteDoc = async (id: string) => {
    await supabase.from('brain_documents').delete().eq('id', id);
    setDocs(p => p.filter(d => d.id !== id));
    setDelConfirm(null);
  };

  const SUGGESTED_QUESTIONS = [
    'What is the annual leave entitlement?',
    'What is the notice period for resignation?',
    'What are the overtime rules?',
    'What disciplinary actions are allowed?',
    'What is the probation period policy?',
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Company Brain</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload your policies, SOPs, and labour law — AI reads and learns from them
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          {[
            { key: 'upload', label: 'Documents', icon: BookOpen },
            { key: 'ask', label: 'Ask AI', icon: MessageSquare },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
              <t.icon size={14} />{t.label}
              {t.key === 'upload' && docs.length > 0 && (
                <span className="ml-1 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{docs.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'upload' && (
        <div className="grid grid-cols-3 gap-4">
          {/* Upload panel */}
          <div className="col-span-1 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Upload Document</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Title</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. HR Policy Manual 2026"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Document Type</label>
                  <select value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">File</label>
                  <div onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                    <Upload size={18} className="text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs text-slate-400">Click to upload PDF, DOCX, TXT</p>
                    <input ref={fileRef} type="file" accept=".txt,.pdf,.docx,.doc,.md" className="hidden"
                      onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Or paste text directly</label>
                  <textarea value={content} onChange={e => setContent(e.target.value)} rows={5}
                    placeholder="Paste document content here…"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
                {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
                <button onClick={upload} disabled={uploading || !form.title || !content}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {uploading ? <><Loader size={14} className="animate-spin" />AI is learning…</> : <><Sparkles size={14} />Upload & Learn</>}
                </button>
                {uploading && (
                  <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}</div>
                    <span className="text-xs text-indigo-700">AI is reading and extracting key information…</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Documents list */}
          <div className="col-span-2 space-y-3">
            {docs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
                <Brain size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">No documents uploaded yet</p>
                <p className="text-xs text-slate-400 mt-1">Upload your HR policies, labour law, or SOPs and AI will learn from them</p>
              </div>
            ) : docs.map(doc => (
              <div key={doc.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-start justify-between p-5">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText size={15} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{doc.title}</p>
                      <p className="text-xs text-slate-400 capitalize mt-0.5">
                        {doc.document_type?.replace('_', ' ')} · Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                      {doc.ai_summary && (
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-2">{doc.ai_summary}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <button onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                      {expandedDoc === doc.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={() => setDelConfirm(doc.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {expandedDoc === doc.id && (
                  <div className="px-5 pb-5 border-t border-slate-50 pt-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">What AI Learned</p>
                    <div className="space-y-2">
                      {(doc.ai_key_points || []).map((point: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                          <p className="text-xs text-slate-600">{point}</p>
                        </div>
                      ))}
                    </div>
                    {doc.ai_summary && (
                      <div className="mt-4 p-3 bg-slate-50 rounded-xl">
                        <p className="text-xs font-medium text-slate-500 mb-1">Full Summary</p>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{doc.ai_summary}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'ask' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-4">
            {/* Chat history */}
            <div className="space-y-4">
              {convs.length === 0 && !asking && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
                  <Brain size={32} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-500">Ask anything about your company documents</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {docs.length === 0 ? 'Upload documents first from the Documents tab' : `${docs.length} document${docs.length !== 1 ? 's' : ''} loaded — ready to answer questions`}
                  </p>
                </div>
              )}
              {[...convs].reverse().map(conv => (
                <div key={conv.id} className="space-y-3">
                  <div className="flex justify-end">
                    <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-lg text-sm">
                      {conv.question}
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 max-w-lg">
                      {conv.answer === '...' ? (
                        <div className="flex gap-1.5 py-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}</div>
                      ) : (
                        <>
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{conv.answer}</p>
                          {conv.sources?.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-100">
                              <p className="text-xs text-slate-400">Sources: {conv.sources.join(', ')}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex gap-3">
                <textarea value={question} onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
                  placeholder="Ask anything about your policies, labour law, or SOPs…"
                  rows={2}
                  className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                <button onClick={ask} disabled={asking || !question.trim() || docs.length === 0}
                  className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 self-end transition-colors">
                  {asking ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              {docs.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">⚠️ Upload documents first before asking questions</p>
              )}
            </div>
          </div>

          {/* Suggested questions + doc list */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Suggested Questions</h3>
              <div className="space-y-2">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button key={q} onClick={() => setQuestion(q)}
                    className="w-full text-left text-xs p-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-xl transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Loaded Documents</h3>
              {docs.length === 0 ? (
                <p className="text-xs text-slate-400">No documents yet</p>
              ) : (
                <div className="space-y-2">
                  {docs.map(d => (
                    <div key={d.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                      <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText size={11} className="text-indigo-600" />
                      </div>
                      <p className="text-xs text-slate-700 truncate">{d.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDelConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Remove Document</h2>
            <p className="text-sm text-slate-600 mb-6">AI will no longer be able to answer questions from this document. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelConfirm(null)} className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={() => deleteDoc(delConfirm)} className="px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-xl">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
