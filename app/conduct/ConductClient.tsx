'use client';
import { useState, useMemo } from 'react';
import { Plus, X, AlertTriangle, LogOut, Download, ShieldAlert, CheckCircle2, XCircle, Clock, Upload, Loader, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import PersonPicker from '@/components/PersonPicker';
import { startApproval } from '@/lib/approvals';
import { createClient } from '@/lib/supabase/client';

const SEV = { low: 'bg-slate-100 text-slate-600', medium: 'bg-amber-100 text-amber-700', high: 'bg-red-100 text-red-700' } as any;
const statusBadge = (s: string) =>
  s === 'approved' || s === 'completed' || s === 'closed' ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full"><CheckCircle2 size={11} />{s}</span>
  : s === 'rejected' ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full"><XCircle size={11} />rejected</span>
  : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full"><Clock size={11} />{s.replace('_', ' ')}</span>;

export default function ConductClient({ initialConduct, initialExits, initialRemobs = [], candFields = [], candSectionId = '', employees, empFields, activeConfig, companyId, userEmail }: {
  initialConduct: any[]; initialExits: any[]; initialRemobs?: any[]; candFields?: any[]; candSectionId?: string; employees: any[]; empFields: any[]; activeConfig?: any; companyId: string; userEmail: string;
}) {
  const [tab, setTab] = useState<'conduct' | 'exit' | 'remob'>('conduct');
  const [conduct, setConduct] = useState(initialConduct);
  const [exits, setExits] = useState(initialExits);
  const [remobs, setRemobs] = useState(initialRemobs);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const supabase = createClient();
  const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

  // Mark an employee inactive by setting their active field to a non-active value
  const markEmployeeInactive = async (personRecordId: string) => {
    if (!activeConfig?.active_field_key || !personRecordId) return;
    // Fetch the FULL record (the picker's copy is trimmed — using it would lose fields).
    const { data: full } = await supabase.from('section_records').select('data').eq('id', personRecordId).single();
    if (!full) return;
    const newData = { ...(full.data || {}), [activeConfig.active_field_key]: 'Inactive' };
    await supabase.from('section_records').update({ data: newData }).eq('id', personRecordId);
  };

  const nameField = useMemo(() => empFields.find(f => /name/i.test(f.field_label))?.field_key, [empFields]);
  const idField = useMemo(() => empFields.find(f => f.is_id_field)?.field_key, [empFields]);
  const pName = (p: any) => (nameField && p.data?.[nameField]) || p.record_id || 'Unnamed';
  const pCode = (p: any) => (idField && p.data?.[idField]) || p.record_id || '';

  // ─── Conduct ───
  const [cOpen, setCOpen] = useState(false);
  const [cPerson, setCPerson] = useState('');
  const [cType, setCType] = useState('warning');
  const [cSeverity, setCSeverity] = useState('low');
  const [cSubject, setCSubject] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cAction, setCAction] = useState('');
  const [cDate, setCDate] = useState('');

  const addConduct = async () => {
    if (!cPerson || !cSubject.trim()) return;
    const emp = employees.find(e => e.id === cPerson);
    const { data } = await supabase.from('conduct_records').insert({
      company_id: companyId, person_record_id: cPerson,
      person_name: emp ? pName(emp) : '', person_code: emp ? pCode(emp) : '',
      record_type: cType, severity: cSeverity, subject: cSubject.trim(), description: cDesc,
      action_taken: cAction, incident_date: cDate || null, status: 'open', issued_by: userEmail,
    }).select().single();
    if (data) {
      const appr = await startApproval({ companyId, processKey: 'conduct', sourceId: data.id, title: `${cType} — ${data.person_name}: ${cSubject}`, requestedBy: userEmail });
      if (appr) { await supabase.from('conduct_records').update({ approval_request_id: appr.id }).eq('id', data.id); }
      setConduct(p => [{ ...data, approval_request_id: appr?.id }, ...p]);
    }
    setCPerson(''); setCType('warning'); setCSeverity('low'); setCSubject(''); setCDesc(''); setCAction(''); setCDate(''); setCOpen(false);
  };
  const delConduct = async (id: string) => { await supabase.from('conduct_records').delete().eq('id', id); setConduct(p => p.filter(x => x.id !== id)); };

  // ─── Exit ───
  const [xOpen, setXOpen] = useState(false);
  const [xPerson, setXPerson] = useState('');
  const [xType, setXType] = useState('resignation');
  const [xReason, setXReason] = useState('');
  const [xLwd, setXLwd] = useState('');
  const [xNotice, setXNotice] = useState('');
  const DEFAULT_CHECKLIST = ['Handover completed', 'Company assets returned', 'IT access revoked', 'Final settlement', 'Exit interview', 'Visa cancellation'];

  const addExit = async () => {
    if (!xPerson) return;
    const emp = employees.find(e => e.id === xPerson);
    const checklist = DEFAULT_CHECKLIST.map(item => ({ item, done: false }));
    const { data } = await supabase.from('exit_records').insert({
      company_id: companyId, person_record_id: xPerson,
      person_name: emp ? pName(emp) : '', person_code: emp ? pCode(emp) : '',
      exit_type: xType, reason: xReason, last_working_day: xLwd || null, notice_period: xNotice,
      checklist, status: 'in_progress', processed_by: userEmail,
    }).select().single();
    if (data) {
      const appr = await startApproval({ companyId, processKey: 'exit', sourceId: data.id, title: `Exit (${xType}) — ${data.person_name}`, requestedBy: userEmail });
      if (appr) { await supabase.from('exit_records').update({ approval_request_id: appr.id }).eq('id', data.id); }
      // If last working day is today or past, mark the employee inactive immediately
      if (xLwd && new Date(xLwd) <= new Date()) {
        await markEmployeeInactive(xPerson);
      }
      setExits(p => [{ ...data, approval_request_id: appr?.id }, ...p]);
    }
    setXPerson(''); setXType('resignation'); setXReason(''); setXLwd(''); setXNotice(''); setXOpen(false);
  };
  const delExit = async (id: string) => { await supabase.from('exit_records').delete().eq('id', id); setExits(p => p.filter(x => x.id !== id)); };

  // ─── Remobilization ───
  const [remobFor, setRemobFor] = useState<any>(null);
  const [remobVisaType, setRemobVisaType] = useState('Work Visa');
  const [remobHowLeft, setRemobHowLeft] = useState('exited');
  const [remobRecId, setRemobRecId] = useState('');
  const [genningId, setGenningId] = useState(false);
  const [remobSaving, setRemobSaving] = useState(false);
  const [remobMsg, setRemobMsg] = useState('');

  const generateRecId = async () => {
    if (!candSectionId) { setRemobMsg('No recruitment section found to generate an ID.'); return; }
    setGenningId(true);
    const { data: idVal } = await supabase.rpc('generate_section_id', { p_section_pk: candSectionId });
    if (idVal) setRemobRecId(idVal);
    setGenningId(false);
  };

  const openRemobilize = (exitRec: any) => {
    setRemobFor(exitRec);
    setRemobVisaType('Work Visa');
    setRemobHowLeft('exited');
    setRemobRecId('');
    setRemobMsg('');
  };

  // Decision tree: visa type + how they left → path
  const decidePath = (visaType: string, howLeft: string): 'new_visa' | 'qiwa_transfer' => {
    // Work visa + local transfer → QIWA transfer. Everything else → new visa.
    if (visaType === 'Work Visa' && howLeft === 'local_transfer') return 'qiwa_transfer';
    return 'new_visa';
  };

  const confirmRemobilize = async () => {
    if (!remobFor) return;
    setRemobSaving(true); setRemobMsg('');
    const path = decidePath(remobVisaType, remobHowLeft);

    // For the NEW VISA path, create a candidate in the main recruitment pipeline
    // so the agency can work on them. QIWA path stays separate (no pipeline entry).
    let newCandidateId: string | null = null;
    if (path === 'new_visa') {
      // Recruitment ID: use what the admin entered/generated, else auto-generate.
      let recId = remobRecId.trim();
      if (!recId && candSectionId) {
        const { data: idVal } = await supabase.rpc('generate_section_id', { p_section_pk: candSectionId });
        recId = idVal || '';
      }
      const candNameField = candFields.find((f: any) => /name/i.test(f.field_label))?.field_key;
      const candIdField = candFields.find((f: any) => f.is_id_field)?.field_key;
      const data: any = {};
      if (candNameField) data[candNameField] = remobFor.person_name;
      else data['name'] = remobFor.person_name;
      // Put the recruitment ID in the candidate's ID field (NOT the employee code)
      if (candIdField && recId) data[candIdField] = recId;
      const { data: cand, error: candErr } = await supabase.from('section_records').insert({
        company_id: companyId, section_key: 'candidate',
        record_id: recId || remobFor.person_name,
        data: { ...data, _remob_origin: true, _remob_visa_type: remobVisaType, _remob_from_employee: remobFor.person_code || '' },
      }).select().single();
      if (candErr) { setRemobMsg(`Could not add to pipeline: ${candErr.message}`); setRemobSaving(false); return; }
      newCandidateId = cand?.id || null;
    }

    const { error } = await supabase.from('remobilizations').insert({
      company_id: companyId,
      exit_record_id: remobFor.id,
      person_record_id: remobFor.person_record_id,
      person_name: remobFor.person_name,
      person_code: remobFor.person_code,
      original_visa_type: remobVisaType,
      how_left: remobHowLeft,
      path,
      status: 'pending',
      note: newCandidateId ? `pipeline_candidate:${newCandidateId}` : null,
    });
    if (error) { setRemobMsg(error.message); setRemobSaving(false); return; }
    const { data: newRemob } = await supabase.from('remobilizations').select('*').eq('exit_record_id', remobFor.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (newRemob) setRemobs(p => [newRemob, ...p]);
    setRemobMsg(path === 'qiwa_transfer'
      ? '✓ Remobilization started. Path: QIWA Transfer. It shows in the QIWA tab of Visa Management.'
      : '✓ Remobilization started. Path: New Visa. The person was added to the Recruitment Pipeline for the agency to process, and shows as pending in Visa Management.');
    setRemobSaving(false);
    setTimeout(() => { setRemobFor(null); setRemobMsg(''); }, 3000);
  };

  const cancelRemob = async (id: string) => {
    if (!confirm('Cancel this remobilization? The person will no longer show as pending in Visa Management.')) return;
    await supabase.from('remobilizations').update({ status: 'cancelled' }).eq('id', id);
    setRemobs(p => p.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
  };
  const toggleChecklistItem = async (rec: any, idx: number) => {
    const checklist = rec.checklist.map((c: any, i: number) => i === idx ? { ...c, done: !c.done } : c);
    await supabase.from('exit_records').update({ checklist }).eq('id', rec.id);
    setExits(p => p.map(x => x.id === rec.id ? { ...x, checklist } : x));
  };

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const empByName = useMemo(() => new Map(employees.map(e => [norm(pName(e)), e])), [employees]);
  const empByCode = useMemo(() => new Map(employees.map(e => [norm(pCode(e)), e])), [employees]);
  const mc = (keys: string[], pats: string[]) => { for (const p of pats) { const h = keys.find(k => norm(k) === norm(p)); if (h) return h; } for (const p of pats) { const h = keys.find(k => norm(k).includes(norm(p))); if (h) return h; } return null; };
  const toDate = (v: any) => { if (!v) return null; if (v instanceof Date) return v.toISOString().split('T')[0]; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]; };

  const importConduct = (file: File) => {
    setImporting(true); setImportMsg('Reading…');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (!rows.length) { setImportMsg('No rows.'); setImporting(false); return; }
        const keys = Object.keys(rows[0]);
        const cName = mc(keys, ['name', 'employee']); const cCode = mc(keys, ['code', 'id']);
        const cType = mc(keys, ['type', 'record type']); const cSev = mc(keys, ['severity']);
        const cSubj = mc(keys, ['subject', 'title']); const cDesc = mc(keys, ['description', 'details']);
        const cAction = mc(keys, ['action']); const cDate = mc(keys, ['incident', 'date']);
        const recs = rows.map(row => {
          const emp = empByCode.get(norm(cCode ? row[cCode] : '')) || empByName.get(norm(cName ? row[cName] : ''));
          return { company_id: companyId, person_record_id: emp?.id || null,
            person_name: emp ? pName(emp) : (cName ? String(row[cName]) : 'Unknown'), person_code: emp ? pCode(emp) : (cCode ? String(row[cCode]) : ''),
            record_type: cType ? String(row[cType]) : 'warning', severity: cSev ? String(row[cSev]).toLowerCase() : 'low',
            subject: cSubj ? String(row[cSubj]) : 'Imported record', description: cDesc ? String(row[cDesc]) : '',
            action_taken: cAction ? String(row[cAction]) : '', incident_date: cDate ? toDate(row[cDate]) : null, status: 'open', issued_by: userEmail };
        });
        let saved: any[] = [];
        for (let i = 0; i < recs.length; i += 500) { const { data } = await supabase.from('conduct_records').insert(recs.slice(i, i + 500)).select(); if (data) saved = saved.concat(data); }
        setConduct(p => [...saved, ...p]); setImportMsg(`Imported ${saved.length} conduct records.`);
        setTimeout(() => setImportMsg(''), 5000);
      } catch (err: any) { setImportMsg(`Failed: ${err.message}`); }
      setImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const importExit = (file: File) => {
    setImporting(true); setImportMsg('Reading…');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (!rows.length) { setImportMsg('No rows.'); setImporting(false); return; }
        const keys = Object.keys(rows[0]);
        const cName = mc(keys, ['name', 'employee']); const cCode = mc(keys, ['code', 'id']);
        const cType = mc(keys, ['exit type', 'type']); const cReason = mc(keys, ['reason']);
        const cLwd = mc(keys, ['last working', 'last day', 'lwd', 'end date']); const cNotice = mc(keys, ['notice']);
        const recs = rows.map(row => {
          const emp = empByCode.get(norm(cCode ? row[cCode] : '')) || empByName.get(norm(cName ? row[cName] : ''));
          return { company_id: companyId, person_record_id: emp?.id || null,
            person_name: emp ? pName(emp) : (cName ? String(row[cName]) : 'Unknown'), person_code: emp ? pCode(emp) : (cCode ? String(row[cCode]) : ''),
            exit_type: cType ? String(row[cType]).toLowerCase().replace(/ /g, '_') : 'resignation', reason: cReason ? String(row[cReason]) : '',
            last_working_day: cLwd ? toDate(row[cLwd]) : null, notice_period: cNotice ? String(row[cNotice]) : '',
            checklist: [], status: 'in_progress', processed_by: userEmail };
        });
        let saved: any[] = [];
        for (let i = 0; i < recs.length; i += 500) { const { data } = await supabase.from('exit_records').insert(recs.slice(i, i + 500)).select(); if (data) saved = saved.concat(data); }
        // Auto-inactivate anyone whose last day has passed
        for (const r of saved) { if (r.person_record_id && r.last_working_day && new Date(r.last_working_day) <= new Date()) await markEmployeeInactive(r.person_record_id); }
        setExits(p => [...saved, ...p]); setImportMsg(`Imported ${saved.length} exit records.`);
        setTimeout(() => setImportMsg(''), 5000);
      } catch (err: any) { setImportMsg(`Failed: ${err.message}`); }
      setImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const markInactiveNow = async (r: any) => {
    if (!r.person_record_id) { alert('This exit is not linked to an employee record.'); return; }
    await markEmployeeInactive(r.person_record_id);
    await supabase.from('exit_records').update({ status: 'completed' }).eq('id', r.id);
    setExits(p => p.map(x => x.id === r.id ? { ...x, status: 'completed' } : x));
    alert(`${r.person_name} marked inactive.`);
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conduct & Exit</h1>
          <p className="text-sm text-slate-500 mt-0.5">Warnings, misconduct, and offboarding — routed through your approval chains</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" id="ce-import" onChange={e => e.target.files?.[0] && (tab === 'conduct' ? importConduct(e.target.files[0]) : importExit(e.target.files[0]))} />
          <button onClick={() => document.getElementById('ce-import')?.click()} disabled={importing} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50">{importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}Import</button>
          <button onClick={() => tab === 'conduct' ? setCOpen(true) : setXOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />{tab === 'conduct' ? 'New Conduct Record' : 'New Exit'}</button>
        </div>
      </div>

      {importMsg && <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-sm text-indigo-700 flex items-center gap-2">{importing && <Loader size={14} className="animate-spin" />}{importMsg}</div>}

      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('conduct')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'conduct' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}><ShieldAlert size={14} />Conduct</button>
        <button onClick={() => setTab('exit')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'exit' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}><LogOut size={14} />Exit</button>
        <button onClick={() => setTab('remob')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'remob' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}><RotateCcw size={14} />Remobilization{remobs.filter(r => r.status !== 'cancelled' && r.status !== 'completed').length > 0 ? ` (${remobs.filter(r => r.status !== 'cancelled' && r.status !== 'completed').length})` : ''}</button>
      </div>

      {tab === 'conduct' && (
        conduct.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
            <AlertTriangle size={36} className="text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">No conduct records</p>
            <p className="text-xs text-slate-400">Log a warning or misconduct — it routes through your approval chain if one is set.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conduct.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{r.person_name}</span>
                      {r.person_code && <span className="text-xs font-mono text-slate-400">{r.person_code}</span>}
                      <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full capitalize">{r.record_type?.replace('_', ' ')}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SEV[r.severity]}`}>{r.severity}</span>
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-sm text-slate-700 mt-1.5 font-medium">{r.subject}</p>
                    {r.description && <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>}
                    {r.action_taken && <p className="text-xs text-slate-400 mt-1">Action: {r.action_taken}</p>}
                    <p className="text-xs text-slate-400 mt-1">Incident {fmt(r.incident_date)} · by {r.issued_by}</p>
                  </div>
                  <button onClick={() => delConduct(r.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><X size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'exit' && (
        exits.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
            <LogOut size={36} className="text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">No exit records</p>
            <p className="text-xs text-slate-400">Start an offboarding — track the checklist and route final settlement for approval.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exits.map(r => {
              const done = (r.checklist || []).filter((c: any) => c.done).length;
              const total = (r.checklist || []).length;
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 group">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{r.person_name}</span>
                        {r.person_code && <span className="text-xs font-mono text-slate-400">{r.person_code}</span>}
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full capitalize">{r.exit_type?.replace('_', ' ')}</span>
                        {statusBadge(r.status)}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Last day {fmt(r.last_working_day)}{r.notice_period ? ` · ${r.notice_period} notice` : ''}</p>
                      {r.reason && <p className="text-xs text-slate-500 mt-0.5">{r.reason}</p>}
                      {r.person_record_id && activeConfig?.active_field_key && r.status !== 'completed' && (
                        <button onClick={() => markInactiveNow(r)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:gap-2 transition-all"><LogOut size={12} />Mark employee inactive</button>
                      )}
                      {r.person_record_id && (
                        <button onClick={() => openRemobilize(r)} className="mt-2 ml-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:gap-2 transition-all"><RotateCcw size={12} />Remobilize</button>
                      )}
                    </div>
                    <button onClick={() => delExit(r.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><X size={13} /></button>
                  </div>
                  {total > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">Offboarding checklist ({done}/{total})</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {r.checklist.map((c: any, i: number) => (
                          <button key={i} onClick={() => toggleChecklistItem(r, i)} className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg text-left ${c.done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>
                            <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${c.done ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}>{c.done && <CheckCircle2 size={11} />}</span>
                            {c.item}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Conduct modal */}
      {cOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setCOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">New Conduct Record</h2>
              <button onClick={() => setCOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Employee</label>
                <PersonPicker people={employees} fields={empFields} value={cPerson} onChange={setCPerson} placeholder="Search by name or ID…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Type</label>
                  <input value={cType} onChange={e => setCType(e.target.value)} placeholder="warning / misconduct" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Severity</label>
                  <select value={cSeverity} onChange={e => setCSeverity(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
              </div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Subject</label>
                <input value={cSubject} onChange={e => setCSubject(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Description</label>
                <textarea value={cDesc} onChange={e => setCDesc(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Action taken</label>
                  <input value={cAction} onChange={e => setCAction(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Incident date</label>
                  <input type="date" value={cDate} onChange={e => setCDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setCOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={addConduct} disabled={!cPerson || !cSubject.trim()} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Save & Route</button>
            </div>
          </div>
        </div>
      )}

      {/* Exit modal */}
      {xOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setXOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">New Exit</h2>
              <button onClick={() => setXOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Employee</label>
                <PersonPicker people={employees} fields={empFields} value={xPerson} onChange={setXPerson} placeholder="Search by name or ID…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Exit type</label>
                  <select value={xType} onChange={e => setXType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="resignation">Resignation</option><option value="termination">Termination</option><option value="end_of_contract">End of contract</option><option value="retirement">Retirement</option></select></div>
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Last working day</label>
                  <input type="date" value={xLwd} onChange={e => setXLwd(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              </div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Notice period</label>
                <input value={xNotice} onChange={e => setXNotice(e.target.value)} placeholder="e.g. 30 days" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Reason</label>
                <textarea value={xReason} onChange={e => setXReason(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" /></div>
              <p className="text-xs text-slate-400">A standard offboarding checklist will be created automatically. This exit routes through your approval chain if one is set.</p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setXOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={addExit} disabled={!xPerson} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Save & Route</button>
            </div>
          </div>
        </div>
      )}
      {/* Remobilization tab */}
      {tab === 'remob' && (
        remobs.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
            <RotateCcw size={36} className="text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">No remobilizations yet</p>
            <p className="text-xs text-slate-400">Use the "Remobilize" button on an exit record to bring someone back.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {remobs.map(r => {
              const pathLabel = r.path === 'qiwa_transfer' ? 'QIWA Transfer' : 'New Visa';
              const statusColor: any = {
                pending: 'bg-amber-50 text-amber-700', visa_allocated: 'bg-sky-50 text-sky-700',
                qiwa_allocated: 'bg-sky-50 text-sky-700', completed: 'bg-emerald-50 text-emerald-700',
                cancelled: 'bg-slate-100 text-slate-400',
              };
              return (
                <div key={r.id} className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{r.person_name}</span>
                        {r.person_code && <span className="text-xs font-mono text-slate-400">{r.person_code}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${r.path === 'qiwa_transfer' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>{pathLabel}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColor[r.status] || 'bg-slate-100 text-slate-600'}`}>{r.status?.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Was on {r.original_visa_type} · {r.how_left === 'local_transfer' ? 'Local transfer' : 'Exited'}</p>
                      {r.status === 'pending' && (
                        <p className="text-xs text-indigo-600 mt-1">→ Pending {r.path === 'qiwa_transfer' ? 'QIWA transfer' : 'visa'} in Visa Management</p>
                      )}
                    </div>
                    {r.status !== 'cancelled' && r.status !== 'completed' && (
                      <button onClick={() => cancelRemob(r.id)} className="text-xs font-medium text-slate-400 hover:text-red-500">Cancel</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Remobilize modal */}
      {remobFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setRemobFor(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Remobilize {remobFor.person_name}</h2>
                <p className="text-xs text-slate-400">Bring this person back — the path depends on their situation</p>
              </div>
              <button onClick={() => setRemobFor(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">What visa were they originally on?</label>
                <select value={remobVisaType} onChange={e => setRemobVisaType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="Work Visa">Work Visa</option>
                  <option value="Temporary Visa">Temporary Visa</option>
                  <option value="Business Visa">Business Visa</option>
                  <option value="Visit Visa">Visit Visa</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">How did they leave?</label>
                <select value={remobHowLeft} onChange={e => setRemobHowLeft(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="exited">Exited the country</option>
                  <option value="local_transfer">Local transfer (to another company)</option>
                </select>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 text-xs text-indigo-700">
                {decidePath(remobVisaType, remobHowLeft) === 'qiwa_transfer'
                  ? '→ Path: QIWA Transfer. This person will show as QIWA-pending in Visa Management.'
                  : '→ Path: New Visa. This person will be added to the Recruitment Pipeline for the agency to process.'}
              </div>
              {decidePath(remobVisaType, remobHowLeft) === 'new_visa' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Recruitment ID</label>
                  <div className="flex gap-2">
                    <input value={remobRecId} onChange={e => setRemobRecId(e.target.value)} placeholder="Enter or generate" className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button type="button" onClick={generateRecId} disabled={genningId} className="px-3 py-2.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-40 whitespace-nowrap">{genningId ? '…' : 'Generate'}</button>
                  </div>
                  <p className="text-xs text-slate-400">A new recruitment ID for the pipeline. Leave blank to auto-generate.</p>
                </div>
              )}
              {remobMsg && <p className={`text-xs ${remobMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{remobMsg}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setRemobFor(null)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={confirmRemobilize} disabled={remobSaving} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">{remobSaving ? 'Starting…' : 'Start Remobilization'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
