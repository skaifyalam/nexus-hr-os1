import { NextResponse } from 'next/server';

const MODEL = 'gemini-2.5-flash'; // free-tier model. If you hit rate limits, try 'gemini-2.5-flash-lite'

export async function POST(req: Request) {
  try {
    const { prompt, system } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured in environment variables.' }, { status: 500 });
    }

    const systemText = system || 'You are NEXUS HR AI, an expert HR assistant for a company operating in the GCC region (Saudi Arabia / Aramco project context). Be professional, concise, and accurate.';

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemText }] },
        }),
      }
    );

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: 'The AI is briefly unavailable — your data is safe. Please try once more in a moment.' }, { status: 500 });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI request failed' }, { status: 500 });
  }
}
