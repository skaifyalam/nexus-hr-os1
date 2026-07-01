import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { widgets, company_id } = await req.json();
    const supabase = createRouteClient();

    // Gather all section keys we need data for
    const sectionKeys = Array.from(new Set(widgets.map((w: any) => w.section_key).filter(Boolean)));

    // Fetch records for each section
    const sectionData: Record<string, any[]> = {};
    for (const key of sectionKeys) {
      if (key === 'requisition') {
        const { data: headers } = await supabase
          .from('req_headers').select('*, req_lines(*)').eq('company_id', company_id);
        sectionData[key as string] = headers || [];
      } else {
        const { data } = await supabase
          .from('section_records').select('*')
          .eq('company_id', company_id).eq('section_key', key);
        sectionData[key as string] = data || [];
      }
    }

    // Compute each widget's value
    const results = widgets.map((w: any) => {
      const records = sectionData[w.section_key] || [];

      if (w.metric === 'count') {
        return { id: w.id, value: records.length };
      }

      if (w.metric === 'filtered_count') {
        const count = records.filter((r: any) => {
          const val = w.section_key === 'requisition' ? r.data?.[w.filter_field] : r.data?.[w.filter_field];
          return String(val ?? '').toLowerCase() === String(w.filter_value ?? '').toLowerCase();
        }).length;
        return { id: w.id, value: count };
      }

      if (w.metric === 'sum') {
        const total = records.reduce((s: number, r: any) => {
          const val = Number(r.data?.[w.field_key] || 0);
          return s + (isNaN(val) ? 0 : val);
        }, 0);
        return { id: w.id, value: total };
      }

      if (w.metric === 'breakdown') {
        const groups: Record<string, number> = {};
        records.forEach((r: any) => {
          const key = String(r.data?.[w.field_key] ?? 'Unknown') || 'Unknown';
          groups[key] = (groups[key] || 0) + 1;
        });
        const sorted = Object.entries(groups)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([label, count]) => ({ label, count }));
        return { id: w.id, breakdown: sorted, value: records.length };
      }

      return { id: w.id, value: 0 };
    });

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
