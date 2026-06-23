'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { Plus, Search, Trash2, Edit2, Eye, Upload, Sparkles, Loader, X, Check } from 'lucide-react';
import { generateId } from '@/lib/generateId';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';

const today = new Date();
const daysUntil = (d: string) => (d ? Math.ceil((new Date(d).getTime() - today.getTime()) / 86400000) : 999);
const expiryCls = (days: number) =>
  days <= 30 ? 'bg-red-50 text-red-700 border border-red-200'
  : days <= 60 ? 'bg-amber-50 text-amber-700 border border-amber-200'
  : days <= 90 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
  : 'bg-emerald-50 text-emerald-700 border border-emerald-200';

const REQUIRED_FIELDS = [
  'first_name', 'last_name', 'email', 'nationality', 'passport_number',
  'passport_expiry', 'iqama_number', 'iqama_expiry', 'job_title', 'salary', 'joining_date',
];

export default function EmployeesClient({
  initialEmployees, departments, operations, projects,
}: { initialEmployees: any[]; departments: any[]; operations: any[]; projects: any[] }) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [search, setSearch] = useState('');
  const [opFilter, setOpFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mappingLoading, setMappingLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const blank = {
    employee_id: '', first_name: '', last_name: '', email: '', nationality: '',
    passport_number: '', passport_expiry: '', iqama_number: '', iqama_expiry: '',
    job_title: '', department_id: '', operation_id: operations[0]?.id || '', current_project_id: '',
    contract_type: 'direct', salary: '', joining_date: '', status: 'active',
  };
  const [form, setForm] = useState<any>(blank);

  const filtered = employees.filter((e) =>
    (opFilter === 'all' || e.operation_id === opFilter) &&
    (`${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()) || e.employee_id?.includes(search))
  );

  const log = async (action: string, entityId: string, payload: any) => {
    await supabase.from('audit_logs').insert({ entity: 'employees', entity_id: entityId, action, actor: 'current_user', payload });
  };

  const openAdd = () => { setEditing(null); setForm(blank); setModalOpen(true); };
  const openEdit = (e: any) => {
    setEditing(e.id);
    setForm({ ...e, department_id: e.department_id || '', operation_id: e.operation_id || '', current_project_id: e.current_project_id || '' });
    setModalOpen(true);
  };

  const save = async () => {
    const payload = { ...form, salary: Number(form.salary) || null, current_project_id: form.current_project_id || null };
    if (editing) {
      const { data, error } = await supabase.from('employees').update(payload).eq('id', editing)
        .select('*, departments(name), operations(name, country_code), projects(project_code, project_name)').single();
      if (!error && data) {
        setEmployees((p) => p.map((e) => (e.id === editing ? data : e)));
        await log('update', editing, form);
      }
    } else {
      const opCode = operations.find((o) => o.id === form.operation_id)?.country_code || '';
      const deptCode = departments.find((d) => d.id === form.department_id)?.code || '';
      const newId = form.employee_id || await generateId('employee', opCode, deptCode);
      const { data, error } = await supabase.from('employees').insert({ ...payload, employee_id: newId })
        .select('*, departments(name), operations(name, country_code), projects(project_code, project_name)').single();
      if (!error && data) {
        setEmployees((p) => [data, ...p]);
        await log('create', data.id, form);
      }
    }
    setModalOpen(false);
  };

  const del = async (id: string) => {
    await supabase.from('employees').delete().eq('id', id);
    setEmployees((p) => p.filter((e) => e.id !== id));
    await log('delete', id, {});
    setDelId(null);
  };

  // ─── EXCEL IMPORT ─────────────────────────────────────────
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'binary' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      if (rows.length === 0) return;
      setImportRows(rows);
      setImportOpen(true);
      setMappingLoading(true);

      const headers = Object.keys(rows[0]);
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Map these spreadsheet column headers to our employee database fields. Spreadsheet headers: ${JSON.stringify(headers)}. Target fields: ${JSON.stringify(REQUIRED_FIELDS)}. Return ONLY a JSON object mapping each spreadsheet header to the best matching target field, or "ignore" if no good match. Example: {"Emp Name":"first_name","DOB":"ignore"}. Return raw JSON only, no markdown.`,
          }),
        });
        const data = await res.json();
        const cleaned = data.text.replace(/```json|```/g, '').trim();
        setMapping(JSON.parse(cleaned));
      } catch {
        const auto: Record<string, string> = {};
        headers.forEach((h) => {
          const match = REQUIRED_FIELDS.find((f) => f.replace('_', '') === h.toLowerCase().replace(/[\s_]/g, ''));
          auto[h] = match || 'ignore';
        });
        setMapping(auto);
      }
      setMappingLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = async () => {
    setImporting(true);
    const defaultOp = opFilter !== 'all' ? opFilter : operations[0]?.id;
    const records = importRows.map((row, i) => {
      const rec: any = { employee_id: `EMP-IMP-${Date.now()}-${i}`, status: 'active', contract_type: 'direct', operation_id: defaultOp };
      Object.entries(mapping).forEach(([header, field]) => {
        if (field && field !== 'ignore' && row[header] !== undefined) {
          rec[field] = row[header];
        }
      });
      return rec;
    }).filter((r) => r.first_name);

    const { data, error } = await supabase.from('employees').insert(records)
      .select('*, departments(name), operations(name, country_code), projects(project_code, project_name)');
    if (!error && data) {
      setEmployees((p) => [...data, ...p]);
      await log('import', 'bulk', { count: data.length });
    }
    setImporting(false);
    setImportOpen(false);
    setImportRows([]);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      first_name: 'John', last_name: 'Doe', email: 'john@company.com', nationality: 'Indian',
      passport_number: 'P1234567', passport_expiry: '2027-01-01', iqama_number: 'IQ-999999',
      iqama_expiry: '2026-12-01', job_title: 'Engineer', salary: 12000, joining_date: '2026-01-01',
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'nexus-hr-employee-template.xlsx');
  };

  const projectsForForm = projects.filter((p) => p.operation_id === form.operation_id);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Master</h1>
          <p className="text-sm text-slate-500 mt-0.5">{employees.length} employees visible to you · real-time database</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Download Template</button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">
            <Upload size={14} /> Import Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
            <Plus size={14} /> Add Employee
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or ID…" className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {operations.length > 1 && (
            <select value={opFilter} onChange={(e) => setOpFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All Countries</option>
              {operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>
        <table className="w-full">
          <thead><tr className="border-b border-slate-100">{['Employee', 'Country', 'Project', 'Department', 'Iqama Expiry', 'Status', ''].map((h) => <th key={h} className="text-left text-xs font-medium text-slate-500 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((e) => {
              const days = daysUntil(e.iqama_expiry);
              return (
                <tr key={e.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">{e.first_name?.[0]}</div>
                      <div><p className="text-sm font-medium text-slate-900">{e.first_name} {e.last_name}</p><p className="text-xs text-slate-400">{e.employee_id}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {e.operations?.country_code && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{e.operations.country_code}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{e.projects ? `${e.projects.project_code} ${e.projects.project_name}` : '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{e.departments?.name || '—'}</td>
                  <td className="px-4 py-3">{e.iqama_expiry && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${expiryCls(days)}`}>{days}d left</span>}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">{e.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link href={`/employees/${e.id}`} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 inline-block"><Eye size={14} /></Link>
                      <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={14} /></button>
                      <button onClick={() => setDelId(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-sm text-slate-400">No employees found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editing ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {[
                ['first_name', 'First Name'], ['last_name', 'Last Name'], ['email', 'Email'],
                ['nationality', 'Nationality'], ['passport_number', 'Passport Number'], ['job_title', 'Job Title'],
              ].map(([k, l]) => (
                <div key={k} className="space-y-1.5"><label className="text-sm font-medium text-slate-700">{l}</label>
                  <input value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Passport Expiry</label><input type="date" value={form.passport_expiry || ''} onChange={(e) => setForm({ ...form, passport_expiry: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Iqama Number</label><input value={form.iqama_number || ''} onChange={(e) => setForm({ ...form, iqama_number: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Iqama Expiry</label><input type="date" value={form.iqama_expiry || ''} onChange={(e) => setForm({ ...form, iqama_expiry: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>

              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Country / Operation</label>
                <select value={form.operation_id || ''} onChange={(e) => setForm({ ...form, operation_id: e.target.value, current_project_id: '' })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select…</option>
                  {operations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Project (optional)</label>
                <select value={form.current_project_id || ''} onChange={(e) => setForm({ ...form, current_project_id: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">No specific project</option>
                  {projectsForForm.map((p) => <option key={p.id} value={p.id}>{p.project_code} — {p.project_name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Department</label>
                <select value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select…</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Salary (per month)</label><input type="number" value={form.salary || ''} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Joining Date</label><input type="date" value={form.joining_date || ''} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
              <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="active">Active</option><option value="on_leave">On Leave</option><option value="terminated">Terminated</option>
                </select>
              </div>
            </div>
            {editing && (
              <div className="px-6 pb-4">
                <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">
                  Note: changing Country, Project, Department, Job Title, or Salary here is automatically recorded
                  in this employee's permanent history. For a country transfer with a proper checklist
                  (medical, biometric, etc), use "Initiate Transfer" on the employee's profile page instead.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={save} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">{editing ? 'Save Changes' : 'Add Employee'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDelId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete Employee</h2>
            <p className="text-sm text-slate-600 mb-6">This permanently removes the record and its history from the database. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelId(null)} className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={() => del(delId)} className="px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200 rounded-xl">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setImportOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Import {importRows.length} Employees</h2>
              <button onClick={() => setImportOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6">
              {opFilter === 'all' && operations.length > 1 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  No country filter selected — imported employees will be assigned to {operations[0]?.name}. Select a country filter above before importing if you want a different one.
                </p>
              )}
              {mappingLoading ? (
                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <Loader size={16} className="animate-spin text-indigo-500" />
                  <span className="text-sm text-indigo-700">AI is analyzing your column headers…</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5"><Sparkles size={12} className="text-indigo-500" /> AI suggested this mapping — review and adjust before importing</p>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {Object.entries(mapping).map(([header, field]) => (
                      <div key={header} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
                        <span className="text-xs font-medium text-slate-700 w-40 truncate">{header}</span>
                        <span className="text-slate-300">→</span>
                        <select value={field} onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })} className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                          <option value="ignore">Ignore this column</option>
                          {REQUIRED_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setImportOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={confirmImport} disabled={mappingLoading || importing} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                {importing ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                Confirm & Import {importRows.length} Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
