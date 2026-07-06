'use client';
import { useState } from 'react';
import Link from 'next/link';
import { User, Phone, Mail, Lock, Check, CreditCard, Users, Calendar, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function AccountClient({ profile, isSuper, subscription, employeeCount }: {
  profile: any; isSuper: boolean; subscription: any; employeeCount: number;
}) {
  const supabase = createClient();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savedProfile, setSavedProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');

  const deleteAccount = async () => {
    setDeleting(true); setDeleteMsg('');
    try {
      const res = await fetch('/api/delete-account', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setDeleteMsg(json.error || 'Delete failed.'); setDeleting(false); return; }
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (e: any) { setDeleteMsg(e.message); setDeleting(false); }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', profile.id);
    setSavingProfile(false); setSavedProfile(true); setTimeout(() => setSavedProfile(false), 2500);
  };

  const changePassword = async () => {
    setPwMsg('');
    if (pw1.length < 6) { setPwMsg('Password must be at least 6 characters.'); return; }
    if (pw1 !== pw2) { setPwMsg('Passwords do not match.'); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setPwSaving(false);
    if (error) { setPwMsg(error.message); return; }
    setPw1(''); setPw2(''); setPwMsg('✓ Password updated.');
    setTimeout(() => setPwMsg(''), 3000);
  };

  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Account</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your profile, password{isSuper ? ', and subscription' : ''}</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center"><User size={20} className="text-indigo-600" /></div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-slate-400 capitalize">{(profile?.role || '').replace('_', ' ')}</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Full name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+966…" className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <div className="flex items-center gap-2 border border-slate-100 bg-slate-50 rounded-xl px-3.5 py-2.5 text-sm text-slate-500">
              <Mail size={14} />{profile?.email}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={saveProfile} disabled={savingProfile} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">{savingProfile ? 'Saving…' : 'Save changes'}</button>
          {savedProfile && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check size={13} />Saved</span>}
        </div>
      </div>

      {/* Password card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Change Password</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">New password</label>
            <input type="password" value={pw1} onChange={e => setPw1(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Confirm password</label>
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={changePassword} disabled={pwSaving} className="px-4 py-2.5 text-sm font-medium bg-slate-800 text-white rounded-xl hover:bg-slate-900 disabled:opacity-50">{pwSaving ? 'Updating…' : 'Update password'}</button>
          {pwMsg && <span className={`text-xs ${pwMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{pwMsg}</span>}
        </div>
      </div>

      {/* Billing + usage — SUPER USER ONLY */}
      {isSuper && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800">Subscription & Usage</h3>
            </div>
            <Link href="/billing" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:gap-2 transition-all">Manage plans <ArrowRight size={12} /></Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1"><Users size={14} className="text-indigo-500" /><span className="text-xs text-slate-500">Employees</span></div>
              <p className="text-xl font-bold text-slate-900">{employeeCount.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1"><CreditCard size={14} className="text-violet-500" /><span className="text-xs text-slate-500">Plan</span></div>
              <p className="text-xl font-bold text-slate-900 capitalize">{subscription?.plan || 'Trial'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1"><Calendar size={14} className="text-amber-500" /><span className="text-xs text-slate-500">{subscription?.status === 'trialing' ? 'Trial ends in' : 'Status'}</span></div>
              <p className="text-xl font-bold text-slate-900">{subscription?.status === 'trialing' ? `${trialDaysLeft}d` : (subscription?.status || 'Active')}</p>
            </div>
          </div>
        </div>
      )}
      {/* Danger zone — SUPER USER ONLY */}
      {isSuper && (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock size={16} className="text-red-400" />
            <h3 className="text-sm font-semibold text-red-700">Delete Account</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Permanently delete your account and login. This cannot be undone. Your company data is not automatically removed — contact support if you also want company data erased.</p>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="px-4 py-2.5 text-sm font-medium bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50">Delete my account</button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-red-600">Are you sure? This is permanent.</span>
              <button onClick={deleteAccount} disabled={deleting} className="px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting…' : 'Yes, delete permanently'}</button>
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-600">Cancel</button>
            </div>
          )}
          {deleteMsg && <p className="text-xs text-red-500 mt-2">{deleteMsg}</p>}
        </div>
      )}
    </div>
  );
}
