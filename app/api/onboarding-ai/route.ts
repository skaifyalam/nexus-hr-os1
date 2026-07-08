import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages, company_context } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const AVAILABLE_MODULES = [
      { key: 'recruitment', label: 'Recruitment Pipeline' },
      { key: 'leave', label: 'Leave Management' },
      { key: 'performance', label: 'Performance Management' },
      { key: 'disciplinary', label: 'Disciplinary & Grievance' },
      { key: 'exit', label: 'Exit Management' },
    ];

    const systemPrompt = `You are the Naibus Setup Assistant. Help new companies configure their HR platform.

Your job:
1. Greet warmly and ask 1-2 questions about their business at a time
2. Understand: industry, size, countries, main HR challenges
3. Suggest which modules they need based on their answers
4. When you have enough info (after 2-3 exchanges), end with a JSON block

Available modules: ${JSON.stringify(AVAILABLE_MODULES)}
Company context: ${JSON.stringify(company_context || {})}

When ready to suggest setup, add this JSON at the very end of your message (nothing after it):
{"action":"suggest_setup","modules":["recruitment","leave"],"custom_sections":[{"name":"Subcontractors","icon":"building"}],"summary":"What you understood"}

Rules:
- Be warm and conversational
- Ask max 2 questions per message  
- For EPC/Oil&Gas/GCC companies: always suggest recruitment module
- Keep responses under 100 words
- After 3 user messages, provide the suggestion`;

    // Gemini requires alternating user/model turns
    // Build valid conversation ensuring it starts with user and alternates
    const validMessages = (messages || []).filter((m: any) => m.content?.trim());
    
    // Ensure we have at least one message
    if (validMessages.length === 0) {
      return NextResponse.json({ 
        text: "Welcome to Naibus! I'm here to help set up your platform. Could you tell me a bit about your company — what industry are you in, and roughly how many employees do you have?",
        action: null 
      });
    }

    // Build Gemini-compatible contents array (must alternate user/model)
    const contents: any[] = [];
    let lastRole = '';
    
    for (const msg of validMessages) {
      const geminiRole = msg.role === 'user' ? 'user' : 'model';
      // Skip if same role twice in a row (Gemini doesn't allow this)
      if (geminiRole === lastRole) continue;
      contents.push({ role: geminiRole, parts: [{ text: msg.content }] });
      lastRole = geminiRole;
    }

    // Must end with user message
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      return NextResponse.json({
        text: "Welcome to Naibus! I'm here to help set up your platform. Could you tell me a bit about your company — what industry are you in, and roughly how many employees do you have?",
        action: null
      });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
        }),
      }
    );

    if (!res.ok) {
      const errData = await res.json();
      console.error('Gemini error:', errData);
      return NextResponse.json({ 
        text: "I'm having trouble connecting right now. Please try sending your message again.",
        action: null 
      });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      return NextResponse.json({ 
        text: "Could you tell me more about your company's HR needs?",
        action: null 
      });
    }

    // Extract JSON action block from end of text
    let action = null;
    let cleanText = text;
    try {
      const jsonStart = text.lastIndexOf('{"action"');
      if (jsonStart !== -1) {
        const jsonStr = text.slice(jsonStart);
        action = JSON.parse(jsonStr);
        cleanText = text.slice(0, jsonStart).trim();
      }
    } catch {
      // No valid JSON found — that's fine
    }

    return NextResponse.json({ text: cleanText || text, action });
  } catch (err: any) {
    console.error('Onboarding AI error:', err);
    return NextResponse.json({ 
      text: "Something went wrong. Please try again.",
      action: null,
      error: err.message 
    }, { status: 500 });
  }
}
