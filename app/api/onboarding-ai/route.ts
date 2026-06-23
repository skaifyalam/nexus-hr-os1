import { NextResponse } from 'next/server';

const AVAILABLE_MODULES = [
  { key: 'recruitment', label: 'Recruitment Pipeline', desc: 'Manage candidates through mobilization stages' },
  { key: 'leave', label: 'Leave Management', desc: 'Track and approve employee leave requests' },
  { key: 'performance', label: 'Performance Management', desc: 'KPI tracking and review cycles' },
  { key: 'disciplinary', label: 'Disciplinary & Grievance', desc: 'Incident logging and warning letters' },
  { key: 'exit', label: 'Exit Management', desc: 'Resignation, termination, and clearance tracking' },
];

export async function POST(req: Request) {
  try {
    const { messages, company_context } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const systemPrompt = `You are the NEXUS HR Setup Assistant. You help new companies configure their HR platform.

Your job:
1. Greet the company warmly and ask about their business in a conversational way
2. Understand: industry, size, countries of operation, main HR challenges
3. Suggest which optional modules they should install based on their answers
4. Help them think about any custom sections they might need beyond standard HR
5. When you have enough info, respond with a JSON block at the end of your message like this:
{"action":"suggest_setup","modules":["recruitment","leave"],"custom_sections":[{"name":"Subcontractors","icon":"building"},{"name":"HSE Inspections","icon":"shield"}],"summary":"Brief summary of what you understood"}

Available modules: ${JSON.stringify(AVAILABLE_MODULES)}

Company context so far: ${JSON.stringify(company_context || {})}

Be conversational, warm, and concise. Ask one or two questions at a time. Don't overwhelm them.
If they say they do EPC/construction/oil & gas projects in GCC: suggest recruitment (mobilization pipeline is critical), leave, performance.
If they mention multiple countries: confirm they want multi-country access control.
If they mention subcontractors, agencies, or partners: suggest a custom "Subcontractors" section.`;

    const conversationHistory = messages.map((m: any) => ({
      parts: [{ text: m.content }],
      role: m.role === 'user' ? 'user' : 'model',
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: conversationHistory,
        }),
      }
    );

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I had trouble responding. Please try again.';

    // Extract JSON action if present
    const jsonMatch = text.match(/\{\"action\":.*\}/s);
    const action = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    const cleanText = text.replace(/\{\"action\":.*\}/s, '').trim();

    return NextResponse.json({ text: cleanText, action });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
