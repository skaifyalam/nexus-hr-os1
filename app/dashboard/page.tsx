import { createServerClient } from '@/lib/supabase/server';
import Shell from '@/components/Shell';
import { Users, Briefcase, AlertTriangle, Calendar } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();

  const { data: employees } = await supabase.from('employees').select('*');
  const { data: requisitions } = await supabase.from('requisitions').select('*');
  const { data: leaves } = await supabase.from('leave_requests').select('*');

  const emp = employees || [];
  const reqs = requisitions || [];
  const lv = leaves || [];

  const active = emp.filter((e) => e.status === 'active').length;
  const today = new Date();
  const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - today.getTime()) / 86400000);
  const expiring = emp.filter(
    (e) => (e.iqama_expiry && daysUntil(e.iqama_expiry) <= 60) || (e.passport_expiry && daysUntil(e.passport_expiry) <= 60)
  ).length;
  const pendingLeaves = lv.filter((l) => l.status === 'pending').length;
  const openReqs = reqs.filter((r) => r.status === 'open' || r.status === 'in_progress').length;

  const stats = [
    { label: 'Total Headcount', value: emp.length, sub: `${active} active`, icon: Users, light: 'bg-indigo-50 text-indigo-600' },
    { label: 'Open Requisitions', value: openReqs, sub: `${reqs.length} total`, icon: Briefcase, light: 'bg-violet-50 text-violet-600' },
    { label: 'Document Alerts', value: expiring, sub: 'expiring ≤60 days', icon: AlertTriangle, light: 'bg-amber-50 text-amber-600' },
    { label: 'Pending Leaves', value: pendingLeaves, sub: 'need approval', icon: Calendar, light: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <Shell current="/dashboard" profile={profile}>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">HR Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5 mb-6">Live data from your NEXUS HR database</p>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.light}`}>
                <s.icon size={16} />
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-0.5">{s.value}</div>
              <div className="text-xs font-medium text-slate-500">{s.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {emp.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <p className="text-sm text-slate-500">No employees yet. Go to the Employees page to add your first one, or import an Excel file.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
