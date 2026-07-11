import { createServerClient } from './supabase/server';

// Loads people (employees/candidates) for pickers — but trims each record's `data`
// to only the fields a picker needs (name + identifier-ish fields), so we don't ship
// megabytes of unused columns on every page load. Big performance win on large datasets.
export async function loadPeopleForPicker(companyId: string, sectionKey: string) {
  const supabase = createServerClient();

  // Which fields matter for display + search: name + any id-ish field
  const { data: fields } = await supabase.from('section_field_configs')
    .select('field_key, field_label, is_id_field')
    .eq('company_id', companyId).eq('section_key', sectionKey);

  const keep = new Set<string>();
  (fields || []).forEach((f: any) => {
    if (f.is_id_field || /name|code|id|passport|iqama|recruitment|national|designation|position|title/i.test(f.field_label)) {
      keep.add(f.field_key);
    }
  });
  // Fallback: if detection kept too few fields (e.g. after a fresh upload where
  // is_id_field wasn't set), keep the first several fields so search still works.
  if (keep.size < 2) {
    (fields || []).slice(0, 6).forEach((f: any) => keep.add(f.field_key));
  }

  let people: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('section_records').select('id, record_id, data')
      .eq('company_id', companyId).eq('section_key', sectionKey).range(from, from + 999);
    if (!data || data.length === 0) break;
    // Trim each record's data to only the kept fields
    for (const r of data) {
      const trimmed: any = {};
      if (r.data) for (const k of Object.keys(r.data)) { if (keep.has(k)) trimmed[k] = r.data[k]; }
      people.push({ id: r.id, record_id: r.record_id, data: trimmed });
    }
    if (data.length < 1000) break;
  }
  return { people, fields: fields || [] };
}
