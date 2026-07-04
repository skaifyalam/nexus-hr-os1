'use client';
import { useState } from 'react';
import { Plus, X, Trash2, Building2, Globe, Briefcase, Users, User, GripVertical, Network } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const NODE_TYPES = [
  { v: 'company', label: 'Company', icon: Building2, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { v: 'country', label: 'Country', icon: Globe, color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { v: 'project', label: 'Project', icon: Briefcase, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { v: 'department', label: 'Department', icon: Users, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { v: 'position', label: 'Position / Person', icon: User, color: 'bg-violet-100 text-violet-700 border-violet-200' },
];
const typeOf = (t: string) => NODE_TYPES.find(n => n.v === t) || NODE_TYPES[4];

export default function StructureClient({ initialNodes, companyId }: { initialNodes: any[]; companyId: string }) {
  const [nodes, setNodes] = useState(initialNodes);
  const [addingUnder, setAddingUnder] = useState<string | 'root' | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('department');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | 'root' | null>(null);
  const supabase = createClient();

  const children = (parentId: string | null) =>
    nodes.filter(n => (n.parent_id || null) === parentId).sort((a, b) => a.sort_order - b.sort_order);

  const addNode = async () => {
    if (!newLabel.trim() || addingUnder === null) return;
    const parent = addingUnder === 'root' ? null : addingUnder;
    const { data } = await supabase.from('org_nodes').insert({
      company_id: companyId, parent_id: parent, label: newLabel.trim(),
      node_type: newType, sort_order: children(parent).length,
    }).select().single();
    if (data) setNodes(p => [...p, data]);
    setNewLabel(''); setAddingUnder(null);
  };

  const deleteNode = async (id: string) => {
    await supabase.from('org_nodes').delete().eq('id', id);
    // cascade removes descendants in DB; mirror locally
    const removeIds = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      nodes.forEach(n => {
        if (n.parent_id && removeIds.has(n.parent_id) && !removeIds.has(n.id)) { removeIds.add(n.id); grew = true; }
      });
    }
    setNodes(p => p.filter(n => !removeIds.has(n.id)));
  };

  // Is `candidate` a descendant of `nodeId`? (prevent dropping onto own child)
  const isDescendant = (nodeId: string, candidate: string): boolean => {
    let cur = nodes.find(n => n.id === candidate);
    while (cur?.parent_id) {
      if (cur.parent_id === nodeId) return true;
      cur = nodes.find(n => n.id === cur!.parent_id);
    }
    return false;
  };

  const dropOn = async (targetId: string | 'root') => {
    setDragOver(null);
    if (!dragging) return;
    const newParent = targetId === 'root' ? null : targetId;
    if (dragging === targetId) { setDragging(null); return; }
    if (newParent && isDescendant(dragging, newParent)) { setDragging(null); return; }
    await supabase.from('org_nodes').update({ parent_id: newParent }).eq('id', dragging);
    setNodes(p => p.map(n => n.id === dragging ? { ...n, parent_id: newParent } : n));
    setDragging(null);
  };

  const NodeCard = ({ node, depth }: { node: any; depth: number }) => {
    const t = typeOf(node.node_type);
    const kids = children(node.id);
    return (
      <div className="relative">
        <div
          draggable
          onDragStart={() => setDragging(node.id)}
          onDragOver={e => { e.preventDefault(); setDragOver(node.id); }}
          onDragLeave={() => setDragOver(d => d === node.id ? null : d)}
          onDrop={() => dropOn(node.id)}
          className={`group flex items-center gap-2 border rounded-xl px-3 py-2 bg-white shadow-sm transition-all cursor-grab active:cursor-grabbing ${dragOver === node.id ? 'ring-2 ring-indigo-400 border-indigo-300' : 'border-slate-200'} ${dragging === node.id ? 'opacity-40' : ''}`}
        >
          <GripVertical size={12} className="text-slate-300 flex-shrink-0" />
          <span className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 ${t.color}`}><t.icon size={12} /></span>
          <span className="text-sm text-slate-700 font-medium truncate">{node.label}</span>
          <span className="text-xs text-slate-400 flex-shrink-0">{t.label}</span>
          <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => { setAddingUnder(node.id); setNewLabel(''); }} title="Add under this" className="p-1 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Plus size={13} /></button>
            <button onClick={() => deleteNode(node.id)} title="Delete (with children)" className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
          </div>
        </div>

        {addingUnder === node.id && (
          <div className="mt-2 ml-8 flex gap-2 items-center">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNode()} autoFocus placeholder="Name…"
              className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <select value={newType} onChange={e => setNewType(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white">
              {NODE_TYPES.map(nt => <option key={nt.v} value={nt.v}>{nt.label}</option>)}
            </select>
            <button onClick={addNode} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg">Add</button>
            <button onClick={() => setAddingUnder(null)} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={13} /></button>
          </div>
        )}

        {kids.length > 0 && (
          <div className="ml-6 mt-2 pl-4 border-l-2 border-slate-100 space-y-2">
            {kids.map(k => <NodeCard key={k.id} node={k} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  };

  const roots = children(null);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Org Structure</h1>
          <p className="text-sm text-slate-500 mt-0.5">Build your hierarchy — companies, countries, projects, departments. Drag any box onto another to move it.</p>
        </div>
        <button onClick={() => { setAddingUnder('root'); setNewLabel(''); setNewType('company'); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200">
          <Plus size={14} />Add Top Level
        </button>
      </div>

      {/* Root drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver('root'); }}
        onDragLeave={() => setDragOver(d => d === 'root' ? null : d)}
        onDrop={() => dropOn('root')}
        className={`rounded-2xl transition-all ${dragOver === 'root' ? 'ring-2 ring-indigo-400 bg-indigo-50/50 p-3' : ''}`}
      >
        {roots.length === 0 && addingUnder !== 'root' ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
            <Network size={36} className="text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 mb-1">Map your organization</p>
            <p className="text-xs text-slate-400 mb-5 max-w-md mx-auto">Start with your company (or companies), then add countries, projects, and departments under them. You can drag boxes to rearrange anytime.</p>
            <button onClick={() => { setAddingUnder('root'); setNewType('company'); }} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
              <Plus size={15} />Add Your Company
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {roots.map(r => <NodeCard key={r.id} node={r} depth={0} />)}
            {addingUnder === 'root' && (
              <div className="flex gap-2 items-center">
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNode()} autoFocus placeholder="e.g. NBTC Group"
                  className="flex-1 max-w-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <select value={newType} onChange={e => setNewType(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                  {NODE_TYPES.map(nt => <option key={nt.v} value={nt.v}>{nt.label}</option>)}
                </select>
                <button onClick={addNode} className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg">Add</button>
                <button onClick={() => setAddingUnder(null)} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={13} /></button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
