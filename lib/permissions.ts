import { createServerClient } from './supabase/server';

// Returns the access level ('none'|'view'|'apply'|'approve') a profile has for a feature key.
// Super admins always get 'approve'. Users with no custom role get 'approve' (full) by default.
export async function getFeatureAccess(profile: any, featureKey: string): Promise<string> {
  if (!profile) return 'none';
  if (profile.role === 'super_admin') return 'approve';
  if (!profile.custom_role_id) return 'approve'; // no role assigned = unrestricted (legacy/first users)

  const supabase = createServerClient();
  const { data } = await supabase.from('custom_roles').select('permissions').eq('id', profile.custom_role_id).maybeSingle();
  const perms = data?.permissions || {};
  const access = perms.features?.[featureKey];
  // Undefined = not configured = allowed (so new features aren't accidentally locked out)
  return access === undefined ? 'approve' : access;
}

// Returns { field, values } describing this user's project restriction for a section,
// or null if unrestricted. field = the data key holding project; values = allowed list.
export async function getProjectScope(profile: any, sectionKey: string): Promise<{ field: string; values: string[] } | null> {
  if (!profile || profile.role === 'super_admin') return null;
  const scope: string[] = profile.project_scope || [];
  if (!scope || scope.length === 0) return null; // no restriction

  const supabase = createServerClient();
  // Prefer an explicitly designated field if set.
  const { data: company } = await supabase.from('company_profile')
    .select('project_field_key, candidate_project_field_key')
    .eq('id', profile.company_id).maybeSingle();
  let field = sectionKey === 'candidate'
    ? (company?.candidate_project_field_key || company?.project_field_key)
    : company?.project_field_key;

  // Auto-detect: if no field designated, find the employee field whose values
  // best match the assigned project names.
  if (!field) {
    const { data: fields } = await supabase.from('section_field_configs')
      .select('field_key, field_label').eq('company_id', profile.company_id).eq('section_key', sectionKey);
    if (fields && fields.length > 0) {
      // Prefer a field literally named project/site/location
      const named = fields.find((f: any) => /project|site|location/i.test(f.field_label));
      if (named) field = named.field_key;
      else {
        // Otherwise, sample records and find the field whose values overlap the scope
        const { data: sample } = await supabase.from('section_records').select('data')
          .eq('company_id', profile.company_id).eq('section_key', sectionKey).limit(200);
        const scopeLower = scope.map(s => String(s).toLowerCase());
        let best: string | null = null; let bestHits = 0;
        for (const f of fields) {
          let hits = 0;
          (sample || []).forEach((r: any) => {
            const v = r.data?.[f.field_key];
            if (v && scopeLower.includes(String(v).toLowerCase())) hits++;
          });
          if (hits > bestHits) { bestHits = hits; best = f.field_key; }
        }
        if (best) field = best;
      }
    }
  }
  if (!field) return null; // couldn't determine a project field → no filtering
  return { field, values: scope };
}

// Returns the list of confidential field keys this profile is NOT allowed to see.
export async function getConfidentialFields(profile: any): Promise<string[]> {
  if (!profile || profile.role === 'super_admin' || !profile.custom_role_id) return [];
  const supabase = createServerClient();
  const { data } = await supabase.from('custom_roles').select('permissions').eq('id', profile.custom_role_id).maybeSingle();
  return data?.permissions?.confidential_fields || [];
}
