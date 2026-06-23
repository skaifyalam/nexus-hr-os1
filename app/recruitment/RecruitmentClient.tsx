'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { Plus, X, Search, Upload, Loader, Sparkles, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { STAGES, STAGE_LABELS } from '@/lib/stages';
import { generateId } from '@/lib/generateId';

const CANDIDATE_FIELDS = ['first_name','last_name','nationality','passport_number','phone','email'];

export default function RecruitmentClient({
  initialCandidates, requisitions, operations, agencies,
}: { initialCandidates: any[]; requisitions: any[]; operations: any[]; agencies: any[] }) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [opFilter, setOpFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mappingLoad, setMappingLoad] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReqId, setImportReqId] = useState('');
  const [importAgencyId, setImportAgencyId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const blank = { first_name:'', last_name:'', nationality:'', passport_number:'', requisition_id:'', agency_id:'', operation_id: operations[0]?.id||'' };
  const [form, setForm] = useState<any>(blank);

  const filtered = candidates.filter((c) => {
    const matchSearch = !search || `${c.first_name} ${c.last_name} ${c.passport_number} ${c.nationality}`.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || c.stage === stageFilter;
    const matchOp = opFilter === 'all' || c.operation_id === opFilter;
    return matchSearch && matchStage && matchOp;
  });

  const move = async (id: string, dir: number) => {
    const c = candidates.find((x) => x.id === id);
    const i = STAGES.indexOf(c.stage);
    const newStage = STAGES[Math.max(0, Math.min(STAGES.length - 1, i + dir))];
    const { data } = await supabase.from('candidates').update({ stage: newStage }).eq('id', id)
      .select('*, requisitions(position, requisition_id), operations(name, country_code), agencies(name)').single();
    if (data) setCandidates((p) => p.map((x) => (x.id === id ? data : x)));
  };

  const save = async () => {
    const req = requisitions.find((r) => r.id === form.requisition_id);
    const opCountryCode = operations.find((o) => o.id === (req?.operation_id || form.operation_id))?.country_code || '';
    const newId = await generateId('candidate', opCountryCode);
    const { data } = await supabase.from('candidates').insert({
      ...form,
      candidate_id: newId,
      operation_id: req?.operation_id || form.operation_id,
      agency_id: form.agency_id || null,
    }).select('*, requisitions(position, requisition_id), operations(name, country_code), agencies(name)').single();
    if (data) { setCandidates((p) => [data, ...p]); setAddOpen(false); setForm(blank); }
  };

  // ─── BULK IMPORT ──────────────────────────────────────────
  const handleFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'binary' });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      if (!rows.length) return;
      setImportRows(rows);
      setImportOpen(true);
      setMappingLoad(true);
      const headers = Object.keys(rows[0]);
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Map these Excel column headers to candidate database fields. Headers: ${JSON.stringify(headers)}. Target fields: ${JSON.stringify(CANDIDATE_FIELDS)}. Return ONLY a JSON object like {"Excel Header":"field_name"} or "ignore" if no match. Raw JSON only, no markdown.`,
          }),
        });
        const d = await res.json();
        const cleaned = d.text.replace(/```json|```/g, '').trim();
        setMapping(JSON.parse(cleaned));
      } catch {
        const auto: Record<string, string> = {};
        headers.forEach((h) => {
          const match = CANDIDATE_FIELDS.find((f) => f.replace('_','') === h.toLowerCase().replace(/[\s_]/g,''));
          auto[h] = match || 'ignore';
        });
        setMapping(auto);
      }
      setMappingLoad(false);
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = async () => {
    setImporting(true);
    const req = requisitions.find((r) => r.id === importReqId);
    const opId = req?.operation_id || operations[0]?.id;
    const countryCode = operations.find((o) => o.id === opId)?.country_code || '';

    const records = await Promise.all(
      importRows.map(async (row) => {
        const rec: any = {
          stage: 'selection',
          operation_id: opId,
          requisition_id: importReqId || null,
          agency_id: importAgencyId || null,
          candidate_id: await generateId('candidate', countryCode),
        };
        Object.entries(mapping).forEach(([h, f]) => {
          if (f && f !== 'ignore' && row[h] !== undefined) rec[f] = row[h];
        });
        return rec;
      })
    );

    const valid = records.filter((r) => r.first_name);
    const { data } = await supabase.from('candidates').insert(valid)
      .select('*, requisitions(position, requisition_id), operations(name, country_code), agencies(name)');
    if (data) setCandidates((p) => [...data, ...p]);
    setImporting(false);
    setImportOpen(false);
    setImportRows([]);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ first_name:'Ahmed', last_name:'Al-Rashid', nationality:'Saudi', passport_number:'P1234567', phone:'+966501234567', email:'ahmed@example.com' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
    XLSX.writeFile(wb, 'nexus-candidate-template.xlsx');
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recruitment Pipeline</h1>
          <p className="text-sm text-slate-500 mt-0.5">{candidates.length} candidates · {STAGES.length} mobilization stages</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Template</button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">
            <Upload size={14} /> Bulk Import
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <button onClick={() => { setForm({ ...blank, operation_id: operations[0]?.id||'' }); setAddOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
            <Plus size={14} /> Add Candidate
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, passport, nationality…" className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="all">All Stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        {operations.length > 1 && (
          <select value={opFilter} onChange={(e) => setOpFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Countries</option>
            {operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        {(search || stageFilter !== 'all' || opFilter !== 'all') && (
          <p className="text-sm text-slate-500 self-center">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const cols = filtered.filter((c) => c.stage === stage);
          return (
            <div key={stage} className="flex-shrink-0 w-52">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-slate-600">{STAGE_LABELS[stage]}</span>
                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{cols.length}</span>
              </div>
              <div className="space-y-2 min-h-16">
                {cols.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow">
                    <Link href={`/candidates/${c.id}`} className="block">
                      <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-600 mb-2">{c.first_name?.[0]}</div>
                      <p className="text-xs font-semibold text-slate-800">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-slate-400">{c.nationality}</p>
                      <p className="text-xs text-slate-500 mt-1 truncate">{c.requisitions?.position || '—'}</p>
                      {c.operations?.country_code && <span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-medium mt-1 inline-block">{c.operations.country_code}</span>}
                    </Link>
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => move(c.id, -1)} className="flex-1 text-xs bg-slate-50 hover:bg-slate-100 rounded-lg py-1">←</button>
                      <button onClick={() => move(c.id, 1)} className="flex-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg py-1">→</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Add Candidate</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[['first_name','First Name'],['last_name','Last Name'],['nationality','Nationality'],['passport_number','Passport No.']].map(([k,l]) => (
                  <div key={k} className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">{l}</label>
                    <input value={form[k]} onChange={(e) => setForm({...form,[k]:e.target.value})} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Requisition</label>
                <select value={form.requisition_id} onChange={(e) => setForm({...form,requisition_id:e.target.value})} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select…</option>
                  {requisitions.map((r) => <option key={r.id} value={r.id}>{r.requisition_id} — {r.position}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Agency (optional)</label>
                <select value={form.agency_id} onChange={(e) => setForm({...form,agency_id:e.target.value})} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Not assigned</option>
                  {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={save} disabled={!form.first_name||!form.requisition_id} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">Add Candidate</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setImportOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Import {importRows.length} Candidates</h2>
              <button onClick={() => setImportOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Link to Requisition</label>
                  <select value={importReqId} onChange={(e) => setImportReqId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">No requisition</option>
                    {requisitions.map((r) => <option key={r.id} value={r.id}>{r.requisition_id} — {r.position}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Assign to Agency (optional)</label>
                  <select value={importAgencyId} onChange={(e) => setImportAgencyId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Not assigned</option>
                    {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              {mappingLoad ? (
                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <Loader size={15} className="animate-spin text-indigo-500" />
                  <span className="text-sm text-indigo-700">AI is mapping your column headers…</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5"><Sparkles size={12} className="text-indigo-500" />AI suggested this mapping — review before importing</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(mapping).map(([header, field]) => (
                      <div key={header} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
                        <span className="text-xs font-medium text-slate-700 w-40 truncate">{header}</span>
                        <span className="text-slate-300 text-sm">→</span>
                        <select value={field} onChange={(e) => setMapping({...mapping,[header]:e.target.value})} className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                          <option value="ignore">Ignore</option>
                          {CANDIDATE_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">All candidates will be imported at the <strong>Selection</strong> stage. You can move them forward in the pipeline after import.</p>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setImportOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={confirmImport} disabled={mappingLoad || importing} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                {importing ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
                Import {importRows.length} Candidates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
