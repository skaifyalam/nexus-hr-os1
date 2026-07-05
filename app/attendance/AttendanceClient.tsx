'use client';
import { useState, useMemo } from 'react';
import { Plus, X, Upload, Download, Loader, Check, Clock, Calendar, Users, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import PersonPicker from '@/components/PersonPicker';
import { createClient } from '@/lib/supabase/client';

const STATUSES = [
  { v: 'present', label: 'Present', color: 'bg-emerald-100 text-emerald-700' },
  { v: 'absent', label: 'Absent', color: 'bg-red-100 text-red-700' },
  { v: 'leave', label: 'Leave', color: 'bg-amber-100 text-amber-700' },
  { v: 'half_day', label: 'Half Day', color: 'bg-sky-100 text-sky-700' },
  { v: 'remote', label: 'Remote', color: 'bg-violet-100 text-violet-700' },
  { v: 'holiday', label: 'Holiday', color: 'bg-slate-100 text-slate-600' },
];
const statusMeta = (v: string) => STATUSES.find(s => s.v === v) || STATUSES[0];
const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

export default function AttendanceClient({ initialRecords, employees, empFields, companyId, userEmail }: {
  initialRecords: any[]; employees: any[]; empFields: any[]; companyId: string; userEmail: string;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [addOpen, setAddOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const supabase = createClient();

  const nameField = useMemo(() => empFields.find(f => /name/i.test(f.field_label))?.field_key, [empFields]);
  const idField = useMemo(() => empFields.find(f => f.is_id_field)?.field_key, [empFields]);
  const empName = (e: any) => (nameField && e.data?.[nameField]) || e.record_id || 'Unnamed';
  const empCode = (e: any) => (idField && e.data?.[idField]) || e.record_id || '';

  const [fEmp, setFEmp] = useState('');
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  const [fStatus, setFStatus] = useState('present');
  const [fIn, setFIn] = useState('');
  const [fOut, setFOut] = useState('');
  const [fNote, setFNote] = useState('');

  const filtered = records.filter(r => !monthFilter || String(r.date).startsWith(monthFilter));

  const summary = useMemo(() => {
    const s: Record<string, number> = {};
    filtered.forEach(r => { s[r.status] = (s[r.status] || 0) + 1; });
    return s;
  }, [filtered]);

  const addRecord = async () => {
    if (!fEmp || !fDate) return;
    const emp = employees.find(e => e.id === fEmp);
    const { data } = await supabase.from('attendance_records').insert({
      company_id: companyId, employee_record_id: fEmp,
      employee_name: emp ? empName(emp) : '', employee_code: emp ? empCode(emp) : '',
      date: fDate, status: fStatus, check_in: fIn || null, check_out: fOut || null, note: fNote || null,
    }).select().single();
    if (data) setRecords(p => [data, ...p]);
    setFEmp(''); setFStatus('present'); setFIn(''); setFOut(''); setFNote(''); setAddOpen(false);
  };

  const deleteRecord = async (id: string) => {
    await supabase.from('attendance_records').delete().eq('id', id);
    setRecords(p => p.filter(r => r.id !== id));
  };

  const matchCol = (keys: string[], pats: string[]) => {
    for (const p of pats) { const h = keys.find(k => norm(k) === norm(p)); if (h) return h; }
    for (const p of pats) { const h = keys.find(k => norm(k).includes(norm(p))); if (h) return h; }
    return null;
  };

  const importFile = (file: File) => {
    setImporting(true); setImportMsg('Reading file…');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (!rows.length) { setImportMsg('No rows found.'); setImporting(false); return; }
        const keys = Object.keys(rows[0]);
        const cName = matchCol(keys, ['employee name', 'name', 'employee']);
        const cCode = matchCol(keys, ['employee code', 'code', 'id', 'iqama']);
        const cDate = matchCol(keys, ['date', 'day']);
        const cStatus = matchCol(keys, ['status', 'attendance', 'present']);
        const cIn = matchCol(keys, ['check in', 'in time', 'time in', 'in']);
        const cOut = matchCol(keys, ['check out', 'out time', 'time out', 'out']);
        const toDate = (v: any) => { if (!v) return null; if (v instanceof Date) return v.toISOString().split('T')[0]; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]; };
        const empByName = new Map(employees.map(e => [norm(empName(e)), e]));
        const empByCode = new Map(employees.map(e => [norm(empCode(e)), e]));
        const recs = rows.map(row => {
          const emp = empByCode.get(norm(cCode ? row[cCode] : '')) || empByName.get(norm(cName ? row[cName] : ''));
          const raw = cStatus ? String(row[cStatus] || '').toLowerCase() : 'present';
          const status = /absent/.test(raw) ? 'absent' : /leave/.test(raw) ? 'leave' : /half/.test(raw) ? 'half_day' : /remote|wfh/.test(raw) ? 'remote' : /holiday/.test(raw) ? 'holiday' : 'present';
          return {
            company_id: companyId, employee_record_id: emp?.id || null,
            employee_name: emp ? empName(emp) : (cName ? String(row[cName]) : 'Unknown'),
            employee_code: emp ? empCode(emp) : (cCode ? String(row[cCode]) : ''),
            date: (cDate ? toDate(row[cDate]) : null) || new Date().toISOString().split('T')[0],
            status, check_in: cIn ? String(row[cIn]) : null, check_out: cOut ? String(row[cOut]) : null,
          };
        });
        setImportMsg(`Saving ${recs.length}…`);
        let saved: any[] = [];
        for (let i = 0; i < recs.length; i += 500) {
          const { data } = await supabase.from('attendance_records').insert(recs.slice(i, i + 500)).select();
          if (data) saved = saved.concat(data);
        }
        setRecords(p => [...saved, ...p]);
        setImportMsg(`Imported ${saved.length} attendance records.`);
        setTimeout(() => setImportMsg(''), 5000);
      } catch (err: any) { setImportMsg(`Failed: ${err.message}`); }
      setImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const exportFile = () => {
    const rows = filtered.map(r => ({ Employee: r.employee_name, Code: r.employee_code, Date: r.date, Status: r.status, 'Check In': r.check_in || '', 'Check Out': r.check_out || '', Note: r.note || '' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance-${monthFilter}.xlsx`);
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} records this period</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" id="att-import" onChange={e => e.target.files?.[0] && importFile(e.target.files[0])} />
          <button onClick={() => document.getElementById('att-import')?.click()} disabled={importing} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50">{importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}Import</button>
          <button onClick={exportFile} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Download size={14} />Export</button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />Mark Attendance</button>
        </div>
      </div>

      {importMsg && <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-sm text-indigo-700 flex items-center gap-2">{importing && <Loader size={14} className="animate-spin" />}{importMsg}</div>}

      {/* Month filter + summary */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {STATUSES.map(s => summary[s.v] ? (
          <div key={s.v} className={`px-3 py-1.5 rounded-xl text-xs font-medium ${s.color}`}>{s.label}: {summary[s.v]}</div>
        ) : null)}
      </div>

      {/* Records table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
          <Clock size={36} className="text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600 mb-1">No attendance records for this month</p>
          <p className="text-xs text-slate-400">Mark attendance manually or bulk-import from Excel.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Employee</th>
              <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Date</th>
              <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">In / Out</th>
              <th className="w-10"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.slice(0, 200).map(r => (
                <tr key={r.id} className="group hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <p className="text-sm text-slate-700">{r.employee_name}</p>
                    {r.employee_code && <p className="text-xs font-mono text-slate-400">{r.employee_code}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-600">{fmt(r.date)}</td>
                  <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${statusMeta(r.status).color}`}>{statusMeta(r.status).label}</span></td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{r.check_in || '—'} / {r.check_out || '—'}</td>
                  <td className="px-2"><button onClick={() => deleteRecord(r.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"><X size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && <p className="text-xs text-slate-400 px-4 py-2 border-t border-slate-50">Showing first 200. Export for the full list.</p>}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Mark Attendance</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Employee</label>
                <PersonPicker people={employees} fields={empFields} value={fEmp} onChange={setFEmp} placeholder="Search by name or employee ID…" />
                {employees.length === 0 && <p className="text-xs text-amber-600">Upload employees first.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Date</label>
                  <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Status</label>
                  <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {STATUSES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Check In</label>
                  <input type="time" value={fIn} onChange={e => setFIn(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Check Out</label>
                  <input type="time" value={fOut} onChange={e => setFOut(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              </div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Note</label>
                <input value={fNote} onChange={e => setFNote(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={addRecord} disabled={!fEmp || !fDate} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
