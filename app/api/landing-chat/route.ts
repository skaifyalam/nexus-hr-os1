import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/gemini';

// Public chat for the landing page. Answers only about Naibus, from the supplied context.
export async function POST(req: Request) {
  try {
    const { question, context } = await req.json();
    if (!question) return NextResponse.json({ answer: 'Ask me anything about Naibus!' });

    const prompt = `${context}\n\nVisitor question: "${question}"\n\nAnswer in 2-4 short sentences, friendly and honest. Only use the facts above. If it's outside those facts (pricing specifics, custom requests, anything you're unsure of), invite them to book a demo or sign up rather than guessing.`;

    const { text, error } = await callGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
    });

    if (error || !text) {
      return NextResponse.json({ answer: "I couldn't reach the assistant just now — please try again, or use Get started to create an account." });
    }
    return NextResponse.json({ answer: text.trim() });
  } catch {
    return NextResponse.json({ answer: 'Something went wrong — please try again.' });
  }
}
