import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';

const gemini = async (prompt: string) => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

export async function POST(req: Request) {
  try {
    const { prompt, report_type, company_id, user_email } = await req.json();
    const supabase = createRouteClient();

    // Fetch all relevant data in parallel
    const [
      { data: employees },
      { data: candidates },
      { data: requisitions },
      { data: leaves },
      { data: performances },
      { data: brainDocs },
    ] = await Promise.all([
      supabase.from('employees').select('employee_id, first_name, last_name, department_id, job_title, nationality, status, salary, joining_date, iqama_expiry, passport_expiry, operations(name, country_code), departments(name)'),
      supabase.from('candidates').select('candidate_id, first_name, last_name, nationality, stage, operations(country_code), requisitions(position)'),
      supabase.from('requisitions').select('requisition_id, position, headcount, status, required_by, operations(country_code), departments(name)'),
      supabase.from('leave_requests').select('leave_id, status, days_count, start_date, end_date'),
      supabase.from('performance_reviews').select('review_period, kpi_score, manager_rating, status'),
      supabase.from('brain_documents').select('title, document_type, ai_key_points'),
    ]);

    const today = new Date();
    const daysUntil = (d: string) => d ? Math.ceil((new Date(d).getTime() - today.getTime()) / 86400000) : 999;

    const emp = employees || [];
    const cands = candidates || [];
    const reqs = requisitions || [];
    const lv = leaves || [];

    // Build rich data snapshot
    const snapshot = {
      generated_at: today.toISOString(),
      report_type,

      // Headcount
      total_employees: emp.length,
      active: emp.filter(e => e.status === 'active').length,
      on_leave: emp.filter(e => e.status === 'on_leave').length,
      terminated: emp.filter(e => e.status === 'terminated').length,

      // By department
      by_department: Object.entries(
        emp.reduce((acc: any, e: any) => {
          const dept = e.departments?.name || 'Unknown';
          acc[dept] = (acc[dept] || 0) + 1;
          return acc;
        }, {})
      ).map(([dept, count]) => ({ dept, count })),

      // By country
      by_country: Object.entries(
        emp.reduce((acc: any, e: any) => {
          const country = e.operations?.country_code || 'Unknown';
          acc[country] = (acc[country] || 0) + 1;
          return acc;
        }, {})
      ).map(([country, count]) => ({ country, count })),

      // By nationality
      by_nationality: Object.entries(
        emp.reduce((acc: any, e: any) => {
          acc[e.nationality || 'Unknown'] = (acc[e.nationality || 'Unknown'] || 0) + 1;
          return acc;
        }, {})
      ).sort((a: any, b: any) => (b[1] as number) - (a[1] as number)).slice(0, 10)
        .map(([nat, count]) => ({ nationality: nat, count })),

      // Document expiries
      critical_expiries: emp
        .flatMap((e: any) => [
          { name: `${e.first_name} ${e.last_name}`, doc: 'Iqama', days: daysUntil(e.iqama_expiry), expiry: e.iqama_expiry },
          { name: `${e.first_name} ${e.last_name}`, doc: 'Passport', days: daysUntil(e.passport_expiry), expiry: e.passport_expiry },
        ])
        .filter(x => x.days <= 90 && x.days > 0)
        .sort((a, b) => a.days - b.days),

      // Salary summary
      avg_salary: emp.length ? Math.round(emp.reduce((s: number, e: any) => s + (Number(e.salary) || 0), 0) / emp.length) : 0,
      total_salary_monthly: emp.reduce((s: number, e: any) => s + (Number(e.salary) || 0), 0),

      // Recruitment
      total_candidates: cands.length,
      pipeline_by_stage: ['selection','offer_issued','offer_accepted','visa_pending','visa_allocated','medical','biometric','skill_test','visa_stamping','visa_stamped','ticket_booked','mobilized','onboarded'].map(stage => ({
        stage, count: cands.filter((c: any) => c.stage === stage).length,
      })).filter(s => s.count > 0),
      open_requisitions: reqs.filter(r => r.status === 'open' || r.status === 'in_progress').length,
      filled_requisitions: reqs.filter(r => r.status === 'filled').length,

      // Leave
      total_leave_requests: lv.length,
      approved_leaves: lv.filter(l => l.status === 'approved').length,
      pending_leaves: lv.filter(l => l.status === 'pending').length,
      total_leave_days: lv.filter(l => l.status === 'approved').reduce((s: number, l: any) => s + (l.days_count || 0), 0),

      // Performance
      total_reviews: (performances || []).length,
      avg_kpi: (performances || []).length
        ? Math.round((performances || []).reduce((s: number, p: any) => s + (Number(p.kpi_score) || 0), 0) / (performances || []).length * 10) / 10
        : 0,

      // Company Brain docs
      loaded_policies: (brainDocs || []).map((d: any) => d.title),
    };

    // Generate report title from prompt
    const titlePrompt = `Generate a short professional report title (max 8 words) for this HR report request: "${prompt}". Return ONLY the title text, nothing else.`;
    const titleRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: titlePrompt }] }],
          generationConfig: { maxOutputTokens: 30 },
        }),
      }
    );
    const titleData = await titleRes.json();
    const title = titleData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || prompt.slice(0, 50);

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
