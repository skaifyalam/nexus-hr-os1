'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';

// A searchable picker for people (employees or candidates).
// Searches across name + all identifier fields (code, passport, recruitment id).
export default function PersonPicker({
  people, fields, value, onChange, placeholder = 'Search by name or ID…', idFieldKey,
}: {
  people: any[];
  fields: any[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  idFieldKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Identify the display + searchable fields
  const nameField = useMemo(() => fields.find(f => /name/i.test(f.field_label))?.field_key, [fields]);
  // ID-ish fields: anything marked is_id_field, or labelled code/id/passport/iqama/recruitment
  const idFields = useMemo(() =>
    fields.filter(f =>
      f.is_id_field ||
      /(employee.*code|emp.*code|employee.*id|passport|iqama|recruitment.*id|\bcode\b|\bid\b|national)/i.test(f.field_label)
    ).map(f => f.field_key),
  [fields]);

  const displayName = (p: any) => (nameField && p.data?.[nameField]) || 'Unnamed';

  // Fields that are ID-like by label, EXCLUDING descriptive fields (nationality, project, etc.)
  const idLabelFields = useMemo(() =>
    fields.filter(f =>
      /(employee.*code|emp.*code|employee.*id|staff.*id|passport|iqama|recruitment.*id|national.*id|\bcode\b|\bid\b)/i.test(f.field_label)
      && !/(nationality|country|project|category|department|designation|agency|status)/i.test(f.field_label)
    ).map(f => f.field_key),
  [fields]);

  const displayId = (p: any) => {
    // 1. Explicit ID field passed by parent (most reliable)
    if (idFieldKey && p.data?.[idFieldKey]) return String(p.data[idFieldKey]);
    // 2. record_id (canonical section ID)
    if (p.record_id) return String(p.record_id);
    // 3. an explicitly-marked ID field
    for (const k of idFields) { if (p.data?.[k]) return String(p.data[k]); }
    // 4. a field labelled like an ID (nationality/project/etc excluded)
    for (const k of idLabelFields) { if (p.data?.[k]) return String(p.data[k]); }
    return '';
  };
  // Search the WHOLE record (every field) — same approach as the Staff list, which works.
  const searchText = (p: any) =>
    (JSON.stringify(p.data || {}) + ' ' + (p.record_id || '')).toLowerCase();

  const selected = people.find(p => p.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people.slice(0, 50);
    return people.filter(p => searchText(p).includes(q)).slice(0, 50);
  }, [query, people]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left"
      >
        {selected ? (
          <span className="truncate">
            <span className="text-slate-800">{displayName(selected)}</span>
            {displayId(selected) && <span className="text-slate-400 ml-1.5 font-mono text-xs">{displayId(selected)}</span>}
          </span>
        ) : <span className="text-slate-400">{placeholder}</span>}
        <ChevronDown size={15} className="text-slate-400 flex-shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type name or ID number…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No matches</p>
            ) : filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setOpen(false); setQuery(''); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 ${p.id === value ? 'bg-indigo-50' : ''}`}
              >
                <span className="min-w-0">
                  <span className="text-sm text-slate-700 block truncate">{displayName(p)}</span>
                  {displayId(p) && <span className="text-xs font-mono text-slate-400">{displayId(p)}</span>}
                </span>
                {p.id === value && <Check size={14} className="text-indigo-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
          {people.length > 50 && !query && (
            <p className="text-xs text-slate-400 text-center py-2 border-t border-slate-100">Showing 50 — type to search all {people.length}</p>
          )}
        </div>
      )}
    </div>
  );
}
