import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';
import { callGemini } from '@/lib/gemini';

const gemini = async (prompt: string) => {
  const { text, error } = await callGemini({
    systemInstruction: {
      parts: [{ text: `You are NEXUS HR AI Report Generator for a GCC enterprise company.
Generate professional HR reports using ONLY the data provided.
Use markdown formatting: # for main title, ## for sections, ### for subsections.
Use tables with | separators for tabular data.
Use **bold** for key numbers and important findings.
Always end with ## Recommendations with actionable bullet points.
Be precise, professional, and GCC/Saudi Arabia context aware.
Never invent data that wasn't provided.` }]
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 2000, temperature: 0.2 },
  });
  if (error) throw new Error(error);
  return text;
};

export async function POST(req: Request) {
  try {
    const { prompt, report_type, company_id, user_email } = await req.json();
    const supabase = createRouteClient();


    // Fetch ALL sections + their fields for this company
    const { data: sectionList } = await supabase.from('company_sections')
      .select('*').eq('company_id', company_id).order('sidebar_order');
    const { data: allFields } = await supabase.from('section_field_configs')
      .select('*').eq('company_id', company_id);

    // Batch-fetch all records per section (past 1000 cap)
    const sectionRecords: Record<string, any[]> = {};
    for (const sec of sectionList || []) {
      let all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('section_records').select('data')
          .eq('company_id', company_id).eq('section_key', sec.section_key)
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
      }
      sectionRecords[sec.section_key] = all;
    }

    // Helper: find a field key by fuzzy label match within a section
    const findField = (sectionKey: string, patterns: RegExp[]) => {
      const fs = (allFields || []).filter((f: any) => f.section_key === sectionKey);
      for (const p of patterns) {
        const hit = fs.find((f: any) => p.test(f.field_label));
        if (hit) return hit.field_key;
      }
      return null;
    };

    const breakdown = (records: any[], fieldKey: string | null) => {
      if (!fieldKey) return [];
      const g: Record<string, number> = {};
      records.forEach(r => {
        const v = String(r.data?.[fieldKey] ?? 'Unknown') || 'Unknown';
        g[v] = (g[v] || 0) + 1;
      });
      return Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([label, count]) => ({ label, count }));
    };

    // Build a snapshot dynamically for every section
    const sectionsSnapshot = (sectionList || []).map((sec: any) => {
      const records = sectionRecords[sec.section_key] || [];
      const natField = findField(sec.section_key, [/nationalit/i, /country/i]);
      const statusField = findField(sec.section_key, [/^status/i, /stage/i, /employment/i]);
      const deptField = findField(sec.section_key, [/department/i, /division/i]);
      const projField = findField(sec.section_key, [/project/i, /operation/i, /location/i]);
      const catField = findField(sec.section_key, [/category/i, /position/i, /designation|role|title/i]);
      const agencyField = findField(sec.section_key, [/agency/i, /agent/i]);
      return {
        section: sec.label,
        total_records: records.length,
        by_status: breakdown(records, statusField),
        by_nationality: breakdown(records, natField),
        by_department: breakdown(records, deptField),
        by_project: breakdown(records, projField),
        by_category: breakdown(records, catField),
        by_agency: breakdown(records, agencyField),
      };
    });

    const { data: brainDocs } = await supabase.from('brain_documents')
      .select('title').eq('company_id', company_id);

    const today = new Date();
    const snapshot = {
      generated_at: today.toISOString(),
      report_type,
      company_sections: sectionsSnapshot,
      loaded_policies: (brainDocs || []).map((d: any) => d.title),
    };

    // Generate report title from prompt
    const titlePrompt = `Generate a short professional report title (max 8 words) for this HR report request: "${prompt}". Return ONLY the title text, nothing else.`;
    const { text: titleText } = await callGemini({
      contents: [{ role: 'user', parts: [{ text: titlePrompt }] }],
      generationConfig: { maxOutputTokens: 30 },
    });
    const title = titleText?.trim() || prompt.slice(0, 50);

    // Generate the actual report
    const reportPrompt = `Generate a ${report_type} HR report for this request: "${prompt}"

Company Data (use ONLY this data, do not invent):
${JSON.stringify(snapshot, null, 2)}

Report date: ${today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

Format requirements:
- Start with a # Title
- Use ## for main sections
- For tabular reports: use markdown tables with headers
- For narrative reports: use flowing professional prose with headers
- For summary reports: use key metric cards (bold numbers with labels)
- Always include ## Key Findings and ## Recommendations at the end
- Reference specific numbers from the data
- Keep it professional and GCC-context aware`;

    const content = await gemini(reportPrompt);

    // Save to database
    const { data: report, error } = await supabase.from('ai_reports').insert({
      company_id,
      title,
      prompt,
      report_type,
      content,
      data_snapshot: snapshot,
      generated_by: user_email,
    }).select().single();

    if (error) console.error('Report save error:', error);

    return NextResponse.json({ title, content, report_id: report?.id });
  } catch (err: any) {
    console.error('Report generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
