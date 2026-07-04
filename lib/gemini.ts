// Shared Gemini caller — retries automatically, never blames the AI provider.
// Usage: const { text, error } = await callGemini(body);

const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function callGemini(body: any, model = 'gemini-2.5-flash', attempts = 3): Promise<{ text: string; error?: string }> {
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${URL_BASE}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      lastStatus = res.status;

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
        if (text) return { text };
        // Empty response — retry
      } else if (res.status === 429 || res.status >= 500) {
        // Rate limited or server issue — wait and retry
      } else {
        // Hard client error (bad key etc.) — no point retrying
        break;
      }
    } catch {
      // network hiccup — retry
    }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 1200 * (i + 1)));
  }
  return {
    text: '',
    error: lastStatus === 429
      ? 'The AI is handling high demand right now. It usually clears in under a minute — your data is safe, just click the button again.'
      : 'The AI could not complete this request. Your data is untouched — please try once more.',
  };
}
