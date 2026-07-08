'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────
// Naibus Technologies — Landing Page
// Brand: navy #0F172A · blue #2563EB · cyan #06B6D4 · emerald #10B981 · Poppins
// Signature: a living node-network that animates like data flowing through a business
// ─────────────────────────────────────────────────────────────

function NodeNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0; let w = 0; let h = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * DPR; canvas.height = h * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); };
    resize(); window.addEventListener('resize', resize);
    const N = Math.min(46, Math.floor((w * h) / 22000));
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 1,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (!reduce) { a.x += a.vx; a.y += a.vy; }
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y; const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            const op = (1 - dist / 130) * 0.4;
            const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            grad.addColorStop(0, `rgba(37,99,235,${op})`);
            grad.addColorStop(1, `rgba(6,182,212,${op})`);
            ctx.strokeStyle = grad; ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6,182,212,0.85)'; ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.55 }} />;
}

const FEATURES = [
  { k: 'Universal engine', d: 'Upload your Excel — AI builds your workspace: fields, dropdowns, ID formats and pipeline stages. Nothing hardcoded.', c: '#2563EB' },
  { k: 'Recruitment & pipeline', d: 'Track candidates through every stage, with Kanban boards and stage history that reflect how your company actually works.', c: '#06B6D4' },
  { k: 'Visa management', d: 'Blocks, allocation across agencies, Ewakala batch-issuing, stamping — the full Gulf visa workflow, built for the real process.', c: '#10B981' },
  { k: 'Leave, attendance, performance', d: 'The everyday HR operations, with bulk import, criteria-based policies and clean approval routing.', c: '#2563EB' },
  { k: 'Roles & approvals', d: 'Custom roles, per-field confidentiality, project scoping, and approval chains you define for any process.', c: '#06B6D4' },
  { k: 'Employee 360', d: 'One screen for everything about a person — leave, visa, documents, conduct, performance — all linked and live.', c: '#10B981' },
];

const AI_CONTEXT = `You are the Naibus assistant on the Naibus Technologies website. Answer ONLY about what Naibus is and does, based on these facts. Be concise, friendly, honest. If asked something you don't know, say you'll connect them with the team — never invent features, prices, or customers.

FACTS:
- Naibus is an intelligent HR and business operating system for companies, with a focus on the GCC / Saudi market.
- Core: a universal engine where each company uploads their own Excel and AI builds their workspace (fields, dropdowns, ID formats, pipeline stages) — nothing hardcoded.
- Modules: Employees, Recruitment pipeline, Requisitions, Leave, Attendance, Performance, Documents (Iqama/passport/visa expiry), Visa Management (blocks, allocation, Ewakala, stamping), Conduct & Exit, Grievances, Employee 360 profile.
- Platform: custom roles, permissions with real enforcement, confidential fields, project scoping, approval workflows, multi-company, AI reports, Company Brain.
- Visa workflow is a key differentiator — allocation across agencies with over-allocation, Ewakala batch-issuing, and two-way sync with the recruitment pipeline.
- Pricing is per-employee, competitive with BambooHR. Exact pricing: tell them to contact the team.
- Naibus is early — the product is built; the company is being established. Be honest about this if asked about track record; don't claim customers you can't verify.
- To get started, they can sign up on this page or book a demo.`;

