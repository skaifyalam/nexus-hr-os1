'use client';
import { useState, useRef, useMemo } from 'react';
import {
  Plus, X, Search, Upload, Loader, Download, LayoutGrid, Table2,
  Settings, Sparkles, Check, Trash2, Edit2, FileSpreadsheet, GitBranch, Clock, User, RotateCcw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { startApproval } from '@/lib/approvals';
import { createClient } from '@/lib/supabase/client';

export default function UniversalSection({ section, initialFields, initialRecords, initialStageFlows = [], remobs = [], agencies = [], entityMappings = [], companyId, userEmail = '' }: {
  section: any; initialFields: any[]; initialRecords: any[]; initialStageFlows?: any[]; remobs?: any[]; agencies?: any[]; entityMappings?: any[]; companyId: string; userEmail?: string;
}) {
  const [fields, setFields] = useState(initialFields);
  const [records, setRecords] = useState(initialRecords);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'table' | 'kanban' | 'remob'>('table');
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  // The "Review your fields" step: after upload we hold the detected fields + the
  // file here and let the user confirm ID / Status / links / types before importing.
  const [reviewStep, setReviewStep] = useState<null | { file: File; fields: any[] }>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [error, setError] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualBuild, setManualBuild] = useState(false);
  const [mfLabel, setMfLabel] = useState('');
  const [mfType, setMfType] = useState('text');
  const [fieldsPanel, setFieldsPanel] = useState(false);
  const [stageFlows, setStageFlows] = useState<any[]>(initialStageFlows);

  // ─── Entity linking (agency, etc.) ───
  const [agencyList, setAgencyList] = useState<any[]>(agencies);
  const [mappings, setMappings] = useState<any[]>(entityMappings);
  // When an import finds unknown agency values, we collect them here to ask the user.
  const [mapModal, setMapModal] = useState<null | {
    entityType: string; fieldKey: string; unknowns: string[];
    // per-unknown choice: either an existing entity id, or a new name to create
    choices: Record<string, { mode: 'existing' | 'new' | 'skip'; existingId?: string; newName?: string }>;
  }>(null);
  const [mapSaving, setMapSaving] = useState(false);
  const [flowPanel, setFlowPanel] = useState(false);
  const [statusChange, setStatusChange] = useState<{ record: any; newStatus: string } | null>(null);
  const [scDate, setScDate] = useState('');
  const [scRemarks, setScRemarks] = useState('');
  const [historyFor, setHistoryFor] = useState<any>(null);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [activeTab, setActiveTab] = useState<'active' | 'inactive' | 'all'>('all');
  const [activeConfig, setActiveConfig] = useState<{ field: string; values: string[] }>({
    field: section.active_field_key || '',
    values: section.active_values || [],
  });
  const [editFieldId, setEditFieldId] = useState<string | null>(null);
  const [efLabel, setEfLabel] = useState('');
  const [efType, setEfType] = useState('text');
  const [efOptions, setEfOptions] = useState('');
  const [efLinksTo, setEfLinksTo] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const configured = fields.length > 0;
  const [forceSetup, setForceSetup] = useState(false);
  const stageField = useMemo(() =>
    fields.find(f => f.is_status_field) || fields.find(f => /status|stage/i.test(f.field_label)),
  [fields]);
  const idField = useMemo(() => fields.find(f => f.is_id_field), [fields]);
  const nameField = useMemo(() => fields.find(f => /name|title/i.test(f.field_label)) || fields[0], [fields]);

  const stages = useMemo(() => {
    if (stageField?.options?.length > 0) return stageField.options;
    const set = new Set<string>();
    records.forEach(r => { const v = r.data?.[stageField?.field_key]; if (v) set.add(String(v)); });
    return Array.from(set);
  }, [stageField, records]);

  const hasActiveConfig = activeConfig.field && activeConfig.values.length > 0;
  const isActive = (r: any) => {
    if (!hasActiveConfig) return true;
    const val = String(r.data?.[activeConfig.field] ?? '').trim().toLowerCase();
    return activeConfig.values.map(v => String(v).trim().toLowerCase()).includes(val);
  };

  const filtered = records.filter(r => {
    const matchSearch = !search || JSON.stringify(r.data || {}).toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === 'all' || r.data?.[stageField?.field_key] === stageFilter;
    const matchTab = activeTab === 'all' || !hasActiveConfig
      ? true : activeTab === 'active' ? isActive(r) : !isActive(r);
    return matchSearch && matchStage && matchTab;
  });

  const activeCount = hasActiveConfig ? records.filter(isActive).length : records.length;
  const inactiveCount = hasActiveConfig ? records.length - activeCount : 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // ─── STEP 1: Upload template to configure the section ────────
  const analyzeFile = (file: File) => {
    setAnalyzing(true); setError('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const headers = (allRows[0] || []).map((h: any) => String(h).trim()).filter(Boolean);

        if (headers.length === 0) { setError('No column headers found in row 1 of your file.'); setAnalyzing(false); return; }

        const dataRows = allRows.slice(1).filter(r => r.some(c => c !== '' && c != null));
        const sampleRows = dataRows.slice(0, 10).map(r => {
          const o: any = {}; headers.forEach((h: string, i: number) => o[h] = r[i] ?? ''); return o;
        });

        // Compute the COMPLETE set of unique values per column across the WHOLE file,
        // so dropdown fields capture every option (not just what's in the sample rows).
        const uniqueByColumn: Record<string, string[]> = {};
        headers.forEach((h: string, i: number) => {
          const set = new Set<string>();
          for (const r of dataRows) {
            const v = r[i];
            if (v !== '' && v != null) set.add(String(v).trim());
            if (set.size > 100) break; // >100 distinct = free text, not a dropdown
          }
          uniqueByColumn[h] = Array.from(set);
        });

        const res = await fetch('/api/analyze-fields', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headers, sample_rows: sampleRows, unique_by_column: uniqueByColumn, section_key: section.section_key, company_id: companyId }),
        });

        if (!res.ok) {
          const errText = await res.text();
          setError(`Server error (${res.status}): ${errText.slice(0, 200)}`);
          setAnalyzing(false);
          return;
        }

        const data = await res.json();
        if (data.error) { setError(`AI error: ${data.error}`); setAnalyzing(false); return; }
        if (!data.fields || data.fields.length === 0) {
          setError('AI did not detect any fields. Your file headers may be unclear — try "start with blank" and add fields manually.');
          setAnalyzing(false);
          return;
        }

        // Instead of saving + importing immediately, show a Review step so the
        // user can confirm which field is the ID / Status, what links to what, and
        // each field's type. Import happens only after they confirm.
        const detected = data.fields.map((f: any, i: number) => ({
          ...f,
          display_order: f.display_order || i + 1,
          links_to: f.links_to || '',
        }));

        // "Only ask when something changed" rule: if this section is already set up
        // and the incoming columns match the existing fields exactly (same names,
        // same order, no additions/removals), skip the review and import straight away.
        const existing = fields || [];
        const sameName = (a: string, b: string) =>
          String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
        const unchanged =
          existing.length > 0 &&
          detected.length === existing.length &&
          detected.every((d: any, i: number) => sameName(d.field_label, existing[i]?.field_label));

        setAnalyzing(false);
        if (unchanged) {
          // Nothing changed — go straight to importing with the existing fields.
          await importData(file, existing);
          return;
        }
        setReviewStep({ file, fields: detected });
        return;
      } catch (err: any) {
        setError(`Upload failed: ${err.message}`);
      }
      setAnalyzing(false);
    };
    reader.readAsBinaryString(file);
  };

  // Called from the Review step: persist the (possibly user-adjusted) fields,
  // then import the data from the same file.
  const confirmFieldsAndImport = async () => {
    if (!reviewStep) return;
    setReviewSaving(true);
    try {
      // Ensure exactly one ID field and clean rows for insert
      const rows = reviewStep.fields.map((f: any, i: number) => ({
        company_id: companyId, section_key: section.section_key,
        field_key: f.field_key, field_label: f.field_label,
        field_type: f.field_type || 'text', options: f.options || [],
        is_id_field: !!f.is_id_field, id_format: f.is_id_field ? '{SEQ4}' : null,
        required: !!f.required, display_order: f.display_order || i + 1,
        links_to: f.links_to || null, is_status_field: !!f.is_status_field, is_system: false,
      }));
      // Replace the section's non-system fields with the confirmed set
      await supabase.from('section_field_configs')
        .delete().eq('company_id', companyId).eq('section_key', section.section_key).eq('is_system', false);
      const { error: insErr } = await supabase.from('section_field_configs').insert(rows);
      if (insErr) { setError(`Could not save fields: ${insErr.message}`); setReviewSaving(false); return; }
      await supabase.from('company_sections').update({ is_configured: true }).eq('id', section.id);

      const { data: reloaded } = await supabase.from('section_field_configs')
        .select('*').eq('company_id', companyId).eq('section_key', section.section_key).order('display_order');
      const freshFields = (reloaded && reloaded.length > 0) ? reloaded : rows;
      setFields(freshFields);
      setForceSetup(false);
      setManualBuild(false);

      const file = reviewStep.file;
      setReviewStep(null);
      setReviewSaving(false);
      await importData(file, freshFields);
    } catch (err: any) {
      setError(`Setup failed: ${err.message}`);
      setReviewSaving(false);
    }
  };

  // Update one field within the Review step (used by the review UI)
  const updateReviewField = (idx: number, patch: any) => {
    setReviewStep(rs => {
      if (!rs) return rs;
      const fields = rs.fields.map((f, i) => (i === idx ? { ...f, ...patch } : { ...f }));
      if (patch.is_id_field === true) {
        fields.forEach((f, i) => { if (i !== idx) f.is_id_field = false; });
      }
      return { ...rs, fields };
    });
  };

  // ─── Save a record ──────────────────────────────────────────
  const saveRecord = async () => {
    if (editingId) {
      const { data } = await supabase.from('section_records')
        .update({ data: form, updated_at: new Date().toISOString() }).eq('id', editingId).select().single();
      if (data) setRecords(p => p.map(r => r.id === editingId ? data : r));
    } else {
      let recordId = idField ? form[idField.field_key] : null;
      if (idField && !recordId) {
        const { data: idVal } = await supabase.rpc('generate_section_id', { p_section_pk: section.id });
        recordId = idVal; form[idField.field_key] = idVal;
      }
      const { data } = await supabase.from('section_records')
        .insert({ company_id: companyId, section_key: section.section_key, record_id: recordId, data: form }).select().single();
      if (data) {
        setRecords(p => [data, ...p]);
        // Route through approval if a workflow exists for this section's process key
        const title = `New ${section.label} — ${recordId || Object.values(form)[0] || 'record'}`;
        await startApproval({ companyId, processKey: section.section_key, sourceId: data.id, title, requestedBy: userEmail });
      }
    }
    setForm({}); setEditingId(null); setAddOpen(false);
  };

  const editRecord = (r: any) => { setForm(r.data || {}); setEditingId(r.id); setAddOpen(true); };
  const deleteRecord = async (id: string) => {
    await supabase.from('section_records').delete().eq('id', id);
    setRecords(p => p.filter(r => r.id !== id));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(r => r.id)));
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    await supabase.from('section_records').delete().in('id', ids);
    setRecords(p => p.filter(r => !selected.has(r.id)));
    setSelected(new Set());
  };

  const clearAll = async () => {
    await supabase.from('section_records').delete()
      .eq('company_id', companyId).eq('section_key', section.section_key);
    setRecords([]);
    setSelected(new Set());
  };

  const addManualField = async () => {
    if (!mfLabel.trim()) return;
    const fieldKey = mfLabel.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-3);
    const { data } = await supabase.from('section_field_configs').insert({
      company_id: companyId,
      section_key: section.section_key,
      field_key: fieldKey,
      field_label: mfLabel.trim(),
      field_type: mfType,
      is_id_field: mfType === 'id_field',
      display_order: fields.length + 1,
    }).select().single();
    if (data) setFields(p => [...p, data]);
    await supabase.from('company_sections').update({ is_configured: true }).eq('id', section.id);
    setMfLabel(''); setMfType('text');
  };

  // Key used to remember a deleted field's setup, so if the same column comes
  // back in a later import it returns with its type / link / position intact.
  const fieldMemoryKey = (label: string) =>
    `${section.section_key}::${String(label).toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  const deleteField = async (id: string) => {
    const f = fields.find(x => x.id === id);
    // Remember what this field WAS before removing it.
    if (f) {
      const memo = JSON.stringify({
        field_type: f.field_type, options: f.options || [],
        links_to: f.links_to || null, is_id_field: f.is_id_field || false,
        id_format: f.id_format || null, display_order: f.display_order || null,
      });
      const key = fieldMemoryKey(f.field_label);
      await supabase.from('entity_mappings')
        .delete().eq('company_id', companyId).eq('entity_type', '_field_memory').eq('excel_value', key);
      await supabase.from('entity_mappings').insert({
        company_id: companyId, entity_type: '_field_memory',
        excel_value: key, mapped_name: memo,
      });
    }
    await supabase.from('section_field_configs').delete().eq('id', id);
    setFields(p => p.filter(x => x.id !== id));
  };

  const saveActiveConfig = async (field: string, values: string[]) => {
    setActiveConfig({ field, values });
    await supabase.from('company_sections')
      .update({ active_field_key: field || null, active_values: values })
      .eq('id', section.id);
  };

  // ─── Stage tracking ─────────────────────────────────────────
  const remarksField = useMemo(() => fields.find(f => /remark|comment|note/i.test(f.field_label)), [fields]);
  const dateFields = useMemo(() => fields.filter(f => f.field_type === 'date'), [fields]);

  // Returns the date for a record's CURRENT stage — only if mapped in Stage Flow
  const stageDateFor = (r: any) => {
    const status = r.data?.[stageField?.field_key];
    if (!status) return null;
    const flow = stageFlows.find(f => f.status_value === status);
    if (flow?.date_field_key) {
      const v = r.data?.[flow.date_field_key];
      if (v) return v;
    }
    return null;
  };

  const fmtDate = (v: any) => {
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Called when a status value changes anywhere (inline or kanban)
  // Detect agency-linked columns with values not yet recognised, and prompt to map.
  const detectUnknownLinks = (importedRecords: any[]) => {
    const agencyField = fields.find((f: any) => f.links_to === 'agency');
    if (!agencyField) return;
    const knownNames = new Set(agencyList.map(a => String(a.name).trim().toLowerCase()));
    const mapped = new Set(mappings.filter(m => m.entity_type === 'agency').map(m => String(m.excel_value).trim().toLowerCase()));
    const unknowns = new Set<string>();
    importedRecords.forEach(r => {
      const v = r.data?.[agencyField.field_key];
      if (!v) return;
      const key = String(v).trim().toLowerCase();
      if (!knownNames.has(key) && !mapped.has(key)) unknowns.add(String(v).trim());
    });
    if (unknowns.size === 0) return;
    const choices: any = {};
    Array.from(unknowns).forEach(u => { choices[u] = { mode: 'new', newName: u }; });
    setMapModal({ entityType: 'agency', fieldKey: agencyField.field_key, unknowns: Array.from(unknowns), choices });
  };

  // Save the user's agency mappings: create new agencies where chosen, and record
  // every mapping so future imports link automatically.
  const saveMappings = async () => {
    if (!mapModal) return;
    setMapSaving(true);
    const newMappingRows: any[] = [];
    const createdAgencies: any[] = [];
    for (const val of mapModal.unknowns) {
      const choice = mapModal.choices[val];
      if (!choice || choice.mode === 'skip') continue;
      let mappedId: string | null = null;
      let mappedName = '';
      if (choice.mode === 'existing' && choice.existingId) {
        mappedId = choice.existingId;
        mappedName = agencyList.find(a => a.id === choice.existingId)?.name || val;
      } else if (choice.mode === 'new') {
        const name = (choice.newName || val).trim();
        const existing = agencyList.find(a => String(a.name).trim().toLowerCase() === name.toLowerCase());
        if (existing) { mappedId = existing.id; mappedName = existing.name; }
        else {
          const { data: newAg } = await supabase.from('agencies')
            .insert({ company_id: companyId, name, status: 'active' }).select().single();
          if (newAg) { mappedId = newAg.id; mappedName = newAg.name; createdAgencies.push(newAg); }
        }
      }
      if (mappedId) {
        newMappingRows.push({ company_id: companyId, entity_type: 'agency', excel_value: val, mapped_id: mappedId, mapped_name: mappedName });
      }
    }
    if (newMappingRows.length > 0) {
      // Remove any existing mappings for these same excel values first (so re-mapping
      // updates cleanly), then insert. Avoids ON CONFLICT constraint mismatch.
      const valsToMap = newMappingRows.map(m => m.excel_value);
      await supabase.from('entity_mappings')
        .delete().eq('company_id', companyId).eq('entity_type', 'agency').in('excel_value', valsToMap);
      const { data: savedMaps, error: mapErr } = await supabase.from('entity_mappings')
        .insert(newMappingRows).select();
      if (mapErr) {
        alert(`Could not save the agency links: ${mapErr.message}`);
        setMapSaving(false);
        return;
      }
      if (savedMaps) setMappings(p => [...p, ...savedMaps]);
    }
    if (createdAgencies.length > 0) setAgencyList(p => [...p, ...createdAgencies]);
    setMapSaving(false);
    setMapModal(null);
  };

  const requestStatusChange = (record: any, newStatus: string) => {
    if (!stageField) return;
    const current = record.data?.[stageField.field_key];
    if (current === newStatus) return;
    setScDate(new Date().toISOString().split('T')[0]);
    setScRemarks('');
    setStatusChange({ record, newStatus });
  };

  const confirmStatusChange = async () => {
    if (!statusChange || !stageField) return;
    const { record, newStatus } = statusChange;
    const fromStatus = record.data?.[stageField.field_key] || null;

    const newData = { ...record.data, [stageField.field_key]: newStatus };

    // Auto-fill mapped date field if this status has one
    const flow = stageFlows.find(f => f.status_value === newStatus);
    if (flow?.date_field_key && scDate) {
      newData[flow.date_field_key] = scDate;
    }
    // Append remarks to the remarks field if present
    if (scRemarks && remarksField) {
      newData[remarksField.field_key] = scRemarks;
    }

    const { data: updated } = await supabase.from('section_records')
      .update({ data: newData, updated_at: new Date().toISOString() })
      .eq('id', record.id).select().single();
    if (updated) setRecords(p => p.map(r => r.id === record.id ? updated : r));

    // Reverse visa sync: if this is a candidate and the new status maps to a visa stage,
    // advance their visa allocation to match (fire-and-forget).
    if (section.section_key === 'candidate') {
      fetch('/api/sync-visa-stage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personRecordId: record.id, newStatus }),
      }).catch(() => {});
    }

    // Log to history
    await supabase.from('stage_history').insert({
      company_id: companyId,
      section_key: section.section_key,
      record_pk: record.id,
      record_id: record.record_id || record.data?.[idField?.field_key] || '',
      from_status: fromStatus,
      to_status: newStatus,
      change_date: scDate || new Date().toISOString().split('T')[0],
      remarks: scRemarks || null,
      changed_by: userEmail,
    });

    setStatusChange(null);
  };

  const openHistory = async (record: any) => {
    setHistoryFor(record);
    const { data } = await supabase.from('stage_history')
      .select('*').eq('record_pk', record.id).order('created_at', { ascending: false });
    setHistoryRows(data || []);
  };

  // Save a status→date mapping
  const saveFlow = async (statusValue: string, dateFieldKey: string | null) => {
    const existing = stageFlows.find(f => f.status_value === statusValue);
    if (existing) {
      const { data } = await supabase.from('stage_flows')
        .update({ date_field_key: dateFieldKey }).eq('id', existing.id).select().single();
      if (data) setStageFlows(p => p.map(f => f.id === existing.id ? data : f));
    } else {
      const { data } = await supabase.from('stage_flows').insert({
        company_id: companyId, section_key: section.section_key,
        status_value: statusValue, date_field_key: dateFieldKey,
      }).select().single();
      if (data) setStageFlows(p => [...p, data]);
    }
  };

  const startEditField = (f: any) => {
    setEditFieldId(f.id); setEfLabel(f.field_label); setEfType(f.field_type);
    setEfOptions((f.options || []).join('\n'));
    setEfLinksTo(f.links_to || '');
  };

  const saveFieldEdit = async () => {
    if (!editFieldId) return;
    const opts = efType === 'dropdown' ? efOptions.split('\n').map(o => o.trim()).filter(Boolean) : [];
    const { data } = await supabase.from('section_field_configs').update({
      field_label: efLabel,
      field_type: efType,
      is_id_field: efType === 'id_field',
      options: opts,
      id_format: efType === 'id_field' ? '{SEQ4}' : null,
      links_to: efLinksTo || null,
    }).eq('id', editFieldId).select().single();
    if (data) setFields(p => p.map(f => f.id === editFieldId ? data : f));
    setEditFieldId(null);
    // If this field was just marked as an agency link, check existing records for
    // unknown agency values so the user can map them right away.
    if (efLinksTo === 'agency') {
      const updatedFields = fields.map(f => f.id === editFieldId ? { ...f, links_to: 'agency' } : f);
      const agencyField = updatedFields.find((f: any) => f.links_to === 'agency');
      if (agencyField) {
        const knownNames = new Set(agencyList.map(a => String(a.name).trim().toLowerCase()));
        const mapped = new Set(mappings.filter(m => m.entity_type === 'agency').map(m => String(m.excel_value).trim().toLowerCase()));
        const unknowns = new Set<string>();
        records.forEach(r => {
          const v = r.data?.[agencyField.field_key];
          if (!v) return;
          const key = String(v).trim().toLowerCase();
          if (!knownNames.has(key) && !mapped.has(key)) unknowns.add(String(v).trim());
        });
        if (unknowns.size > 0) {
          const choices: any = {};
          Array.from(unknowns).forEach(u => { choices[u] = { mode: 'new', newName: u }; });
          setMapModal({ entityType: 'agency', fieldKey: agencyField.field_key, unknowns: Array.from(unknowns), choices });
        }
      }
    }
  };

  // ─── Bulk import data ───────────────────────────────────────
  // Convert an Excel date serial number to a YYYY-MM-DD string.
  // Excel epoch starts 1899-12-30; serial 25569 = 1970-01-01. Uses UTC to avoid
  // timezone off-by-one. Only used for fields typed as 'date'.
  const excelSerialToISODate = (serial: number): string => {
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return String(serial);
    return d.toISOString().split('T')[0];
  };

  const importData = (file: File, explicitFields?: any[]) => {
    const activeFields = explicitFields || fields;
    setImporting(true); setImportMsg('Importing your data…');
    return new Promise<void>((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'binary' });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const valid = rows.filter(r => Object.values(r).some(v => v !== ''));

      // Normalize for fuzzy matching: lowercase, strip punctuation & extra spaces
      const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

      // AUTO-ADD NEW COLUMNS: if the Excel has a column that doesn't match any
      // existing field, create it as a new field automatically (so re-imports with
      // an extra/restored column bring their data in, instead of silently dropping it).
      let workingFields = [...activeFields];
      if (valid.length > 0) {
        const excelHeaders = Object.keys(valid[0]).filter(h => h && h.trim());

        // What did these columns look like before they were deleted?
        const { data: memoryRows } = await supabase.from('entity_mappings')
          .select('excel_value, mapped_name')
          .eq('company_id', companyId).eq('entity_type', '_field_memory');
        const memory = new Map<string, any>();
        (memoryRows || []).forEach((m: any) => {
          try { memory.set(m.excel_value, JSON.parse(m.mapped_name)); } catch {}
        });

        // Work out a column's type from its real values, rather than assuming text.
        const inferType = (header: string) => {
          const vals: any[] = [];
          for (const row of valid) {
            const v = row[header];
            if (v !== '' && v != null) vals.push(v);
            if (vals.length > 200) break;
          }
          if (vals.length === 0) return { field_type: 'text', options: [] };
          const distinct = Array.from(new Set(vals.map(v => String(v).trim())));
          // Excel dates arrive as serial numbers in a plausible date range
          const looksDate = vals.every(v => typeof v === 'number' && v > 20000 && v < 60000);
          if (looksDate) return { field_type: 'date', options: [] };
          // A small, repeating set of values is a dropdown
          if (distinct.length > 1 && distinct.length <= 25 && vals.length >= distinct.length * 2) {
            return { field_type: 'dropdown', options: distinct };
          }
          return { field_type: 'text', options: [] };
        };

        const newFieldsToCreate: any[] = [];
        for (const header of excelHeaders) {
          const matches = workingFields.some((f: any) =>
            f.field_label.trim().toLowerCase() === header.trim().toLowerCase() ||
            norm(f.field_label) === norm(header) ||
            norm(f.field_label).includes(norm(header)) || norm(header).includes(norm(f.field_label))
          );
          if (matches) continue;

          const remembered = memory.get(fieldMemoryKey(header));
          const inferred = remembered
            ? { field_type: remembered.field_type || 'text', options: remembered.options || [] }
            : inferType(header);
          const fieldKey = norm(header).replace(/\s/g, '_') || `field_${Date.now()}`;
          newFieldsToCreate.push({
            company_id: companyId, section_key: section.section_key,
            field_key: fieldKey, field_label: header.trim(),
            field_type: inferred.field_type, options: inferred.options,
            is_id_field: remembered?.is_id_field || false,
            id_format: remembered?.id_format || null,
            links_to: remembered?.links_to || null,
            required: false,
            // Position it where it sits in the Excel
            display_order: excelHeaders.indexOf(header) + 1,
            is_system: false,
          });
        }

        if (newFieldsToCreate.length > 0) {
          setImportMsg(`Adding ${newFieldsToCreate.length} field(s) back from your file…`);
          const { data: createdFields, error: cfErr } = await supabase.from('section_field_configs')
            .insert(newFieldsToCreate).select();
          if (cfErr) { setError(`Could not add new columns: ${cfErr.message}`); }
          if (createdFields && createdFields.length > 0) {
            workingFields = [...workingFields, ...createdFields];
          }
        }

        // Put every field back in the file's column order. Fields not in the file
        // (e.g. a Status column the app added for stages) keep their place at the end.
        const orderOf = (f: any) => {
          const i = excelHeaders.findIndex(h =>
            h.trim().toLowerCase() === f.field_label.trim().toLowerCase() || norm(h) === norm(f.field_label)
          );
          return i === -1 ? 900 + (f.display_order || 0) : i + 1;
        };
        const reordered = [...workingFields].sort((a, b) => orderOf(a) - orderOf(b));
        const needsRenumber = reordered.some((f, i) => f.display_order !== i + 1);
        if (needsRenumber) {
          await Promise.all(reordered.map((f, i) =>
            supabase.from('section_field_configs').update({ display_order: i + 1 }).eq('id', f.id)
          ));
          workingFields = reordered.map((f, i) => ({ ...f, display_order: i + 1 }));
        }
        setFields(workingFields);
      }

      const newRecords = [];
      for (const row of valid) {
        const data: any = {};
        const rowKeys = Object.keys(row);
        workingFields.forEach((f: any) => {
          // Try exact match first, then fuzzy match on normalized strings
          let mk = rowKeys.find(k => k.trim().toLowerCase() === f.field_label.trim().toLowerCase());
          if (!mk) mk = rowKeys.find(k => norm(k) === norm(f.field_label));
          if (!mk) mk = rowKeys.find(k => norm(k).includes(norm(f.field_label)) || norm(f.field_label).includes(norm(k)));
          if (mk && row[mk] !== '') {
            let cellValue = row[mk];
            if (f.field_type === 'date' && typeof cellValue === 'number') {
              cellValue = excelSerialToISODate(cellValue);
            }
            data[f.field_key] = cellValue;
          }
        });
        const activeIdField = workingFields.find((f: any) => f.is_id_field);
        let recordId = activeIdField ? data[activeIdField.field_key] : null;
        if (activeIdField && !recordId) {
          const { data: idVal } = await supabase.rpc('generate_section_id', { p_section_pk: section.id });
          recordId = idVal; data[activeIdField.field_key] = idVal;
        }
        newRecords.push({ company_id: companyId, section_key: section.section_key, record_id: recordId, data });
      }
      if (newRecords.length > 0) {
        // UPSERT: update existing records (matched by record_id), insert new ones
        const existingById = new Map(records.filter(r => r.record_id).map(r => [String(r.record_id).trim(), r]));
        const toInsert: any[] = [];
        const toUpdate: { id: string; data: any }[] = [];

        for (const nr of newRecords) {
          const match = nr.record_id ? existingById.get(String(nr.record_id).trim()) : null;
          if (match) {
            const merged = { ...match.data, ...nr.data };
            toUpdate.push({ id: match.id, data: merged });
          } else {
            toInsert.push(nr);
          }
        }

        // Run updates in PARALLEL BATCHES (was one-by-one sequential — far too slow
        // for large update files, e.g. 10k rows). Each batch fires many updates at
        // once, and we wait per batch to avoid overwhelming the connection.
        const updatedList: any[] = [];
        if (toUpdate.length > 0) {
          setImportMsg(`Updating ${toUpdate.length} records…`);
          const BATCH = 50;
          for (let i = 0; i < toUpdate.length; i += BATCH) {
            const slice = toUpdate.slice(i, i + BATCH);
            const results = await Promise.all(slice.map(u =>
              supabase.from('section_records')
                .update({ data: u.data, updated_at: new Date().toISOString() })
                .eq('id', u.id).select().single()
            ));
            results.forEach(r => { if (r.data) updatedList.push(r.data); });
            setImportMsg(`Updating records… ${Math.min(i + BATCH, toUpdate.length)}/${toUpdate.length}`);
          }
        }

        let inserted: any[] = [];
        if (toInsert.length > 0) {
          setImportMsg(`Adding ${toInsert.length} new records…`);
          // Insert in batches too (very large single inserts can time out)
          const BATCH = 500;
          for (let i = 0; i < toInsert.length; i += BATCH) {
            const { data } = await supabase.from('section_records').insert(toInsert.slice(i, i + BATCH)).select();
            if (data) inserted = inserted.concat(data);
          }
        }

        setRecords(p => {
          const updMap = new Map(updatedList.map(u => [u.id, u]));
          const merged = p.map(r => updMap.get(r.id) || r);
          return [...inserted, ...merged];
        });

        // After importing, check any agency-linked column for values we don't
        // recognise (not an existing agency, not already mapped) and ask the user.
        detectUnknownLinks([...inserted, ...updatedList]);
      }
      setImporting(false);
      setImportMsg('');
      resolve();
    };
    reader.readAsBinaryString(file);
    });
  };

  // ─── Export in original template format ─────────────────────
  const exportData = () => {
    const headers = fields.map(f => f.field_label);
    const rows = records.map(r => fields.map(f => r.data?.[f.field_key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, section.label);
    XLSX.writeFile(wb, `${section.label.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const updateStage = async (recId: string, newStage: string) => {
    const rec = records.find(r => r.id === recId);
    const newData = { ...rec.data, [stageField.field_key]: newStage };
    const { data } = await supabase.from('section_records').update({ data: newData }).eq('id', recId).select().single();
    if (data) setRecords(p => p.map(r => r.id === recId ? data : r));
  };

  const renderInput = (f: any) => {
    const val = form[f.field_key] ?? '';
    const base = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
    if (f.field_type === 'dropdown' && f.options?.length > 0)
      return <select value={val} onChange={e => setForm({ ...form, [f.field_key]: e.target.value })} className={`${base} bg-white`}><option value="">Select…</option>{f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>;
    if (f.field_type === 'boolean')
      return <button type="button" onClick={() => setForm({ ...form, [f.field_key]: !val })} className={`px-4 py-2.5 rounded-xl border text-sm ${val ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200'}`}>{val ? '✓ Yes' : 'No'}</button>;
    return <input type={f.field_type === 'date' ? 'date' : f.field_type === 'number' ? 'number' : 'text'} value={val} onChange={e => setForm({ ...form, [f.field_key]: e.target.value })} className={base} />;
  };

  // First 7 fields, but ALWAYS include the stage/status field (even if it's column 11 of 24)
  const tableFields = (() => {
    const base = fields.slice(0, 7);
    if (stageField && !base.find(f => f.id === stageField.id)) {
      return [...fields.slice(0, 6), stageField];
    }
    return base;
  })();

  // ═══ EMPTY STATE — section not configured yet ═══════════════
  if (!configured || forceSetup) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{section.label}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Set up this section by uploading your Excel — AI builds it to match your structure</p>
          {forceSetup && configured && (
            <button onClick={() => setForceSetup(false)} className="text-xs text-indigo-600 hover:underline mt-2">← Back to existing data ({fields.length} fields)</button>
          )}
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>}
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          {analyzing ? (
            <div className="py-6">
              <div className="flex gap-2 justify-center mb-4">{[0,1,2,3].map(i => <div key={i} className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.12}s` }} />)}</div>
              <p className="text-sm font-medium text-slate-600">AI is reading your file and building this section…</p>
              <p className="text-xs text-slate-400 mt-1">Detecting columns, types, dropdowns, and ID patterns</p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet size={24} className="text-indigo-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">Upload your Excel to build this section</h3>
              <p className="text-sm text-slate-500 mb-5 max-w-md mx-auto">AI reads your column headers and automatically creates the right fields, dropdowns, and ID format — in your exact structure.</p>
              <button onClick={() => uploadRef.current?.click()} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
                <Upload size={15} />Upload Excel File
              </button>
              <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && analyzeFile(e.target.files[0])} />
              <p className="text-xs text-slate-400 mt-4">Or <button onClick={() => setManualBuild(true)} className="text-indigo-600 hover:underline">build fields manually</button> without a file</p>
            </>
          )}
        </div>

        {/* Manual field builder */}
        {manualBuild && (
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-5 mt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Your First Field</h3>
            <p className="text-xs text-slate-500 mb-4">Name your own fields — nothing is preset. Add as many as you need.</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Field Name</label>
                <input value={mfLabel} onChange={e => setMfLabel(e.target.value)} placeholder="e.g. Passport No" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Type</label>
                <select value={mfType} onChange={e => setMfType(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {['text','number','date','email','phone','dropdown','boolean','id_field'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={addManualField} disabled={!mfLabel.trim()} className="w-full px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">Add Field</button>
              </div>
            </div>
            {fields.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                {fields.map(f => (
                  <span key={f.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs text-slate-700">
                    {f.field_label} <span className="text-slate-400">({f.field_type})</span>
                    <button onClick={() => deleteField(f.id)} className="text-slate-400 hover:text-red-500"><X size={11} /></button>
                  </span>
                ))}
                <button onClick={() => setManualBuild(false)} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium ml-2">Done ({fields.length} fields)</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══ CONFIGURED — full section UI ═══════════════════════════
  return (
    <div>
      {/* ── Review your fields (after upload, before import) ── */}
      {reviewStep && (
        <div className="fixed inset-0 z-[70] bg-slate-50 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900">Review your fields</h1>
              <p className="text-sm text-slate-500 mt-1">We read your file and set up these columns. Please check them — mark which one is the ID, which shows the status/stage, and whether any column links to your Agencies, Projects, Countries, Departments, or Companies. Then continue.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500">
                <div className="col-span-3">Column</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Is ID?</div>
                <div className="col-span-2">Is Status?</div>
                <div className="col-span-3">Links to</div>
              </div>
              {reviewStep.fields.map((f: any, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-50 items-center">
                  <div className="col-span-3">
                    <input value={f.field_label} onChange={e => updateReviewField(idx, { field_label: e.target.value })}
                      className="w-full text-sm font-medium text-slate-800 border border-transparent hover:border-slate-200 focus:border-indigo-400 rounded px-1.5 py-1 focus:outline-none" />
                  </div>
                  <div className="col-span-2">
                    <select value={f.field_type} onChange={e => updateReviewField(idx, { field_type: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="dropdown">Dropdown</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <button type="button" onClick={() => updateReviewField(idx, { is_id_field: !f.is_id_field })}
                      className={`px-2.5 py-1 rounded-lg text-xs border ${f.is_id_field ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-slate-200 text-slate-500'}`}>
                      {f.is_id_field ? '✓ ID' : 'Set ID'}
                    </button>
                  </div>
                  <div className="col-span-2">
                    <button type="button" onClick={() => updateReviewField(idx, { is_status_field: !f.is_status_field })}
                      className={`px-2.5 py-1 rounded-lg text-xs border ${f.is_status_field ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-slate-200 text-slate-500'}`}>
                      {f.is_status_field ? '✓ Status' : 'Set Status'}
                    </button>
                  </div>
                  <div className="col-span-3">
                    <select value={f.links_to || ''} onChange={e => updateReviewField(idx, { links_to: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                      <option value="">— Not linked —</option>
                      <option value="agency">Agency</option>
                      <option value="project">Project</option>
                      <option value="country">Country</option>
                      <option value="department">Department</option>
                      <option value="company">Company</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6">
              <button onClick={() => { setReviewStep(null); }} className="px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={confirmFieldsAndImport} disabled={reviewSaving}
                className="px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">
                {reviewSaving ? 'Setting up…' : 'Looks good — import my data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(analyzing || importing) && (
        <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center">
          <div className="mt-3 flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-lg">
            <Loader size={15} className="animate-spin" />
            {analyzing ? 'Reading your file and setting up fields…' : (importMsg || 'Importing your data…')}
          </div>
        </div>
      )}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{section.label}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{records.length} records · {fields.length} fields</p>
        </div>
        <div className="flex gap-2">
          {records.length > 0 && (
            <button onClick={() => { if (confirm(`Delete ALL ${records.length} records in ${section.label}? This cannot be undone.`)) clearAll(); }} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-red-200 rounded-xl text-red-600 hover:bg-red-50"><Trash2 size={14} />Clear All</button>
          )}
          <button onClick={() => setFieldsPanel(true)} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Settings size={14} />Fields</button>
          {stageField && <button onClick={() => setFlowPanel(true)} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><GitBranch size={14} />Stage Flow</button>}
          <button onClick={exportData} className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50"><Download size={14} />Export</button>
          <button onClick={() => importRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">{importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}Import</button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && importData(e.target.files[0])} />
          <button onClick={() => { setForm({}); setEditingId(null); setAddOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200"><Plus size={14} />Add Record</button>
        </div>
      </div>

      {hasActiveConfig && (
        <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit">
          {[
            { k: 'active' as const, label: 'Active', count: activeCount },
            { k: 'inactive' as const, label: 'Inactive', count: inactiveCount },
            { k: 'all' as const, label: 'All', count: records.length },
          ].map(t => (
            <button key={t.k} onClick={() => { setActiveTab(t.k); setPage(0); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === t.k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label} <span className={activeTab === t.k ? 'text-slate-400' : 'text-slate-400'}>({t.count})</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search all fields…" className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
        </div>
        {stageField && stages.length > 0 && (
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700">
            <option value="all">All {stageField.field_label}</option>
            {stages.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {stageField && (
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${view === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}><Table2 size={13} />Table</button>
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${view === 'kanban' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}><LayoutGrid size={13} />Kanban</button>
            {remobs.length > 0 && (
              <button onClick={() => setView('remob')} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${view === 'remob' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}><RotateCcw size={13} />Remobilization ({remobs.length})</button>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-600 text-white rounded-xl px-4 py-2.5 mb-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-medium transition-colors">
            <Trash2 size={13} />Delete Selected
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-indigo-100 hover:text-white ml-auto">Clear selection</button>
        </div>
      )}

      {view === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-100">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleSelectAll} className="rounded cursor-pointer" />
                </th>
                {tableFields.map(f => <th key={f.id} className="text-left text-xs font-medium text-slate-500 px-4 py-3 whitespace-nowrap">{f.field_label}</th>)}
                <th className="px-4 py-3" />
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {paged.map(r => (
                  <tr key={r.id} className={`hover:bg-slate-50/50 group ${selected.has(r.id) ? 'bg-indigo-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded cursor-pointer" />
                    </td>
                    {tableFields.map(f => (
                      <td key={f.id} className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {f.id === stageField?.id && stages.length > 0 ? (
                          <div>
                            <select
                              value={r.data?.[f.field_key] || ''}
                              onChange={e => requestStatusChange(r, e.target.value)}
                              className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[180px]"
                            >
                              <option value="">—</option>
                              {stages.map((s: string) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {stageDateFor(r) ? <p className="text-xs text-slate-400 mt-1">📅 {fmtDate(stageDateFor(r))}</p> : <p className="text-xs text-slate-300 mt-1">No date</p>}
                          </div>
                        ) : f.is_id_field ? <span className="font-mono text-xs text-slate-400">{r.data?.[f.field_key]}</span>
                         : f.field_type === 'boolean' ? (r.data?.[f.field_key] ? '✓' : '—')
                         : (section.section_key === 'employee' && f.id === nameField?.id)
                           ? <a href={`/employee/${r.id}`} className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium">{r.data?.[f.field_key] || '—'}</a>
                         : String(r.data?.[f.field_key] || '—')}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {section.section_key === 'employee' && <a href={`/employee/${r.id}`} title="View 360 profile" className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><User size={13} /></a>}
                        {stageField && <button onClick={() => openHistory(r)} title="Stage history" className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Clock size={13} /></button>}
                        <button onClick={() => editRecord(r)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={13} /></button>
                        <button onClick={() => deleteRecord(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={tableFields.length + 2} className="text-center py-10 text-sm text-slate-400">No records — add one or import your Excel</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-50">
            <p className="text-xs text-slate-400">
              Showing {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} records
              {fields.length > 7 && <span> · 7 of {fields.length} fields (all in export & edit)</span>}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50">← Prev</button>
                <span className="text-xs text-slate-400 px-1">Page {safePage + 1} / {totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1} className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50">Next →</button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'kanban' && stageField && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage: string) => {
            const cols = filtered.filter(r => r.data?.[stageField.field_key] === stage);
            return (
              <div key={stage} className="flex-shrink-0 w-56">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-slate-600">{stage}</span>
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{cols.length}</span>
                </div>
                <div className="space-y-2">
                  {cols.map(r => (
                    <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
                      <p className="text-xs font-semibold text-slate-800">{r.data?.[nameField?.field_key] || 'Untitled'}</p>
                      {idField && <p className="text-xs text-slate-400 font-mono mt-0.5">{r.data?.[idField.field_key]}</p>}
                      {stageDateFor(r) ? <p className="text-xs text-indigo-500 mt-1">📅 {fmtDate(stageDateFor(r))}</p> : <p className="text-xs text-slate-300 mt-1">No date</p>}
                      <select value={stage} onChange={e => requestStatusChange(r, e.target.value)} className="mt-2 w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
                        {stages.map((s: string) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Remobilization tracking tab (view-only) */}
      {view === 'remob' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Tracking view — remobilized people and their visa/QIWA progress. Main entries are managed in Conduct & Exit and Visa Management.</p>
          {remobs.map((r: any) => {
            const statusColor: any = {
              pending: 'bg-amber-50 text-amber-700', visa_allocated: 'bg-sky-50 text-sky-700',
              qiwa_allocated: 'bg-sky-50 text-sky-700', completed: 'bg-emerald-50 text-emerald-700',
            };
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{r.person_name}</span>
                      {r.person_code && <span className="text-xs font-mono text-slate-400">{r.person_code}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.path === 'qiwa_transfer' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>{r.path === 'qiwa_transfer' ? 'QIWA Transfer' : 'New Visa'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColor[r.status] || 'bg-slate-100 text-slate-600'}`}>{r.status?.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Was on {r.original_visa_type} · {r.how_left === 'local_transfer' ? 'Local transfer' : 'Exited'}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit' : 'Add'} Record</h2>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {fields.map(f => (
                <div key={f.id} className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{f.field_label}{f.required && <span className="text-red-500 ml-1">*</span>}</label>
                  {renderInput(f)}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={saveRecord} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">{editingId ? 'Save Changes' : 'Add Record'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Status change popup — date + remarks */}
      {statusChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setStatusChange(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Stage Change</h2>
            <p className="text-xs text-slate-500 mb-4">
              <span className="text-slate-400">{statusChange.record.data?.[stageField?.field_key] || 'None'}</span>
              <span className="mx-1.5">→</span>
              <span className="font-medium text-indigo-600">{statusChange.newStatus}</span>
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Date</label>
                <input type="date" value={scDate} onChange={e => setScDate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                {(() => {
                  const flow = stageFlows.find(f => f.status_value === statusChange.newStatus);
                  const df = flow?.date_field_key ? fields.find(f => f.field_key === flow.date_field_key) : null;
                  return df ? <p className="text-xs text-emerald-600">Will fill: {df.field_label}</p>
                    : <p className="text-xs text-slate-400">No date field mapped to this stage (set in Stage Flow)</p>;
                })()}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Remarks <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea value={scRemarks} onChange={e => setScRemarks(e.target.value)} rows={2} placeholder="e.g. Passed medical, awaiting biometric slot" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setStatusChange(null)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700">Cancel</button>
              <button onClick={confirmStatusChange} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Update Stage</button>
            </div>
          </div>
        </div>
      )}

      {/* Stage history modal */}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setHistoryFor(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Stage History</h2>
                <p className="text-xs text-slate-400">{historyFor.data?.[nameField?.field_key] || historyFor.record_id}</p>
              </div>
              <button onClick={() => setHistoryFor(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6">
              {historyRows.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No stage changes recorded yet</p>
              ) : (
                <div className="space-y-0">
                  {historyRows.map((h, i) => (
                    <div key={h.id} className="flex gap-3 pb-4 relative">
                      {i < historyRows.length - 1 && <div className="absolute left-[5px] top-4 bottom-0 w-0.5 bg-slate-100" />}
                      <div className="w-3 h-3 rounded-full bg-indigo-500 mt-1 flex-shrink-0 ring-4 ring-indigo-50" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {h.from_status && <><span className="text-xs text-slate-400">{h.from_status}</span><span className="text-slate-300">→</span></>}
                          <span className="text-sm font-medium text-slate-800">{h.to_status}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{new Date(h.change_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}{h.changed_by ? ` · ${h.changed_by}` : ''}</p>
                        {h.remarks && <p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded-lg px-2.5 py-1.5">{h.remarks}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stage Flow settings panel */}
      {flowPanel && stageField && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setFlowPanel(false)} />
          <div className="relative bg-white w-[420px] h-full shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Stage Flow</h2>
                <p className="text-xs text-slate-400">Map each stage to the date field it should fill</p>
              </div>
              <button onClick={() => setFlowPanel(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2">
              {stages.length === 0 && <p className="text-xs text-slate-400">No stages found. Add options to your {stageField.field_label} field first.</p>}
              {stages.map((sv: string) => {
                const flow = stageFlows.find(f => f.status_value === sv);
                return (
                  <div key={sv} className="border border-slate-200 rounded-xl p-3">
                    <p className="text-sm font-medium text-slate-800 mb-2">{sv}</p>
                    <select
                      value={flow?.date_field_key || ''}
                      onChange={e => saveFlow(sv, e.target.value || null)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">No date needed for this stage</option>
                      {dateFields.map(df => <option key={df.field_key} value={df.field_key}>Fills → {df.field_label}</option>)}
                    </select>
                  </div>
                );
              })}
              {dateFields.length === 0 && stages.length > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3">No date-type fields in this section. Set your date columns to type "date" in Fields, then map them here.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage Fields panel */}
      {fieldsPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => { setFieldsPanel(false); setEditFieldId(null); }} />
          <div className="relative bg-white w-96 h-full shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div><h2 className="text-sm font-semibold text-slate-900">Manage Fields</h2><p className="text-xs text-slate-400">{fields.length} fields · {section.label}</p></div>
              <button onClick={() => { setFieldsPanel(false); setEditFieldId(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2">
              <button onClick={() => { setFieldsPanel(false); setForceSetup(true); }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 mb-2">
                <Upload size={13} />Re-upload Excel to rebuild fields
              </button>

              {/* Active/Inactive status config */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 mb-2">
                <p className="text-xs font-semibold text-slate-600 mb-2">Active / Inactive tracking</p>
                <p className="text-xs text-slate-400 mb-2">Pick the field that marks who's currently active, then which values mean "active".</p>
                <select value={activeConfig.field} onChange={e => saveActiveConfig(e.target.value, [])}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">No active/inactive tracking</option>
                  {fields.map(f => <option key={f.field_key} value={f.field_key}>{f.field_label}</option>)}
                </select>
                {activeConfig.field && (() => {
                  const af = fields.find(f => f.field_key === activeConfig.field);
                  const opts = af?.options?.length > 0 ? af.options
                    : Array.from(new Set(records.map(r => r.data?.[activeConfig.field]).filter(Boolean))).slice(0, 20);
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {opts.map((o: string) => {
                        const on = activeConfig.values.map(v => String(v).toLowerCase()).includes(String(o).toLowerCase());
                        return (
                          <button key={o} onClick={() => {
                            const next = on ? activeConfig.values.filter(v => String(v).toLowerCase() !== String(o).toLowerCase()) : [...activeConfig.values, o];
                            saveActiveConfig(activeConfig.field, next);
                          }} className={`px-2 py-1 rounded-lg border text-xs ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600'}`}>
                            {on ? '✓ ' : ''}{o}
                          </button>
                        );
                      })}
                      {opts.length === 0 && <span className="text-xs text-slate-400">No values found in this field yet.</span>}
                    </div>
                  );
                })()}
              </div>
              {fields.map(f => (
                <div key={f.id} className="border border-slate-200 rounded-xl p-3">
                  {editFieldId === f.id ? (
                    <div className="space-y-2">
                      <input value={efLabel} onChange={e => setEfLabel(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <select value={efType} onChange={e => setEfType(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {['text','number','date','email','phone','dropdown','boolean','id_field'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {efType === 'dropdown' && <textarea value={efOptions} onChange={e => setEfOptions(e.target.value)} rows={3} placeholder="One option per line" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />}
                      <div>
                        <label className="text-xs text-slate-400">Links to (connects this column to a list)</label>
                        <select value={efLinksTo} onChange={e => setEfLinksTo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-0.5">
                          <option value="">— Not linked —</option>
                          <option value="agency">Agency</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveFieldEdit} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg">Save</button>
                        <button onClick={() => setEditFieldId(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{f.field_label}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{f.field_type}</span>
                          {f.is_id_field && <span className="text-xs px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded">Auto ID</span>}
                          {f.links_to && <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">→ {f.links_to}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => startEditField(f)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><Edit2 size={13} /></button>
                        <button onClick={() => deleteField(f.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add new field inline */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 mt-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Add a field</p>
                <div className="space-y-2">
                  <input value={mfLabel} onChange={e => setMfLabel(e.target.value)} placeholder="Field name" className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <div className="flex gap-2">
                    <select value={mfType} onChange={e => setMfType(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {['text','number','date','email','phone','dropdown','boolean','id_field'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button onClick={addManualField} disabled={!mfLabel.trim()} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-40">Add</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Agency mapping modal — appears after import when unknown agency values are found */}
      {mapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Link agencies from your file</h2>
              <p className="text-xs text-slate-500 mt-0.5">We found agency values in your upload that aren’t linked yet. Tell us what each one is — we’ll remember it for next time.</p>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {mapModal.unknowns.map(val => {
                const choice = mapModal.choices[val];
                return (
                  <div key={val} className="border border-slate-100 rounded-xl p-3">
                    <p className="text-sm font-medium text-slate-800 mb-2">“{val}”</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <button onClick={() => setMapModal(m => m && ({ ...m, choices: { ...m.choices, [val]: { mode: 'new', newName: val } } }))}
                        className={`px-2.5 py-1 rounded-lg border text-xs ${choice.mode === 'new' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600'}`}>Create new agency</button>
                      <button onClick={() => setMapModal(m => m && ({ ...m, choices: { ...m.choices, [val]: { mode: 'existing', existingId: agencyList[0]?.id } } }))}
                        className={`px-2.5 py-1 rounded-lg border text-xs ${choice.mode === 'existing' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600'}`} disabled={agencyList.length === 0}>Link to existing</button>
                      <button onClick={() => setMapModal(m => m && ({ ...m, choices: { ...m.choices, [val]: { mode: 'skip' } } }))}
                        className={`px-2.5 py-1 rounded-lg border text-xs ${choice.mode === 'skip' ? 'bg-slate-500 text-white border-slate-500' : 'bg-white border-slate-200 text-slate-600'}`}>Skip</button>
                    </div>
                    {choice.mode === 'new' && (
                      <input value={choice.newName || ''} onChange={e => setMapModal(m => m && ({ ...m, choices: { ...m.choices, [val]: { mode: 'new', newName: e.target.value } } }))}
                        placeholder="Proper agency name" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    )}
                    {choice.mode === 'existing' && (
                      <select value={choice.existingId || ''} onChange={e => setMapModal(m => m && ({ ...m, choices: { ...m.choices, [val]: { mode: 'existing', existingId: e.target.value } } }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {agencyList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setMapModal(null)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">Later</button>
              <button onClick={saveMappings} disabled={mapSaving} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">{mapSaving ? 'Saving…' : 'Save links'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
