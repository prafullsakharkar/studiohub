import React from 'react';
import { AIPermissionContext } from '@/types/intelligence';
import { ShieldCheck, Lock, Building, Film } from 'lucide-react';

interface AIPermissionBannerProps {
  context: AIPermissionContext | null;
}

export const AIPermissionBanner: React.FC<AIPermissionBannerProps> = ({ context }) => {
  if (!context) return null;

  return (
    <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-teal-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span>AI Security & Isolation Enforced</span>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
          <Building className="w-3 h-3 text-indigo-400" />
          <span className="text-slate-400">Org:</span>
          <span className="font-semibold text-slate-200">{context.active_organization_name}</span>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
          <Film className="w-3 h-3 text-emerald-400" />
          <span className="text-slate-400">Scope:</span>
          <span className="font-mono font-semibold text-emerald-400">[{context.active_project_code}]</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <Lock className="w-3 h-3 text-slate-400" />
        <span>Role: <strong className="text-slate-300">{context.user_role}</strong></span>
        <span>•</span>
        <span>Zero Cross-Tenant Leakage</span>
      </div>
    </div>
  );
};
