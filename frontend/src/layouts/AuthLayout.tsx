import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sparkles, Clapperboard, Layers, Cpu } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen w-screen flex bg-slate-950 text-slate-100 antialiased overflow-hidden">
      {/* Left Feature Showcase Banner (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 border-r border-slate-800">
        <div className="relative z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">StudioHub VFX</h1>
              <p className="text-xs text-indigo-400 font-mono">Production Operating System</p>
            </div>
          </div>
        </div>

        {/* Studio Highlights Bento */}
        <div className="relative z-10 space-y-6 my-auto">
          <div className="space-y-3">
            <span className="px-3 py-1 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              OPENUSD & ACES 1.3 NATIVE
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
              Enterprise VFX & Animation Production Management.
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
              Manage high-volume shot iterations, asset versions, Maya/Houdini/Nuke pipeline workflows, and screening room approvals with mathematically reliable Clean Architecture.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <Clapperboard className="w-5 h-5 text-indigo-400 mb-2" />
              <h4 className="text-xs font-bold text-white">Real-Time Shot Tracking</h4>
              <p className="text-[11px] text-slate-400">Department pipeline transitions from Layout to Comp.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <Layers className="w-5 h-5 text-indigo-400 mb-2" />
              <h4 className="text-xs font-bold text-white">OpenUSD Asset Graph</h4>
              <p className="text-[11px] text-slate-400">Unified digital assets, LODs, shaders, and variant sets.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500">
          <span>Apex Digital Studios Platform v2.4</span>
          <span className="flex items-center gap-1.5 font-mono">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Secure JWT & RBAC Active
          </span>
        </div>
      </div>

      {/* Right Login / Auth Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
};
