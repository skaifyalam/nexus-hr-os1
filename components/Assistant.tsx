'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { HelpCircle, X, Lightbulb } from 'lucide-react';

const GUIDES: { match: (p: string) => boolean; title: string; tips: string[] }[] = [
  {
    match: p => p === '/dashboard',
    title: 'Dashboard',
    tips: [
      'Click "Add Widget" to create any metric — counts, breakdowns, sums — from any section.',
      'Drag any widget card onto another to rearrange your dashboard.',
      'Hover a widget and click ✕ to remove it.',
    ],
  },
  {
    match: p => p.startsWith('/s/'),
    title: 'Working with your data',
    tips: [
      'Change a Status directly in the table — a popup captures the date and remarks automatically.',
      'Click the clock icon on any row to see its full stage history.',
      '"Stage Flow" maps each status to the date column it should fill.',
      '"Fields" lets you edit columns, set dropdown options, and configure Active/Inactive tabs.',
      'Import the same Excel again anytime — existing records update by ID, new ones are added.',
      'Export gives you back your exact original column layout.',
    ],
  },
  {
    match: p => p === '/requisitions',
    title: 'Requisitions',
    tips: [
      '"Single" creates one requisition with one position. "Bulk Add" puts many positions under one REQ ID.',
      'In bulk mode, fill positions like a spreadsheet — headers on top, one row per position.',
      '"Fields" defines what a requisition and its positions contain — fully yours to design.',
    ],
  },
  {
    match: p => p === '/compliance',
    title: 'Localization Compliance',
    tips: [
      'Add a rule: pick your nationality field, click which values count as "local", set your target %.',
      'The card shows your live % and the exact hires needed to reach — or stay above — target.',
      'Set the profession field to track Iqama professions of your local workforce.',
    ],
  },
  {
    match: p => p === '/analytics',
    title: 'Delay Analysis',
    tips: [
      'This builds itself from your stage changes — every status update with a date feeds it.',
      'Red bars = stages where candidates spend the longest. Start your investigations there.',
      '"Stuck longest" is your daily follow-up list.',
    ],
  },
  {
    match: p => p === '/structure',
    title: 'Org Structure',
    tips: [
      'Add your company first, then countries, projects, and departments under it.',
      'Drag any box onto another box to move it (with all its children).',
      'Hover a box for quick add (+) and delete actions.',
    ],
  },
  {
    match: p => p === '/brain',
    title: 'Company Brain',
    tips: [
      'Upload policies, contracts, or manuals — AI summarizes and extracts key points.',
      'Then ask questions in plain language; answers come from your own documents.',
    ],
  },
  {
    match: p => p === '/reports',
    title: 'AI Reports',
    tips: [
      'Describe the report you want in plain words — it generates from your live data.',
      'Download as Excel, Word, or PowerPoint for meetings.',
    ],
  },
];

const DEFAULT_GUIDE = {
  title: 'NEXUS HR',
  tips: [
    'Every section is built from YOUR Excel — upload and AI creates the structure.',
    'Use the sidebar to move between your data, reports, and settings.',
    'Switch or create companies from the bottom of the sidebar.',
  ],
};

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || '/';
  const guide = GUIDES.find(g => g.match(pathname)) || DEFAULT_GUIDE;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        title="Help & tips"
        className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-300 flex items-center justify-center hover:bg-indigo-700 transition-all hover:scale-105"
      >
        {open ? <X size={18} /> : <HelpCircle size={18} />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 bg-indigo-600 text-white flex items-center gap-2">
            <Lightbulb size={15} />
            <p className="text-sm font-semibold">{guide.title} — quick help</p>
          </div>
          <div className="p-4 space-y-2.5 max-h-96 overflow-y-auto">
            {guide.tips.map((t, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-xs text-slate-600 leading-relaxed">{t}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
