import React from 'react';
import {
  Play,
  CheckSquare,
  ShieldCheck,
  PlaySquare,
  UploadCloud,
  Send,
  GitBranch,
  Zap,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { WorkflowNodeType } from '@/types/workflow';

interface NodePaletteProps {
  onAddNode: (type: WorkflowNodeType) => void;
}

const paletteItems: Array<{
  type: WorkflowNodeType;
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  desc: string;
}> = [
  {
    type: 'start',
    label: 'Start Event',
    category: 'Trigger',
    icon: Play,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-400',
    desc: 'Ingest or initial trigger',
  },
  {
    type: 'task',
    label: 'Task Step',
    category: 'Production',
    icon: CheckSquare,
    color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10 hover:border-indigo-400',
    desc: 'DCC Work (Maya/Nuke/Houdini)',
  },
  {
    type: 'approval',
    label: 'Approval Gate',
    category: 'Governance',
    icon: ShieldCheck,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10 hover:border-amber-400',
    desc: 'Supervisor signoff gate',
  },
  {
    type: 'review',
    label: 'Review Session',
    category: 'Screening',
    icon: PlaySquare,
    color: 'text-purple-400 border-purple-500/30 bg-purple-500/10 hover:border-purple-400',
    desc: 'Screening room dailies',
  },
  {
    type: 'publish',
    label: 'Studio Publish',
    category: 'Catalog',
    icon: UploadCloud,
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10 hover:border-cyan-400',
    desc: 'OpenUSD & EXR validation',
  },
  {
    type: 'delivery',
    label: 'Client Delivery',
    category: 'Turnover',
    icon: Send,
    color: 'text-teal-400 border-teal-500/30 bg-teal-500/10 hover:border-teal-400',
    desc: 'Aspera & Signiant transfer',
  },
  {
    type: 'condition',
    label: 'Condition Split',
    category: 'Logic',
    icon: GitBranch,
    color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10 hover:border-yellow-400',
    desc: 'True / False decision split',
  },
  {
    type: 'automation',
    label: 'Automation',
    category: 'Hooks',
    icon: Zap,
    color: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10 hover:border-fuchsia-400',
    desc: 'Multi-action event cascade',
  },
  {
    type: 'end',
    label: 'End Milestone',
    category: 'Terminal',
    icon: CheckCircle2,
    color: 'text-slate-400 border-slate-700 bg-slate-800/40 hover:border-slate-500',
    desc: 'Archive or finish pipeline',
  },
];

export const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  return (
    <div className="w-64 bg-slate-900/95 border-r border-slate-800 p-4 flex flex-col h-full overflow-y-auto">
      <div className="pb-3 border-b border-slate-800 mb-3">
        <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          DAG Node Library
        </h3>
        <p className="text-[11px] text-slate-400 mt-1">
          Click node to spawn onto the active canvas.
        </p>
      </div>

      <div className="space-y-2">
        {paletteItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onAddNode(item.type)}
              className={`w-full p-2.5 rounded-xl border ${item.color} text-left transition-all hover:scale-[1.02] flex items-center gap-3 group shadow-sm`}
            >
              <div className="p-2 rounded-lg bg-slate-950/80 shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate group-hover:text-indigo-300">
                    {item.label}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 uppercase">
                    {item.category}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
