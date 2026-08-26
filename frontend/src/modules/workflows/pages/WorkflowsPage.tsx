import React from 'react';
import { GitFork, Sparkles, Zap, ShieldCheck, CheckCircle2, Play, Layers } from 'lucide-react';
import { WorkflowStudio } from '../components/WorkflowStudio';

export const WorkflowsPage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Studio Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Workflow & Production Automation
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  v2.4 Engine
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Rules Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Visual pipeline state-machine builder with task status transitions, permission-aware approval gates, and automated triggers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-4 px-3.5 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>RBAC Enforced</span>
              </div>
              <div className="h-3.5 w-px bg-slate-800" />
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Event Bus Ready</span>
              </div>
              <div className="h-3.5 w-px bg-slate-800" />
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>DAG Simulator</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio View */}
      <div className="flex-1 min-h-0 p-4 sm:p-5 flex flex-col overflow-y-auto custom-scrollbar">
        <WorkflowStudio />
      </div>
    </div>
  );
};