export default function LandingPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: 'assistant', text: "Hi! I'm the Naibus assistant. Ask me anything about what Naibus does — modules, the visa workflow, how setup works." },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  const send = async () => {
    const q = input.trim(); if (!q || thinking) return;
    setMessages(m => [...m, { role: 'user', text: q }]); setInput(''); setThinking(true);
    try {
      const res = await fetch('/api/landing-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: AI_CONTEXT }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: 'assistant', text: data.answer || "I'll connect you with the team for that one — try the Book a demo button." }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: "Something went wrong. Please try again, or reach us via Book a demo." }]);
    }
    setThinking(false);
  };

  return (
    <div style={{ background: '#0F172A', color: '#F1F5F9', fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif" }} className="min-h-screen overflow-x-hidden">
      {/* Nav */}
      <nav className="relative z-20 flex items-center justify-between px-6 md:px-12 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#2563EB,#06B6D4)' }}>
            <span className="text-white font-bold">N</span>
          </div>
          <div>
            <p className="font-bold leading-none">Naibus</p>
            <p className="text-[10px] tracking-wider" style={{ color: '#06B6D4' }}>TECHNOLOGIES</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-300 hover:text-white transition-colors">Sign in</Link>
          <Link href="/login?mode=signup" className="text-sm font-medium px-4 py-2 rounded-xl text-white transition-transform hover:scale-105" style={{ background: 'linear-gradient(135deg,#2563EB,#06B6D4)' }}>Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative min-h-[88vh] flex items-center">
        <div className="absolute inset-0"><NodeNetwork /></div>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(37,99,235,0.15), transparent 60%)' }} />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center py-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', color: '#06B6D4' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            The Business Intelligence Operating System
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 animate-[fadeUp_0.8s_ease]">
            Intelligence behind<br />every business
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 animate-[fadeUp_1s_ease]">
            Naibus unifies your people, processes and data on one intelligent platform. Upload your own Excel — AI builds your workspace. Start with HR, from recruitment to visas to the full employee lifecycle.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-[fadeUp_1.2s_ease]">
            <Link href="/login?mode=signup" className="px-6 py-3 rounded-xl font-medium text-white w-full sm:w-auto transition-transform hover:scale-105" style={{ background: 'linear-gradient(135deg,#2563EB,#06B6D4)' }}>Start free</Link>
            <button onClick={() => setChatOpen(true)} className="px-6 py-3 rounded-xl font-medium w-full sm:w-auto border border-slate-600 hover:border-slate-400 transition-colors">Ask the AI assistant</button>
          </div>
        </div>
      </header>

      {/* Trust strip — honest: capabilities, not fake logos */}
      <section className="border-y border-slate-800 py-6">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[['Intelligent', 'AI-built workspaces'], ['Unified', 'Every function connected'], ['Secure', 'Roles & confidentiality'], ['Built for the Gulf', 'Visa & Saudization ready']].map(([t, s]) => (
            <div key={t}>
              <p className="font-semibold" style={{ color: '#06B6D4' }}>{t}</p>
              <p className="text-xs text-slate-400 mt-1">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs tracking-widest mb-3" style={{ color: '#06B6D4' }}>WHAT NAIBUS DOES</p>
          <h2 className="text-3xl md:text-4xl font-bold">One platform for your whole workforce</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.k} className="rounded-2xl p-6 transition-transform hover:-translate-y-1"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', animationDelay: `${i * 60}ms` }}>
              <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center" style={{ background: `${f.c}22`, border: `1px solid ${f.c}55` }}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: f.c }} />
              </div>
              <h3 className="font-semibold mb-2">{f.k}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Vision — honest present & future, no invented past */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-xs tracking-widest mb-3" style={{ color: '#06B6D4' }}>WHERE WE'RE GOING</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-6">Start with HR. Grow into a business operating system.</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Naibus begins where fragmented spreadsheets and disconnected tools slow companies down. Today it's a complete HR and workforce platform. The vision is a single intelligent system a company can run its operations from — with the same AI-built, nothing-hardcoded foundation.
        </p>
        <p className="text-sm text-slate-500">We're an early-stage company building deliberately. If that's the kind of partner you want, let's talk.</p>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="rounded-3xl p-10 text-center" style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.15),rgba(6,182,212,0.1))', border: '1px solid rgba(6,182,212,0.25)' }}>
          <h2 className="text-2xl md:text-3xl font-bold mb-3">See Naibus with your own data</h2>
          <p className="text-slate-300 mb-8">Create an account and upload a sample Excel — watch AI build your workspace in minutes.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login?mode=signup" className="px-6 py-3 rounded-xl font-medium text-white w-full sm:w-auto transition-transform hover:scale-105" style={{ background: 'linear-gradient(135deg,#2563EB,#06B6D4)' }}>Get started free</Link>
            <button onClick={() => setChatOpen(true)} className="px-6 py-3 rounded-xl font-medium w-full sm:w-auto border border-slate-600 hover:border-slate-400 transition-colors">Have questions? Ask AI</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#2563EB,#06B6D4)' }}><span className="text-white text-xs font-bold">N</span></div>
            <span>Naibus Technologies</span>
          </div>
          <p>Intelligence Behind Every Business</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-white">Sign in</Link>
            <Link href="/login?mode=signup" className="hover:text-white">Get started</Link>
          </div>
        </div>
      </footer>

      {/* AI chat */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)} className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110" style={{ background: 'linear-gradient(135deg,#2563EB,#06B6D4)' }} aria-label="Open chat">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      )}
      {chatOpen && (
        <div className="fixed bottom-6 right-6 z-40 w-[92vw] max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', height: '520px' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ background: 'linear-gradient(135deg,#2563EB,#06B6D4)' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center"><span className="text-white text-xs font-bold">N</span></div>
              <div><p className="text-white text-sm font-semibold leading-none">Naibus Assistant</p><p className="text-white/70 text-[10px]">Ask about the product</p></div>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-white/80 hover:text-white" aria-label="Close chat">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'text-white rounded-br-sm' : 'text-slate-200 rounded-bl-sm'}`}
                  style={{ background: m.role === 'user' ? '#2563EB' : 'rgba(255,255,255,0.06)' }}>{m.text}</div>
              </div>
            ))}
            {thinking && <div className="flex justify-start"><div className="px-3 py-2 rounded-2xl rounded-bl-sm text-sm text-slate-400" style={{ background: 'rgba(255,255,255,0.06)' }}>Thinking…</div></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-slate-700 flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask about Naibus…" className="flex-1 bg-slate-800 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: '#06B6D4' }} />
            <button onClick={send} disabled={thinking} className="px-3 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#2563EB,#06B6D4)' }}>Send</button>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
