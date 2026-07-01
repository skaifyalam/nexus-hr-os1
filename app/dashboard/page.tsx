import { createServerClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shellData';
import Shell from '@/components/Shell';
import { Users, Briefcase, AlertTriangle, Calendar } from 'lucide-react';
export default async function DashboardPage() {
  const supabase = createServerClient();
  const { profile, sections } = await getShellData();
  const [{ data: emp }, { data: reqs }, { data: lv }] = await Promise.all([
    supabase.from('employees').select('status,iqama_expiry,passport_expiry'),
    supabase.from('requisitions').select('status'),
    supabase.from('leave_requests').select('status'),
  ]);
  const today = new Date();
  const du = (d: string) => d ? Math.ceil((new Date(d).getTime()-today.getTime())/86400000) : 999;
  const e=emp||[], r=reqs||[], l=lv||[];
  const stats=[
    {label:'Total Headcount',value:e.length,sub:`${e.filter(x=>x.status==='active').length} active`,icon:Users,cls:'bg-indigo-50 text-indigo-600'},
    {label:'Open Requisitions',value:r.filter(x=>x.status==='open'||x.status==='in_progress').length,sub:`${r.length} total`,icon:Briefcase,cls:'bg-violet-50 text-violet-600'},
    {label:'Document Alerts',value:e.filter(x=>(x.iqama_expiry&&du(x.iqama_expiry)<=60)||(x.passport_expiry&&du(x.passport_expiry)<=60)).length,sub:'expiring ≤60 days',icon:AlertTriangle,cls:'bg-amber-50 text-amber-600'},
    {label:'Pending Leaves',value:l.filter(x=>x.status==='pending').length,sub:'need approval',icon:Calendar,cls:'bg-emerald-50 text-emerald-600'},
  ];
  return (
    <Shell current="/dashboard" profile={profile} sections={sections} companyId={profile?.company_id||''}>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">HR Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5 mb-6">Live data from your NEXUS HR database</p>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {stats.map((s,i)=>(
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.cls}`}><s.icon size={16}/></div>
              <div className="text-3xl font-bold text-slate-900 mb-0.5">{s.value}</div>
              <div className="text-xs font-medium text-slate-500">{s.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
        {e.length===0&&<div className="bg-white rounded-2xl border border-slate-100 p-8 text-center"><p className="text-sm text-slate-500">No employees yet. Go to Field Configurator first to define your columns, then add employees.</p></div>}
      </div>
    </Shell>
  );
}
