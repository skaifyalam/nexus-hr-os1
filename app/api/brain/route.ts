import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/server';
import { callGemini } from '@/lib/gemini';

const gemini = async (prompt: string, system: string) => {
  const { text } = await callGemini({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 1500, temperature: 0.3 },
  });
  return text;
};

export async function POST(req: Request) {
  try {
    const { action, content, title, doc_type, question, company_id } = await req.json();
    const supabase = createRouteClient();

    // ── ACTION: process a newly uploaded document ──────────────
    if (action === 'process_document') {
      const system = `You are Naibus AI — an expert HR and legal document analyst for GCC companies. 
Extract structured information from documents clearly and concisely.`;

      // Generate summary
      const summaryPrompt = `Analyze this ${doc_type} document titled "${title}".
Provide:
1. A 3-4 sentence executive summary
2. Key rules and policies (as bullet points, max 10)
3. Employee entitlements mentioned
4. Any penalties or disciplinary provisions
5. GCC/Saudi Labour Law references if any

Document content:
${content.slice(0, 6000)}`;

      const summary = await gemini(summaryPrompt, system);

      // Extract key points as JSON array
      const keyPointsPrompt = `From this document summary, extract the 5-8 most important rules or policies as a JSON array of short strings. Return ONLY the JSON array, nothing else. Example: ["Annual leave is 21 days","Notice period is 30 days"]

Summary: ${summary}`;

      let keyPoints = [];
      try {
        const kpText = await gemini(keyPointsPrompt, system);
        const cleaned = kpText.replace(/```json|```/g, '').trim();
        keyPoints = JSON.parse(cleaned);
      } catch { keyPoints = []; }

      // Split content into chunks for better retrieval (every 1000 chars)
      const chunks = [];
      const chunkSize = 1000;
      for (let i = 0; i < content.length; i += chunkSize) {
        chunks.push(content.slice(i, i + chunkSize));
      }

      return NextResponse.json({ summary, keyPoints, chunks });
    }

    // ── ACTION: answer a question using all brain documents ────
    if (action === 'ask') {
      const supabase = createRouteClient();

      // Get all documents for this company
      const { data: docs } = await supabase
        .from('brain_documents')
        .select('title, document_type, ai_summary, ai_key_points, content')
        .eq('company_id', company_id)
        .order('uploaded_at', { ascending: false });

      if (!docs || docs.length === 0) {
        return NextResponse.json({
          answer: "No documents have been uploaded to Company Brain yet. Upload your company policies, labour law, or SOPs first, and I'll be able to answer questions about them.",
          sources: []
        });
      }

      // Build context from all documents
      const context = docs.map((d, i) =>
        `[Document ${i + 1}: ${d.title} (${d.document_type})]\nSummary: ${d.ai_summary}\nKey Points: ${JSON.stringify(d.ai_key_points)}`
      ).join('\n\n---\n\n');

      const system = `You are Naibus AI — an expert HR assistant for a GCC company. 
You answer questions ONLY based on the company's uploaded documents.
Always cite which document your answer comes from.
If the answer is not in the documents, say so clearly.
Be precise, professional, and GCC-context aware.`;

      const answerPrompt = `Based on the following company documents, answer this question:

Question: ${question}

Company Documents:
${context}

Instructions:
- Answer directly and professionally
- Cite the specific document name when referencing information
- If multiple documents are relevant, reference all of them
- If the answer is not in any document, say "This is not covered in your uploaded documents"
- Keep the answer concise but complete`;

      const answer = await gemini(answerPrompt, system);

      // Find which documents were referenced
      const sources = docs
        .filter(d => answer.toLowerCase().includes(d.title.toLowerCase()))
        .map(d => d.title);

      return NextResponse.json({ answer, sources });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
