/**
 * Calls the server-side ID generator.
 * entity_type: 'employee' | 'requisition' | 'candidate' | 'transfer' | 'leave' | 'performance' | 'disciplinary' | 'exit'
 * country_code: optional, e.g. 'SA', 'KW' — used when format contains {COUNTRY}
 * dept_code: optional, e.g. 'ENG' — used when format contains {DEPT}
 */
export async function generateId(
  entity_type: string,
  country_code = '',
  dept_code = ''
): Promise<string> {
  try {
    const res = await fetch('/api/generate-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type, country_code, dept_code }),
    });
    const data = await res.json();
    if (data.id) return data.id;
    // Fallback if API fails — timestamp-based, never conflicts
    return `${entity_type.toUpperCase()}-${Date.now().toString().slice(-6)}`;
  } catch {
    return `${entity_type.toUpperCase()}-${Date.now().toString().slice(-6)}`;
  }
}
