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

// Returns the list of confidential field keys this profile is NOT allowed to see.
export async function getConfidentialFields(profile: any): Promise<string[]> {
  if (!profile || profile.role === 'super_admin' || !profile.custom_role_id) return [];
  const supabase = createServerClient();
  const { data } = await supabase.from('custom_roles').select('permissions').eq('id', profile.custom_role_id).maybeSingle();
  return data?.permissions?.confidential_fields || [];
}
