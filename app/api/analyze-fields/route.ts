import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { headers, sample_rows, section_key, company_id } = await req.json();
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const prompt = `You are analyzing an Excel/CSV file uploaded to an HR system for a GCC company.
Column headers found: ${JSON.stringify(headers)}
Sample data rows (first 5): ${JSON.stringify(sample_rows?.slice(0, 5) || [])}

For each column, return a JSON array of field configurations. Each object must have:
- "field_key": snake_case version of the header
- "field_label": clean display label
- "field_type": one of: "text","number","date","email","phone","dropdown","boolean","id_field"
- "is_id_field": true ONLY for a column the SYSTEM auto-generates as a sequence (like "Recruitment ID", "Employee Code", "Ref No" that the company assigns internally). NEVER mark real-world identifiers that people type in — Passport No, Iqama No, Phone, Mobile, National ID, Visa Number, Border Number — these are TEXT, not auto-IDs.
- "id_format": if is_id_field is true, suggest a format using tokens like {SEQ4},{YEAR},{COUNTRY}
- "options": array of unique values if field_type is "dropdown" (max 20)
- "required": true if mandatory
- "display_order": order number starting from 1

Rules:
- Salary/Amount/Cost/Budget → "number"
- Date/DOB/Expiry/Joining → "date"
- Email → "email"
- Phone/Mobile/Contact → "phone"
- Yes/No/Active/Inactive/True/False or 2 distinct values → "boolean"
- Nationality/Department/Status/Category/Type/Grade with few unique values → "dropdown"
- Name/Address with many unique values → "text"
- ONLY a company-assigned sequential reference (Recruitment ID, Employee Code, internal Ref No) → "id_field"
- Passport No, Iqama No, National ID, Visa No, Border No, Phone, Mobile → these are "text" (real-world numbers people type, NOT system-generated)

Return ONLY a valid JSON array. No markdown, no explanation.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 8000,
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: `Gemini: ${data.error.message}` }, { status: 500 });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Robust JSON extraction — handles markdown fences, leading/trailing text
    let fields = [];
    const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };

    let parsed = tryParse(text);
    if (!parsed) parsed = tryParse(text.replace(/```json|```/g, '').trim());
    if (!parsed) {
      // Extract the outermost [ ... ] array
      const start = text.indexOf('[');
      const end = text.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        parsed = tryParse(text.slice(start, end + 1));
      }
    }

    if (!parsed || !Array.isArray(parsed)) {
      // Last-resort fallback: build simple text fields from headers so the user is never stuck
      parsed = headers.map((h: string, i: number) => ({
        field_key: h.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        field_label: h,
        field_type: /date/i.test(h) ? 'date' : /id|code|no\.?|number/i.test(h) ? 'id_field' : 'text',
        is_id_field: /(recruitment|employee|candidate|ref)\s*(id|code|no)/i.test(h) && !/passport|iqama|visa|border|phone|mobile|national/i.test(h),
        options: [],
        required: false,
        display_order: i + 1,
      }));
    }
    fields = parsed;

    const supabase = createRouteClient();
    await supabase.from('section_field_configs')
      .delete().eq('company_id', company_id).eq('section_key', section_key).eq('is_system', false);

    const rows = fields.map((f: any, i: number) => ({
      company_id, section_key,
      field_key: f.field_key, field_label: f.field_label,
      field_type: f.field_type || 'text', options: f.options || [],
      is_id_field: f.is_id_field || false, id_format: f.id_format || null,
      required: f.required || false, display_order: f.display_order || i + 1,
      is_system: false,
    }));

    const { data: saved, error } = await supabase.from('section_field_configs').insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const optionRows: any[] = [];
    fields.forEach((f: any) => {
      if (f.field_type === 'dropdown' && f.options?.length > 0) {
        f.options.forEach((opt: string) => {
          if (opt?.toString().trim()) {
            optionRows.push({ company_id, section_key, field_key: f.field_key, option_value: opt.toString().trim() });
          }
        });
      }
    });
    if (optionRows.length > 0) {
      await supabase.from('field_options').upsert(optionRows, { onConflict: 'company_id,section_key,field_key,option_value' });
    }

    return NextResponse.json({ fields: saved, count: saved?.length || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
