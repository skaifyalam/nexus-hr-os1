'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Upload, Users, GitBranch, LayoutDashboard, ArrowRight, Sparkles, X, Check } from 'lucide-react';

// Shows on the dashboard when a new company has little/no data yet.
// Turns an empty dashboard into a guided first-run experience.
export default function WelcomeGuide({ sections, hasData, companyName }: {
  sections: any[]; hasData: boolean; companyName?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (hasData || dismissed) return null;

  const employeeSection = sections.find(s => s.section_key === 'employee');
  const recruitmentSection = sections.find(s => s.section_key === 'candidate');

  const steps = [
    {
      icon: Users,
      title: 'Upload your employee list',
      desc: 'Drop in your Excel — AI reads your columns and builds the section automatically. No setup, no templates.',
      href: employeeSection ? '/s/employee' : (sections[0] ? `/s/${sections[0].section_key}` : '/dashboard'),
      cta: 'Go to Employees',
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      icon: GitBranch,
      title: 'Load your recruitment pipeline',
      desc: 'Upload your candidate tracker — every stage, date, and status comes in exactly as your sheet has it.',
      href: recruitmentSection ? '/s/candidate' : '/dashboard',
      cta: 'Go to Recruitment',
      color: 'bg-violet-50 text-violet-600',
      hide: !recruitmentSection,
    },
    {
      icon: LayoutDashboard,
      title: 'Build your dashboard',
      desc: 'Once your data is in, add widgets for any metric you care about — headcount, pipeline, breakdowns.',
      href: '/dashboard',
      cta: 'Add a widget',
      color: 'bg-emerald-50 text-emerald-600',
    },
  ].filter(s => !s.hide);

  return (
    <div className="mb-6 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white relative overflow-hidden">
      <button onClick={() => setDismissed(true)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
        <X size={16} />
      </button>

      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} />
        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Getting Started</span>
      </div>
      <h2 className="text-xl font-bold mb-1">Welcome{companyName ? `, ${companyName}` : ''} 👋</h2>
      <p className="text-sm text-white/80 mb-5 max-w-lg">Your workspace is empty and ready. The fastest way to see NEXUS HR come alive is to upload one Excel file — everything builds from your own data.</p>

      <div className="grid md:grid-cols-3 gap-3">
        {steps.map((s, i) => (
          <Link key={i} href={s.href} className="group bg-white rounded-xl p-4 text-slate-900 hover:shadow-lg transition-all">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon size={17} />
            </div>
            <p className="text-sm font-semibold mb-1">{s.title}</p>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">{s.desc}</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 group-hover:gap-2 transition-all">
              {s.cta} <ArrowRight size={12} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
