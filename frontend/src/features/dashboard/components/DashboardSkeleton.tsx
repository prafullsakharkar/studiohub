import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-slate-900/80 border-b border-slate-800/80 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-48 bg-slate-800 rounded" />
                <div className="h-4 w-16 bg-slate-800 rounded-full" />
                <div className="h-4 w-20 bg-slate-800 rounded-full" />
              </div>
              <div className="h-3 w-80 bg-slate-800/60 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-slate-800 rounded-lg" />
            <div className="h-8 w-28 bg-slate-800 rounded-lg" />
            <div className="h-8 w-28 bg-slate-800 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Main HUD Body Skeleton */}
      <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-3">
              <div className="flex justify-between">
                <div className="h-2.5 w-16 bg-slate-800 rounded" />
                <div className="w-4 h-4 bg-slate-800 rounded" />
              </div>
              <div className="h-6 w-20 bg-slate-800 rounded" />
              <div className="h-2 w-full bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>

        {/* Middle Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-48 rounded-xl bg-slate-900/90 border border-slate-800/80 p-5 space-y-4">
              <div className="h-4 w-36 bg-slate-800 rounded" />
              <div className="h-6 w-full bg-slate-800/60 rounded" />
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="h-10 bg-slate-800/50 rounded" />
                <div className="h-10 bg-slate-800/50 rounded" />
                <div className="h-10 bg-slate-800/50 rounded" />
              </div>
            </div>

            <div className="h-64 rounded-xl bg-slate-900/90 border border-slate-800/80 p-5 space-y-3">
              <div className="h-4 w-40 bg-slate-800 rounded" />
              <div className="h-8 w-full bg-slate-800/60 rounded" />
              <div className="space-y-2 pt-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-800/40 rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="h-48 rounded-xl bg-slate-900/90 border border-slate-800/80 p-5 space-y-3">
              <div className="h-4 w-32 bg-slate-800 rounded" />
              <div className="h-16 w-full bg-slate-800/50 rounded" />
              <div className="h-8 w-full bg-slate-800/40 rounded" />
            </div>

            <div className="h-64 rounded-xl bg-slate-900/90 border border-slate-800/80 p-5 space-y-3">
              <div className="h-4 w-32 bg-slate-800 rounded" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-9 bg-slate-800/40 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
