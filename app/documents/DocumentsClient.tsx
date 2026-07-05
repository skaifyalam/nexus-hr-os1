'use client';
import { useState, useMemo } from 'react';
import { Plus, X, Upload, Download, Loader, FileText, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import PersonPicker from '@/components/PersonPicker';
import { createClient } from '@/lib/supabase/client';

const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const daysUntil = (d: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

export default function DocumentsClient({ initialDocs, employees, empFields, companyId }: {
  initialDocs: any[]; employees: any[]; empFields: any[]; companyId: string;
}) {
  const [docs, setDocs] = useState(initialDocs);
  const [addOpen, setAddOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const supabase = createClient();

  const nameField = useMemo(() => empFields.find(f => /name/i.test(f.field_label))?.field_key, [empFields]);
  const idField = useMemo(() => empFields.find(f => f.is_id_field)?.field_key, [empFields]);
  const empName = (e: any) => (nameField && e.data?.[nameField]) || e.record_id || 'Unnamed';
  const empCode = (e: any) => (idField && e.data?.[idField]) || e.record_id || '';

  const [fEmp, setFEmp] = useState('');
  const [fType, setFType] = useState('Iqama');
  const [fNumber, setFNumber] = useState('');
  const [fIssue, setFIssue] = useState('');
  const [fExpiry, setFExpiry] = useState('');
  const [fNote, setFNote] = useState('');

  // Group by urgency
  const groups = useMemo(() => {
    const expired: any[] = [], soon: any[] = [], valid: any[] = [], noDate: any[] = [];
    docs.forEach(d => {
      const days = daysUntil(d.expiry_date);
      if (days === null) noDate.push(d);
      else if (days < 0) expired.push(d);
      else if (days <= 60) soon.push(d);
      else valid.push(d);
    });
    return { expired, soon, valid, noDate };
  }, [docs]);

  const addDoc = async () => {
    if (!fEmp || !fType) return;
    const emp = employees.find(e => e.id === fEmp);
    const { data } = await supabase.from('document_records').insert({
      company_id: companyId, employee_record_id: fEmp,
      employee_name: emp ? empName(emp) : '', employee_code: emp ? empCode(emp) : '',
      doc_type: fType, doc_number: fNumber || null, issue_date: fIssue || null, expiry_date: fExpiry || null, note: fNote || null,
    }).select().single();
    if (data) setDocs(p => [...p, data].sort((a, b) => (a.expiry_date || '9999').localeCompare(b.expiry_date || '9999')));
    setFEmp(''); setFType('Iqama'); setFNumber(''); setFIssue(''); setFExpiry(''); setFNote(''); setAddOpen(false);
  };

  const deleteDoc = async (id: string) => {
    await supabase.from('document_records').delete().eq('id', id);
    setDocs(p => p.filter(d => d.id !== id));
  };

  const matchCol = (keys: string[], pats: string[]) => {
    for (const p of pats) { const h = keys.find(k => norm(k) === norm(p)); if (h) return h; }
    for (const p of pats) { const h = keys.find(k => norm(k).includes(norm(p))); if (h) return h; }
    return null;
  };

  const importFile = (file: File) => {
    setImporting(true); setImportMsg('Reading…');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (!rows.length) { setImportMsg('No rows.'); setImporting(false); return; }
        const keys = Object.keys(rows[0]);
        const cName = matchCol(keys, ['employee name', 'name', 'employee']);
        const cCode = matchCol(keys, ['code', 'id', 'employee code']);
        const cType = matchCol(keys, ['document', 'doc type', 'type']);
        const cNum = matchCol(keys, ['number', 'no', 'document number']);
        const cExp = matchCol(keys, ['expiry', 'expiry date', 'expires', 'valid until']);
        const cIss = matchCol(keys, ['issue', 'issue date', 'issued']);
        const toDate = (v: any) => { if (!v) return null; if (v instanceof Date) return v.toISOString().split('T')[0]; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]; };
        const empByName = new Map(employees.map(e => [norm(empName(e)), e]));
        const empByCode = new Map(employees.map(e => [norm(empCode(e)), e]));
        const recs = rows.map(row => {
          const emp = empByCode.get(norm(cCode ? row[cCode] : '')) || empByName.get(norm(cName ? row[cName] : ''));
          return {
            company_id: companyId, employee_record_id: emp?.id || null,
            employee_name: emp ? empName(emp) : (cName ? String(row[cName]) : 'Unknown'),
            employee_code: emp ? empCode(emp) : (cCode ? String(row[cCode]) : ''),
            doc_type: cType ? String(row[cType]) : 'Document',
            doc_number: cNum ? String(row[cNum]) : null,
            issue_date: cIss ? toDate(row[cIss]) : null,
            expiry_date: cExp ? toDate(row[cExp]) : null,
          };
        });
        setImportMsg(`Saving ${recs.length}…`);
        let saved: any[] = [];
        for (let i = 0; i < recs.length; i += 500) {
          const { data } = await supabase.from('document_records').insert(recs.slice(i, i + 500)).select();
          if (data) saved = saved.concat(data);
        }
        setDocs(p => [...p, ...saved].sort((a, b) => (a.expiry_date || '9999').localeCompare(b.expiry_date || '9999')));
        setImportMsg(`Imported ${saved.length} documents.`);
        setTimeout(() => setImportMsg(''), 5000);
      } catch (err: any) { setImportMsg(`Failed: ${err.message}`); }
      setImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const exportFile = () => {
    const rows = docs.map(d => ({ Employee: d.employee_name, Code: d.employee_code, Type: d.doc_type, Number: d.doc_number || '', Issue: d.issue_date || '', Expiry: d.expiry_date || '', Note: d.note || '' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Documents');
    XLSX.writeFile(wb, `documents.xlsx`);
  };

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const DocRow = ({ d, urgency }: { d: any; urgency: 'expired' | 'soon' | 'valid' | 'noDate' }) => {
    const days = daysUntil(d.expiry_date);
    const badge = urgency === 'expired' ? { c: 'bg-red-100 text-red-700', t: `Expired ${Math.abs(days!)}d ago` }
      : urgency === 'soon' ? { c: 'bg-amber-100 text-amber-700', t: `${days}d left` }
      : urgency === 'valid' ? { c: 'bg-emerald-100 text-emerald-700', t: `${days}d left` }
      : { c: 'bg-slate-100 text-slate-500', t: 'No expiry' };
    return (
      <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/50 group">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700">{d.employee_name}</span>
            <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">{d.doc_type}</span>
            {d.doc_number && <span className="text-xs font-mono text-slate-400">{d.doc_number}</span>}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Expires {fmt(d.expiry_date)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full ${badge.c}`}>{badge.t}</span>
          <button onClick={() => deleteDoc(d.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><X size={13} /></button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track Iqama, passport, visa & contract expiry — never miss a renewal</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" id="doc-import" onChange={e => e.target.files?.[0] && importFile(e.target.files[0])} />
          <button onClick={() => document.getElementById('doc-import')?.click()} disabled={importing} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50">{importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}Import</button>
          <button onClick={exportFile} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Download size={14} />Export</button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />Add Document</button>
        </div>
      </div>

      {importMsg && <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-sm text-indigo-700 flex items-center gap-2">{importing && <Loader size={14} className="animate-spin" />}{importMsg}</div>}

      {/* Alert summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle size={15} className="text-red-500" /><span className="text-xs font-medium text-slate-500">Expired</span></div>
          <p className="text-2xl font-bold text-red-600">{groups.expired.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1"><Clock size={15} className="text-amber-500" /><span className="text-xs font-medium text-slate-500">Expiring ≤60 days</span></div>
          <p className="text-2xl font-bold text-amber-600">{groups.soon.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 size={15} className="text-emerald-500" /><span className="text-xs font-medium text-slate-500">Valid</span></div>
          <p className="text-2xl font-bold text-emerald-600">{groups.valid.length}</p>
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
          <FileText size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600 mb-1">No documents tracked yet</p>
          <p className="text-xs text-slate-400">Add documents or import an Excel with expiry dates. We'll alert you before they lapse.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.expired.length > 0 && (
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-100"><p className="text-xs font-semibold text-red-700">⚠ Expired — action needed</p></div>
              <div className="divide-y divide-slate-50">{groups.expired.map(d => <DocRow key={d.id} d={d} urgency="expired" />)}</div>
            </div>
          )}
          {groups.soon.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100"><p className="text-xs font-semibold text-amber-700">Expiring soon (within 60 days)</p></div>
              <div className="divide-y divide-slate-50">{groups.soon.map(d => <DocRow key={d.id} d={d} urgency="soon" />)}</div>
            </div>
          )}
          {groups.valid.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100"><p className="text-xs font-semibold text-slate-600">Valid</p></div>
              <div className="divide-y divide-slate-50">{groups.valid.slice(0, 100).map(d => <DocRow key={d.id} d={d} urgency="valid" />)}</div>
            </div>
          )}
          {groups.noDate.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100"><p className="text-xs font-semibold text-slate-500">No expiry date set</p></div>
              <div className="divide-y divide-slate-50">{groups.noDate.slice(0, 50).map(d => <DocRow key={d.id} d={d} urgency="noDate" />)}</div>
            </div>
          )}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Add Document</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Employee</label>
                <PersonPicker people={employees} fields={empFields} value={fEmp} onChange={setFEmp} placeholder="Search by name or employee ID…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Document type</label>
                  <input value={fType} onChange={e => setFType(e.target.value)} placeholder="Iqama / Passport / Visa" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Number</label>
                  <input value={fNumber} onChange={e => setFNumber(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Issue date</label>
                  <input type="date" value={fIssue} onChange={e => setFIssue(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Expiry date</label>
                  <input type="date" value={fExpiry} onChange={e => setFExpiry(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              </div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Note</label>
                <input value={fNote} onChange={e => setFNote(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={addDoc} disabled={!fEmp || !fType} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
