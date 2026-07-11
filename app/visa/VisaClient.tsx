'use client';
import { useState, useMemo } from 'react';
import { Plus, X, Upload, Download, Loader, CreditCard, Users, CheckCircle2, AlertTriangle, UserPlus, Trash2, FileCheck, GitBranch, Sparkles, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import PersonPicker from '@/components/PersonPicker';
import { createClient } from '@/lib/supabase/client';

const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

export default function VisaClient({ initialBlocks, initialAllocations, people, candFields, agencies = [], statusFieldKey = '', candidateStages = [], initialStageMap = {}, pendingVisa = [], remobVisaPending = [], remobQiwaPending = [], companyId }: {
  initialBlocks: any[]; initialAllocations: any[]; people: any[]; candFields: any[]; agencies?: any[]; statusFieldKey?: string; candidateStages?: string[]; initialStageMap?: any; pendingVisa?: any[]; remobVisaPending?: any[]; remobQiwaPending?: any[]; companyId: string;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [tab, setTab] = useState<'blocks' | 'ewakala' | 'qiwa'>('blocks');
  const [qiwaPending, setQiwaPending] = useState<any[]>(remobQiwaPending);
  const [stageMap, setStageMap] = useState<any>(initialStageMap || {});
  const [mapOpen, setMapOpen] = useState(false);
  const [pending, setPending] = useState<any[]>([
    ...pendingVisa,
    ...remobVisaPending.map((r: any) => ({
      id: r.person_record_id, record_id: r.person_code || r.person_name,
      data: {}, _status: `Remobilization · ${r.original_visa_type}`, _remobId: r.id,
      _name: r.person_name,
    })),
  ]);
  const [quickAllocateBlock, setQuickAllocateBlock] = useState('');
  const [allocations, setAllocations] = useState(initialAllocations);
  const [addOpen, setAddOpen] = useState(false);
  const [allocBlock, setAllocBlock] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const supabase = createClient();

  // Visa workflow stages, in order
  // Mark a QIWA transfer done → completes the remobilization
  const processQiwa = async (remob: any) => {
    if (!confirm(`Mark QIWA transfer done for ${remob.person_name}? This completes their remobilization.`)) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: qt } = await supabase.from('qiwa_transfers').insert({
      company_id: companyId, person_record_id: remob.person_record_id,
      person_name: remob.person_name, person_code: remob.person_code,
      stage: 'completed', requested_date: today, completed_date: today,
    }).select().single();
    await supabase.from('remobilizations').update({
      status: 'completed', qiwa_transfer_id: qt?.id || null,
    }).eq('id', remob.id);
    setQiwaPending(p => p.filter(x => x.id !== remob.id));
  };

  const STAGES = ['allocated', 'ewakala_pending', 'ewakala_issued', 'passport_submitted', 'stamped'];
  const STAGE_LABEL: any = {
    allocated: 'Allocated', ewakala_pending: 'Ewakala Pending', ewakala_issued: 'Ewakala Issued',
    passport_submitted: 'Passport Submitted', stamped: 'Stamped ✓', missed: 'Missed', cancelled: 'Cancelled',
  };
  const STAGE_COLOR: any = {
    allocated: 'bg-slate-100 text-slate-600', ewakala_pending: 'bg-amber-50 text-amber-700',
    ewakala_issued: 'bg-sky-50 text-sky-700', passport_submitted: 'bg-violet-50 text-violet-700',
    stamped: 'bg-emerald-50 text-emerald-700', missed: 'bg-red-50 text-red-500', cancelled: 'bg-slate-100 text-slate-400',
  };

  const advanceStage = async (a: any) => {
    const idx = STAGES.indexOf(a.stage || 'allocated');
    if (idx < 0 || idx >= STAGES.length - 1) return;
    const next = STAGES[idx + 1];
    const upd: any = { stage: next };
    const today = new Date().toISOString().split('T')[0];
    if (next === 'ewakala_issued') upd.ewakala_issued_date = today;
    if (next === 'passport_submitted') upd.passport_submitted_date = today;
    if (next === 'stamped') { upd.stamped_date = today; upd.status = 'used'; }
    await supabase.from('visa_allocations').update(upd).eq('id', a.id);
    setAllocations(p => p.map(x => x.id === a.id ? { ...x, ...upd } : x));
    // Sync the candidate's pipeline status if this visa stage is mapped
    await syncCandidateStatus(a.person_record_id, next);
  };

  // Write the mapped pipeline stage onto the candidate's record (both-way sync, visa→pipeline)
  const syncCandidateStatus = async (personRecordId: string, visaStage: string) => {
    if (!personRecordId || !statusFieldKey) return;
    const mappedStage = stageMap[visaStage];
    if (!mappedStage) return; // no mapping for this stage → don't touch pipeline
    const person = people.find(p => p.id === personRecordId);
    if (!person) return;
    const newData = { ...(person.data || {}), [statusFieldKey]: mappedStage };
    await supabase.from('section_records').update({ data: newData }).eq('id', personRecordId);
  };

  // Save the mapping
  const saveStageMap = async (map: any) => {
    setStageMap(map);
    await supabase.from('company_profile').update({ visa_stage_map: map, candidate_status_field_key: statusFieldKey || null }).eq('id', companyId);
  };

  // AI-style suggestion: match candidate stages to visa stages by keyword (company confirms)
  const suggestMap = () => {
    const suggest: any = { ...stageMap };
    const findStage = (kws: string[]) => candidateStages.find(s => kws.some(k => s.toLowerCase().includes(k)));
    if (!suggest.ewakala_issued) { const m = findStage(['ewakala', 'wakala', 'authoriz']); if (m) suggest.ewakala_issued = m; }
    if (!suggest.passport_submitted) { const m = findStage(['stamp', 'passport', 'submit']); if (m) suggest.passport_submitted = m; }
    if (!suggest.stamped) { const m = findStage(['stamped', 'visa done', 'visa ready', 'completed', 'visa issued']); if (m) suggest.stamped = m; }
    saveStageMap(suggest);
  };

  const setStage = async (a: any, stage: string) => {
    const upd: any = { stage };
    if (stage === 'stamped') { upd.stamped_date = new Date().toISOString().split('T')[0]; upd.status = 'used'; }
    if (stage === 'cancelled') upd.status = 'cancelled';
    await supabase.from('visa_allocations').update(upd).eq('id', a.id);
    setAllocations(p => p.map(x => x.id === a.id ? { ...x, ...upd } : x));
  };

  // ─── Ewakala: group allocations by agency + block for batch issuing ───
  const ewakalaGroups = useMemo(() => {
    // Only allocations that still need ewakala action (pending) or have it issued (to show progress)
    const relevant = allocations.filter(a => ['ewakala_pending', 'ewakala_issued', 'passport_submitted', 'stamped'].includes(a.stage) && a.stage !== 'cancelled');
    const map = new Map<string, any>();
    for (const a of relevant) {
      const block = blocks.find(b => b.id === a.visa_block_id);
      const key = `${a.agency_id || 'none'}::${a.visa_block_id}`;
      if (!map.has(key)) {
        map.set(key, {
          key, agencyName: a.agency_name || 'No agency', agencyId: a.agency_id,
          blockNumber: block?.authority_number || '—', blockId: a.visa_block_id,
          visaType: a.visa_type || block?.visa_type || '', items: [],
        });
      }
      map.get(key).items.push(a);
    }
    return Array.from(map.values()).sort((x, y) => x.agencyName.localeCompare(y.agencyName));
  }, [allocations, blocks]);

  const issueEwakalaBatch = async (group: any) => {
    const pending = group.items.filter((a: any) => a.stage === 'ewakala_pending');
    if (pending.length === 0) return;
    if (!confirm(`Issue Ewakala for ${pending.length} candidate(s) to ${group.agencyName} on block ${group.blockNumber}?`)) return;
    const today = new Date().toISOString().split('T')[0];
    const ids = pending.map((a: any) => a.id);
    await supabase.from('visa_allocations').update({ stage: 'ewakala_issued', ewakala_issued_date: today }).in('id', ids);
    setAllocations(p => p.map(x => ids.includes(x.id) ? { ...x, stage: 'ewakala_issued', ewakala_issued_date: today } : x));
    // Sync each candidate's pipeline status if mapped
    for (const a of pending) await syncCandidateStatus(a.person_record_id, 'ewakala_issued');
  };

  const nameField = useMemo(() => candFields.find(f => /name/i.test(f.field_label))?.field_key, [candFields]);
  const passField = useMemo(() => candFields.find(f => /passport/i.test(f.field_label))?.field_key, [candFields]);
  const idField = useMemo(() => candFields.find(f => f.is_id_field)?.field_key, [candFields]);
  const pName = (p: any) => (nameField && p.data?.[nameField]) || p.record_id || 'Unnamed';
  const pCode = (p: any) => (idField && p.data?.[idField]) || p.record_id || '';
  const pPass = (p: any) => (passField && p.data?.[passField]) || '';

  const activeAllocs = (blockId: string) => allocations.filter(a => a.visa_block_id === blockId && a.stage !== 'cancelled' && a.stage !== 'missed');
  const stampedCount = (blockId: string) => allocations.filter(a => a.visa_block_id === blockId && a.stage === 'stamped').length;
  // Allocated = all active allocations (including stamped). Balance now reflects allocation.
  const allocatedCount = (blockId: string) => activeAllocs(blockId).length;
  // Available = total minus allocated (intuitive). Can go negative when over-allocated.
  const balanceOf = (b: any) => (b.total_quantity || 0) - allocatedCount(b.id);
  // In process = allocated but not yet stamped (in hand, being worked on)
  const chasingCount = (blockId: string) => activeAllocs(blockId).filter(a => a.stage !== 'stamped').length;
  const isOverAllocated = (b: any) => allocatedCount(b.id) > (b.total_quantity || 0);
  const overBy = (b: any) => Math.max(0, allocatedCount(b.id) - (b.total_quantity || 0));

  const totals = useMemo(() => {
    const total = blocks.reduce((s, b) => s + (b.total_quantity || 0), 0);
    const stamped = allocations.filter(a => a.stage === 'stamped').length;
    const allocated = allocations.filter(a => a.stage !== 'cancelled' && a.stage !== 'missed').length;
    const inProcess = allocated - stamped;
    const available = total - allocated;
    const byType: Record<string, { total: number; available: number }> = {};
    blocks.forEach(b => {
      const t = b.visa_type || 'Other';
      if (!byType[t]) byType[t] = { total: 0, available: 0 };
      byType[t].total += (b.total_quantity || 0);
      byType[t].available += balanceOf(b);
    });
    return { total, stamped, allocated, inProcess, available, byType };
  }, [blocks, allocations]);

  // ─── New visa block ───
  const [f, setF] = useState({ authority_number: '', visa_type: 'Work Visa', profession: '', nationality: '', sponsor: '', sponsor_id: '', total_quantity: '1', issue_date: '', expiry_date: '', note: '' });
  const setField = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const addBlock = async () => {
    if (!f.authority_number.trim() && !f.profession.trim()) return;
    const { data } = await supabase.from('visa_blocks').insert({
      company_id: companyId, ...f, total_quantity: Number(f.total_quantity) || 1,
      issue_date: f.issue_date || null, expiry_date: f.expiry_date || null,
    }).select().single();
    if (data) setBlocks(p => [data, ...p]);
    setF({ authority_number: '', visa_type: 'Work Visa', profession: '', nationality: '', sponsor: '', sponsor_id: '', total_quantity: '1', issue_date: '', expiry_date: '', note: '' });
    setAddOpen(false);
  };

  const deleteBlock = async (id: string) => {
    if (!confirm('Delete this visa and all its allocations?')) return;
    await supabase.from('visa_blocks').delete().eq('id', id);
    setBlocks(p => p.filter(b => b.id !== id));
    setAllocations(p => p.filter(a => a.visa_block_id !== id));
  };

  // ─── Allocate a person ───
  const [allocPerson, setAllocPerson] = useState('');
  const [allocAgency, setAllocAgency] = useState('');
  const [allocType, setAllocType] = useState('');
  const allocate = async () => {
    if (!allocPerson || !allocBlock) return;
    const person = people.find(p => p.id === allocPerson);
    const agency = agencies.find(a => a.id === allocAgency);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('visa_allocations').insert({
      company_id: companyId, visa_block_id: allocBlock.id,
      person_record_id: allocPerson, person_name: person ? pName(person) : '',
      person_code: person ? pCode(person) : '', passport_number: person ? pPass(person) : '',
      agency_id: allocAgency || null, agency_name: agency?.name || '',
      visa_type: allocBlock.visa_type || '',
      stage: 'ewakala_pending', status: 'allocated', allocated_date: today,
    }).select().single();
    if (data) setAllocations(p => [...p, data]);

    // If this person is a candidate record (incl. remob-origin), sync the agency +
    // allocation date + status back onto their pipeline record so it stays consistent.
    try {
      const { data: rec } = await supabase.from('section_records').select('id, data, section_key').eq('id', allocPerson).maybeSingle();
      if (rec && rec.section_key === 'candidate') {
        const updated = { ...(rec.data || {}) };
        updated._visa_agency = agency?.name || '';
        updated._visa_allocated_date = today;
        if (statusFieldKey) updated[statusFieldKey] = 'Visa Allocated';
        await supabase.from('section_records').update({ data: updated }).eq('id', allocPerson);
        // If this candidate came from a remobilization, advance the remob status.
        if (rec.data?._remob_origin) {
          await supabase.from('remobilizations').update({ status: 'visa_allocated', visa_allocation_id: data?.id || null })
            .eq('note', `pipeline_candidate:${allocPerson}`);
        }
      }
    } catch {}

    setAllocPerson(''); setAllocAgency(''); setAllocType('');
    setPending(p => p.filter(x => x.id !== allocPerson));
  };

  // Open the allocate modal pre-filled with a pending candidate (block chosen inside)
  const startQuickAllocate = (candidate: any) => {
    setAllocPerson(candidate.id);
    setAllocAgency('');
    setAllocType('');
    // Default to first block with balance, else first block
    const target = blocks.find(b => balanceOf(b) > 0) || blocks[0];
    if (target) setAllocBlock(target);
  };

  const removeAlloc = async (id: string) => {
    await supabase.from('visa_allocations').delete().eq('id', id);
    setAllocations(p => p.filter(a => a.id !== id));
  };

  // ─── Swap a visa allocation from one person to another ───
  const [swapAlloc, setSwapAlloc] = useState<any>(null);
  const [swapPerson, setSwapPerson] = useState('');
  const doSwap = async () => {
    if (!swapPerson || !swapAlloc) return;
    const person = people.find(p => p.id === swapPerson);
    if (!person) return;
    const prevName = swapAlloc.person_name;
    const note = `Swapped from ${prevName || 'previous'} on ${new Date().toLocaleDateString('en-GB')}${swapAlloc.note ? ` · ${swapAlloc.note}` : ''}`;
    const { data } = await supabase.from('visa_allocations').update({
      person_record_id: swapPerson, person_name: pName(person),
      person_code: pCode(person), passport_number: pPass(person),
      status: 'allocated', note,
    }).eq('id', swapAlloc.id).select().single();
    if (data) setAllocations(p => p.map(a => a.id === swapAlloc.id ? data : a));
    setSwapAlloc(null); setSwapPerson('');
  };
  const setAllocStatus = async (id: string, status: string) => {
    await supabase.from('visa_allocations').update({ status }).eq('id', id);
    setAllocations(p => p.map(a => a.id === id ? { ...a, status } : a));
  };

  // ─── Bulk import visa blocks ───
  const importFile = (file: File) => {
    setImporting(true); setImportMsg('Reading…');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (!rows.length) { setImportMsg('No rows.'); setImporting(false); return; }
        const keys = Object.keys(rows[0]);
        const mc = (pats: string[]) => { for (const p of pats) { const h = keys.find(k => norm(k) === norm(p)); if (h) return h; } for (const p of pats) { const h = keys.find(k => norm(k).includes(norm(p))); if (h) return h; } return null; };
        const cAuth = mc(['authority', 'visa number', 'authority number', 'number']);
        const cType = mc(['visa type', 'type']);
        const cProf = mc(['profession', 'designation', 'job']);
        const cNat = mc(['nationality', 'country']);
        const cSponsor = mc(['sponsor', 'company']);
        const cSponsorId = mc(['sponsor id', 'sponsor_id', 'sponsorid']);
        const cQty = mc(['quantity', 'qty', 'count', 'total']);
        const cExp = mc(['expiry', 'expiry date']);
        const toDate = (v: any) => { if (!v) return null; if (v instanceof Date) return v.toISOString().split('T')[0]; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]; };
        const recs = rows.map(row => ({
          company_id: companyId,
          authority_number: cAuth ? String(row[cAuth]) : '',
          visa_type: cType ? String(row[cType]) : 'Work Visa',
          profession: cProf ? String(row[cProf]) : '',
          nationality: cNat ? String(row[cNat]) : '',
          sponsor: cSponsor ? String(row[cSponsor]) : '',
          sponsor_id: cSponsorId ? String(row[cSponsorId]) : '',
          total_quantity: cQty ? (Number(row[cQty]) || 1) : 1,
          expiry_date: cExp ? toDate(row[cExp]) : null,
        }));
        setImportMsg(`Saving ${recs.length}…`);
        let saved: any[] = [];
        for (let i = 0; i < recs.length; i += 500) {
          const { data } = await supabase.from('visa_blocks').insert(recs.slice(i, i + 500)).select();
          if (data) saved = saved.concat(data);
        }
        setBlocks(p => [...saved, ...p]);
        setImportMsg(`Imported ${saved.length} visas.`);
        setTimeout(() => setImportMsg(''), 5000);
      } catch (err: any) { setImportMsg(`Failed: ${err.message}`); }
      setImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const exportFile = () => {
    // Sheet 1: block summary
    const blockRows = blocks.map(b => ({
      'Authority Number': b.authority_number, 'Type': b.visa_type, 'Profession': b.profession,
      'Nationality': b.nationality, 'Sponsor': b.sponsor, 'Sponsor ID': b.sponsor_id, 'Total Visas': b.total_quantity,
      'In Process': chasingCount(b.id), 'Stamped': stampedCount(b.id), 'Balance': balanceOf(b),
      'Expiry': b.expiry_date || '',
    }));
    // Sheet 2: full allocation tracker with all workflow dates
    const allocRows = allocations.filter(a => a.stage !== 'cancelled').map(a => {
      const block = blocks.find(b => b.id === a.visa_block_id);
      return {
        'Candidate': a.person_name, 'Code': a.person_code, 'Passport': a.passport_number,
        'Agency': a.agency_name, 'Block': block?.authority_number || '', 'Visa Type': a.visa_type,
        'Stage': STAGE_LABEL[a.stage] || a.stage,
        'Allocated Date': a.allocated_date || (a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB') : ''),
        'Ewakala Issued': a.ewakala_issued_date || '',
        'Passport Submitted': a.passport_submitted_date || '',
        'Stamped Date': a.stamped_date || '',
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(blockRows), 'Block Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allocRows), 'Allocation Tracker');
    const stamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `naibus-visa-tracker-${stamp}.xlsx`);
  };

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visa Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track visa authorizations, allocate to people, monitor balances</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" id="visa-import" onChange={e => e.target.files?.[0] && importFile(e.target.files[0])} />
          <button onClick={() => document.getElementById('visa-import')?.click()} disabled={importing} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50">{importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}Import</button>
          <button onClick={exportFile} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Download size={14} />Export</button>
          <button onClick={() => setMapOpen(true)} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><GitBranch size={14} />Stage Sync</button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />Add Visa</button>
        </div>
      </div>

      {importMsg && <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-sm text-indigo-700 flex items-center gap-2">{importing && <Loader size={14} className="animate-spin" />}{importMsg}</div>}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('blocks')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'blocks' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}><CreditCard size={14} />Visa Blocks</button>
        <button onClick={() => setTab('ewakala')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'ewakala' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}><FileCheck size={14} />Ewakala</button>
        <button onClick={() => setTab('qiwa')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium ${tab === 'qiwa' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}><RefreshCw size={14} />QIWA{qiwaPending.length > 0 ? ` (${qiwaPending.length})` : ''}</button>
      </div>

      {/* Pending for visa — auto-surfaced from the recruitment pipeline */}
      {pending.length > 0 && tab === 'blocks' && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <p className="text-sm font-semibold text-amber-800">{pending.length} candidate(s) pending for visa</p>
            </div>
            <p className="text-xs text-amber-600">From your recruitment pipeline — allocate them to a block</p>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {pending.map(c => {
              const nm = c._name || (candFields.find((f: any) => /name/i.test(f.field_label))?.field_key && c.data?.[candFields.find((f: any) => /name/i.test(f.field_label))?.field_key]) || c.record_id;
              return (
                <div key={c.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-xs">
                  <span className="font-medium text-slate-700">{nm}</span>
                  <span className="text-slate-400">{c._status}</span>
                  <button onClick={() => startQuickAllocate(c)} disabled={blocks.length === 0} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-40"><UserPlus size={12} />Allocate</button>
                </div>
              );
            })}
          </div>
          {blocks.length === 0 && <p className="text-xs text-amber-600 mt-2">Add a visa block first, then allocate these candidates.</p>}
        </div>
      )}

      {tab === 'blocks' && (<>
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1"><CreditCard size={15} className="text-indigo-500" /><span className="text-xs font-medium text-slate-500">Total Visas</span></div>
          <p className="text-2xl font-bold text-slate-900">{totals.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1"><Users size={15} className="text-amber-500" /><span className="text-xs font-medium text-slate-500">Allocated</span></div>
          <p className="text-2xl font-bold text-amber-600">{totals.allocated}</p>
          <p className="text-[11px] text-slate-400">{totals.inProcess} in process · {totals.stamped} stamped</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 size={15} className="text-sky-500" /><span className="text-xs font-medium text-slate-500">Stamped</span></div>
          <p className="text-2xl font-bold text-sky-600">{totals.stamped}</p>
          <p className="text-[11px] text-slate-400">visas consumed</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 size={15} className="text-emerald-500" /><span className="text-xs font-medium text-slate-500">Available Balance</span></div>
          <p className={`text-2xl font-bold ${totals.available < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{totals.available}</p>
          {totals.available < 0 && <p className="text-[11px] text-red-500">over-allocated</p>}
        </div>
      </div>

      {/* Category breakdown */}
      {Object.keys(totals.byType).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(totals.byType).map(([type, v]: any) => (
            <div key={type} className="inline-flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs shadow-sm">
              <span className="font-medium text-slate-700">{type}</span>
              <span className="text-emerald-600 font-semibold">{v.available}</span>
              <span className="text-slate-400">/ {v.total} available</span>
            </div>
          ))}
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
          <CreditCard size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600 mb-1">No visas tracked yet</p>
          <p className="text-xs text-slate-400">Add a visa authorization or import from Excel. Then allocate people and watch the balance.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map(b => {
            const allocs = activeAllocs(b.id);
            const bal = balanceOf(b);
            return (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{b.authority_number || b.profession || 'Visa'}</span>
                      <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{b.visa_type}</span>
                      {b.profession && <span className="text-xs text-slate-500">{b.profession}</span>}
                      {b.nationality && <span className="text-xs text-slate-400">· {b.nationality}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {b.sponsor && `${b.sponsor}${b.sponsor_id ? ` (${b.sponsor_id})` : ''} · `}Expires {fmt(b.expiry_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={`text-lg font-bold ${bal < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{bal}<span className="text-xs text-slate-400 font-normal"> / {b.total_quantity}</span></p>
                      <p className="text-xs text-slate-400">available</p>
                      {isOverAllocated(b) && <p className="text-[11px] text-red-500 font-medium">⚠ over-allocated by {overBy(b)}</p>}
                    </div>
                    <button onClick={() => deleteBlock(b.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                  </div>
                </div>

                {/* Clear breakdown counts */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 text-xs bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1"><span className="text-slate-400">Total</span><span className="font-semibold text-slate-700">{b.total_quantity}</span></span>
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1"><span className="text-amber-600">Allocated</span><span className="font-semibold text-amber-700">{allocatedCount(b.id)}</span></span>
                  <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1"><span className="text-emerald-600">Available</span><span className="font-semibold text-emerald-700">{bal}</span></span>
                  <span className="inline-flex items-center gap-1 text-xs bg-sky-50 border border-sky-100 rounded-lg px-2.5 py-1"><span className="text-sky-600">Stamped</span><span className="font-semibold text-sky-700">{stampedCount(b.id)}</span></span>
                  <span className="inline-flex items-center gap-1 text-xs bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1"><span className="text-violet-600">In process</span><span className="font-semibold text-violet-700">{chasingCount(b.id)}</span></span>
                </div>

                {/* Allocated people */}
                {allocs.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {allocs.map(a => {
                      const stage = a.stage || 'allocated';
                      const canAdvance = STAGES.indexOf(stage) >= 0 && STAGES.indexOf(stage) < STAGES.length - 1;
                      const nextLabel = canAdvance ? STAGE_LABEL[STAGES[STAGES.indexOf(stage) + 1]] : '';
                      return (
                        <div key={a.id} className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg ${stage === 'stamped' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                          <span className="font-medium text-slate-700">{a.person_name}{a.person_code ? ` (${a.person_code})` : ''}</span>
                          {a.agency_name && <span className="text-slate-400">· {a.agency_name}</span>}
                          {a.passport_number && <span className="text-slate-400 font-mono">{a.passport_number}</span>}
                          {a.note && a.note.startsWith('Swapped') && <span className="text-amber-600 italic">↻</span>}
                          <span className={`px-1.5 py-0.5 rounded ${STAGE_COLOR[stage]}`}>{STAGE_LABEL[stage]}</span>
                          <div className="ml-auto flex items-center gap-1.5">
                            {canAdvance && <button onClick={() => advanceStage(a)} title={`Advance to ${nextLabel}`} className="text-indigo-600 hover:text-indigo-700 font-medium">→ {nextLabel}</button>}
                            <button onClick={() => { setSwapAlloc(a); setSwapPerson(''); }} title="Swap to another person" className="text-slate-400 hover:text-indigo-600 font-medium">Swap</button>
                            <button onClick={() => removeAlloc(a.id)} title="Remove" className="text-slate-400 hover:text-red-500"><X size={12} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button onClick={() => { setAllocBlock(b); setAllocPerson(''); }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:gap-2 transition-all">
                  <UserPlus size={13} />{bal <= 0 ? 'Allocate (over-subscribed)' : 'Allocate candidate'}
                </button>
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {/* Ewakala tab */}
      {tab === 'ewakala' && (
        ewakalaGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
            <FileCheck size={36} className="text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">No Ewakala to process</p>
            <p className="text-xs text-slate-400">Allocate candidates to a block and agency first — they'll appear here grouped by agency for Ewakala issuing.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ewakalaGroups.map(g => {
              const pending = g.items.filter((a: any) => a.stage === 'ewakala_pending').length;
              const issued = g.items.filter((a: any) => ['ewakala_issued', 'passport_submitted', 'stamped'].includes(a.stage)).length;
              return (
                <div key={g.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{g.agencyName}</p>
                      <p className="text-xs text-slate-400">Block {g.blockNumber}{g.visaType ? ` · ${g.visaType}` : ''} · {g.items.length} candidate(s)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-amber-600">{pending} pending</p>
                        <p className="text-xs text-emerald-600">{issued} issued</p>
                      </div>
                      {pending > 0 && (
                        <button onClick={() => issueEwakalaBatch(g)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><FileCheck size={13} />Issue Ewakala ({pending})</button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {g.items.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs px-2.5 py-1.5 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-700">{a.person_name}</span>
                        {a.passport_number && <span className="text-slate-400 font-mono">{a.passport_number}</span>}
                        <span className={`ml-auto px-1.5 py-0.5 rounded ${STAGE_COLOR[a.stage]}`}>{STAGE_LABEL[a.stage]}</span>
                        {a.ewakala_issued_date && <span className="text-slate-400">{new Date(a.ewakala_issued_date).toLocaleDateString('en-GB')}</span>}
                        {a.stage !== 'ewakala_pending' && a.stage !== 'stamped' && (
                          <button onClick={() => advanceStage(a)} className="text-indigo-600 hover:text-indigo-700 font-medium">→ {STAGE_LABEL[STAGES[STAGES.indexOf(a.stage) + 1]]}</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* QIWA tab — remobilization candidates needing QIWA transfer */}
      {tab === 'qiwa' && (
        qiwaPending.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
            <RefreshCw size={36} className="text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">No QIWA transfers pending</p>
            <p className="text-xs text-slate-400">When you remobilize a work-visa employee via local transfer, they appear here for QIWA processing.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 mb-2">These remobilized employees need a QIWA sponsorship transfer.</p>
            {qiwaPending.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{r.person_name}</span>
                      {r.person_code && <span className="text-xs font-mono text-slate-400">{r.person_code}</span>}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">QIWA Transfer</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Was on {r.original_visa_type} · local transfer</p>
                  </div>
                  <button onClick={() => processQiwa(r)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><RefreshCw size={13} />Mark QIWA Done</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Add visa modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">Add Visa</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2"><label className="text-sm font-medium text-slate-700">Authority / Visa Number</label>
                <input value={f.authority_number} onChange={e => setField('authority_number', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Visa Type</label>
                <input value={f.visa_type} onChange={e => setField('visa_type', e.target.value)} placeholder="Work Visa / TCV" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Quantity</label>
                <input type="number" value={f.total_quantity} onChange={e => setField('total_quantity', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Profession</label>
                <input value={f.profession} onChange={e => setField('profession', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Nationality</label>
                <input value={f.nationality} onChange={e => setField('nationality', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Sponsor Name</label>
                <input value={f.sponsor} onChange={e => setField('sponsor', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Sponsor ID</label>
                <input value={f.sponsor_id} onChange={e => setField('sponsor_id', e.target.value)} placeholder="e.g. 7001234567" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Issue Date</label>
                <input type="date" value={f.issue_date} onChange={e => setField('issue_date', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Expiry Date</label>
                <input type="date" value={f.expiry_date} onChange={e => setField('expiry_date', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={addBlock} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Add Visa</button>
            </div>
          </div>
        </div>
      )}

      {/* Allocate modal */}
      {allocBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAllocBlock(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Allocate Person</h2>
                <p className="text-xs text-slate-400">{allocBlock.authority_number || allocBlock.profession}{allocBlock.nationality ? ` · ${allocBlock.nationality}` : ''} · {balanceOf(allocBlock)} left</p>
              </div>
              <button onClick={() => setAllocBlock(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Visa Block</label>
                <select value={allocBlock.id} onChange={e => { const b = blocks.find(x => x.id === e.target.value); if (b) setAllocBlock(b); }} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {blocks.map(b => <option key={b.id} value={b.id}>{b.authority_number || b.profession || 'Visa'}{b.nationality ? ` · ${b.nationality}` : ''}{b.visa_type ? ` · ${b.visa_type}` : ''} — {balanceOf(b)} left / {b.total_quantity}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Candidate</label>
                <PersonPicker people={people} fields={candFields} value={allocPerson} onChange={setAllocPerson} placeholder="Search by name, ID or passport…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Agency</label>
                  <select value={allocAgency} onChange={e => setAllocAgency(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">— Select agency —</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Visa Type</label>
                  <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-600">{allocBlock.visa_type || 'Work Visa'}</div>
                </div>
              </div>
              <div className="bg-sky-50 border border-sky-100 rounded-xl px-3 py-2 text-xs text-sky-700">
                Over-allocation is allowed — you can assign more candidates than visas across agencies. Only <b>stamping</b> consumes a visa; whoever completes first gets it.
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setAllocBlock(null)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Close</button>
              <button onClick={allocate} disabled={!allocPerson} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Allocate</button>
            </div>
          </div>
        </div>
      )}
      {/* Swap modal */}
      {swapAlloc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSwapAlloc(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Swap Visa</h2>
                <p className="text-xs text-slate-400">Currently held by {swapAlloc.person_name}</p>
              </div>
              <button onClick={() => setSwapAlloc(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-xs text-amber-700">
                This moves the visa to a new person (e.g. the current one is unfit). The visa balance stays the same — no slot is used up. The swap is recorded in the allocation's history.
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">New person</label>
                <PersonPicker people={people} fields={candFields} value={swapPerson} onChange={setSwapPerson} placeholder="Search the replacement by name, ID or passport…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setSwapAlloc(null)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={doSwap} disabled={!swapPerson} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Confirm Swap</button>
            </div>
          </div>
        </div>
      )}
      {/* Stage sync mapping modal */}
      {mapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMapOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Visa ↔ Pipeline Sync</h2>
                <p className="text-xs text-slate-400">Map your candidate stages to visa stages</p>
              </div>
              <button onClick={() => setMapOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {!statusFieldKey ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-xs text-amber-700">
                  No candidate status field detected yet. Upload candidates with a Status/Stage column first, and it'll appear here automatically.
                </div>
              ) : candidateStages.length === 0 ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-xs text-amber-700">
                  No candidate stages found yet. Once candidates have status values, they'll show here to map.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">When a visa reaches a stage below, the candidate's pipeline status updates to your mapped stage.</p>
                    <button onClick={suggestMap} className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:gap-2 transition-all"><Sparkles size={12} />AI Suggest</button>
                  </div>
                  {[['ewakala_issued', 'Ewakala Issued'], ['passport_submitted', 'Passport Submitted'], ['stamped', 'Stamped']].map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700 w-40 flex-shrink-0">{label}</span>
                      <span className="text-slate-300">→</span>
                      <select value={stageMap[key] || ''} onChange={e => saveStageMap({ ...stageMap, [key]: e.target.value })} className="flex-1 border border-slate-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">— No sync —</option>
                        {candidateStages.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  ))}
                  <p className="text-xs text-slate-400">Leave a row as "No sync" and that stage won't change the pipeline. Changes save automatically.</p>
                </>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setMapOpen(false)} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
