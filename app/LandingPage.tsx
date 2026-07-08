'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

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
    const N = Math.min(42, Math.floor((w * h) / 24000));
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.6 + 1,
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
          if (dist < 120) {
            const op = (1 - dist / 120) * 0.28;
            const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            grad.addColorStop(0, 'rgba(37,99,235,' + op + ')');
            grad.addColorStop(1, 'rgba(6,182,212,' + op + ')');
            ctx.strokeStyle = grad; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(37,99,235,0.5)'; ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.9 }} />;
}

const NAVY = '#0F172A';
const GRAD = 'linear-gradient(135deg,#2563EB,#06B6D4)';
const FEATURES = [
  { k: 'Universal engine', d: 'Upload your Excel — AI builds your workspace: fields, dropdowns, ID formats and pipeline stages. Nothing hardcoded.', c: '#2563EB' },
  { k: 'Recruitment & pipeline', d: 'Track candidates through every stage, with Kanban boards and stage history that reflect how your company actually works.', c: '#06B6D4' },
  { k: 'Visa management', d: 'Blocks, allocation across agencies, Ewakala batch-issuing, stamping — the full Gulf visa workflow, built for the real process.', c: '#10B981' },
  { k: 'Leave, attendance, performance', d: 'The everyday HR operations, with bulk import, criteria-based policies and clean approval routing.', c: '#2563EB' },
  { k: 'Roles & approvals', d: 'Custom roles, per-field confidentiality, project scoping, and approval chains you define for any process.', c: '#06B6D4' },
  { k: 'Employee 360', d: 'One screen for everything about a person — leave, visa, documents, conduct, performance — all linked and live.', c: '#10B981' },
];

