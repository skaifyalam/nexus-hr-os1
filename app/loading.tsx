// Shown automatically by Next.js whenever a route segment is loading its data.
// Gives instant feedback that navigation registered and the page is on its way.
export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50/60 backdrop-blur-[1px] z-40">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-[3px] border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-xs font-medium text-slate-400">Loading…</p>
      </div>
    </div>
  );
}