const AI_CONTEXT = "You are the Naibus assistant on the Naibus Technologies website. Answer ONLY about what Naibus is and does, based on these facts. Be concise, friendly, honest. If asked something you don't know, say you'll connect them with the team — never invent features, prices, or customers. FACTS: Naibus is an intelligent HR and business operating system for companies, focused on the GCC / Saudi market. Core: a universal engine where each company uploads their own Excel and AI builds their workspace (fields, dropdowns, ID formats, pipeline stages) — nothing hardcoded. Modules: Employees, Recruitment pipeline, Requisitions, Leave, Attendance, Performance, Documents (Iqama/passport/visa expiry), Visa Management (blocks, allocation, Ewakala, stamping), Conduct & Exit, Grievances, Employee 360 profile. Platform: custom roles, permissions with real enforcement, confidential fields, project scoping, approval workflows, multi-company, AI reports, Company Brain. Visa workflow is a key differentiator. Pricing is per-employee, competitive with BambooHR; for exact pricing tell them to contact the team. Naibus is early — the product is built; the company is being established. Be honest about track record; don't claim customers you can't verify. To get started, they can sign up on this page or book a demo.";

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
      setMessages(m => [...m, { role: 'assistant', text: data.answer || "I'll connect you with the team for that — try Book a demo." }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Something went wrong. Please try again.' }]);
    }
    setThinking(false);
  };

  return (
    <div style={{ background: '#FFFFFF', color: NAVY, fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif" }} className="min-h-screen overflow-x-hidden">
      <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-slate-100">
        <div className="flex items-center justify-between px-6 md:px-12 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: GRAD }}>
              <span className="text-white font-bold">N</span>
            </div>
            <div>
              <p className="font-bold leading-none" style={{ color: NAVY }}>Naibus</p>
              <p className="text-[10px] tracking-wider" style={{ color: '#06B6D4' }}>TECHNOLOGIES</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Sign in</Link>
            <Link href="/login?mode=signup" className="text-sm font-medium px-4 py-2 rounded-xl text-white transition-transform hover:scale-105" style={{ background: GRAD }}>Get started</Link>
          </div>
        </div>
      </nav>

      <header className="relative min-h-[82vh] flex items-center">
        <div className="absolute inset-0"><NodeNetwork /></div>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.06), transparent 55%)' }} />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center py-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-medium" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)', color: '#0891B2' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            The Business Intelligence Operating System
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 animate-[fadeUp_0.8s_ease]" style={{ color: NAVY }}>
            Intelligence behind<br />
            <span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>every business</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10 animate-[fadeUp_1s_ease]">
            Naibus unifies your people, processes and data on one intelligent platform. Upload your own Excel — AI builds your workspace. Start with HR: recruitment, visas, and the full employee lifecycle.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-[fadeUp_1.2s_ease]">
            <Link href="/login?mode=signup" className="px-6 py-3 rounded-xl font-medium text-white w-full sm:w-auto transition-transform hover:scale-105 shadow-lg shadow-blue-200" style={{ background: GRAD }}>Start free</Link>
            <button onClick={() => setChatOpen(true)} className="px-6 py-3 rounded-xl font-medium w-full sm:w-auto border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors">Ask the AI assistant</button>
          </div>
        </div>
      </header>

      <section className="border-y border-slate-100 py-8 bg-slate-50/60">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[['Intelligent', 'AI-built workspaces'], ['Unified', 'Every function connected'], ['Secure', 'Roles & confidentiality'], ['Built for the Gulf', 'Visa & Saudization ready']].map(([t, s]) => (
            <div key={t}>
              <p className="font-semibold" style={{ color: '#2563EB' }}>{t}</p>
              <p className="text-xs text-slate-500 mt-1">{s}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs tracking-widest mb-3 font-semibold" style={{ color: '#06B6D4' }}>WHAT NAIBUS DOES</p>
          <h2 className="text-3xl md:text-4xl font-bold" style={{ color: NAVY }}>One platform for your whole workforce</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.k} className="rounded-2xl p-6 bg-white border border-slate-100 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
              <div className="w-11 h-11 rounded-xl mb-4 flex items-center justify-center" style={{ background: f.c + '15', border: '1px solid ' + f.c + '40' }}>
                <span className="w-3 h-3 rounded-sm" style={{ background: f.c }} />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: NAVY }}>{f.k}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20" style={{ background: NAVY }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs tracking-widest mb-3 font-semibold" style={{ color: '#06B6D4' }}>WHERE WE'RE GOING</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">Start with HR. Grow into a business operating system.</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            Naibus begins where fragmented spreadsheets and disconnected tools slow companies down. Today it's a complete HR and workforce platform. The vision is a single intelligent system a company can run its operations from — with the same AI-built, nothing-hardcoded foundation.
          </p>
          <p className="text-sm text-slate-400">We're an early-stage company building deliberately. If that's the kind of partner you want, let's talk.</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-24">
        <div className="rounded-3xl p-10 text-center" style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.06),rgba(6,182,212,0.06))', border: '1px solid rgba(37,99,235,0.15)' }}>
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: NAVY }}>See Naibus with your own data</h2>
          <p className="text-slate-600 mb-8">Create an account and upload a sample Excel — watch AI build your workspace in minutes.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login?mode=signup" className="px-6 py-3 rounded-xl font-medium text-white w-full sm:w-auto transition-transform hover:scale-105 shadow-lg shadow-blue-200" style={{ background: GRAD }}>Get started free</Link>
            <button onClick={() => setChatOpen(true)} className="px-6 py-3 rounded-xl font-medium w-full sm:w-auto border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">Have questions? Ask AI</button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: GRAD }}><span className="text-white text-xs font-bold">N</span></div>
            <span style={{ color: NAVY }}>Naibus Technologies</span>
          </div>
          <p>Intelligence Behind Every Business</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-slate-900">Sign in</Link>
            <Link href="/login?mode=signup" className="hover:text-slate-900">Get started</Link>
          </div>
        </div>
      </footer>

      {!chatOpen && (
        <button onClick={() => setChatOpen(true)} className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110" style={{ background: GRAD }} aria-label="Open chat">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      )}
      {chatOpen && (
        <div className="fixed bottom-6 right-6 z-40 w-[92vw] max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden bg-white border border-slate-200" style={{ height: '520px' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ background: GRAD }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center"><span className="text-white text-xs font-bold">N</span></div>
              <div><p className="text-white text-sm font-semibold leading-none">Naibus Assistant</p><p className="text-white/70 text-[10px]">Ask about the product</p></div>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-white/80 hover:text-white" aria-label="Close chat">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={'max-w-[85%] px-3 py-2 rounded-2xl text-sm ' + (m.role === 'user' ? 'text-white rounded-br-sm' : 'text-slate-700 bg-white border border-slate-100 rounded-bl-sm')}
                  style={m.role === 'user' ? { background: '#2563EB' } : {}}>{m.text}</div>
              </div>
            ))}
            {thinking && <div className="flex justify-start"><div className="px-3 py-2 rounded-2xl rounded-bl-sm text-sm text-slate-400 bg-white border border-slate-100">Thinking…</div></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-slate-100 flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask about Naibus…" className="flex-1 bg-slate-100 text-sm text-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={send} disabled={thinking} className="px-3 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: GRAD }}>Send</button>
          </div>
        </div>
      )}

      <style>{'@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}'}</style>
    </div>
  );
}
