import React from 'react';
import { useAnalyticsDashboard } from '../../hooks/useAnalyticsDashboard';
import { DomainDashboardView } from './DomainDashboardView';
import {
  BarChart3,
  Film,
  Clapperboard,
  CheckSquare,
  Users,
  Briefcase,
  Cpu,
  Send,
  Calendar,
  RefreshCcw,
} from 'lucide-react';

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  projects: <Film className="w-4 h-4" />,
  production: <Clapperboard className="w-4 h-4" />,
  tasks: <CheckSquare className="w-4 h-4" />,
  artists: <Users className="w-4 h-4" />,
  vendors: <Briefcase className="w-4 h-4" />,
  resources: <Cpu className="w-4 h-4" />,
  delivery: <Send className="w-4 h-4" />,
};

export const AnalyticsWorkspace: React.FC = () => {
  const {
    activeDomain,
    setActiveDomain,
    dashboard,
    availableDomains,
    loading,
    timeframe,
    setTimeframe,
    refresh,
  } = useAnalyticsDashboard();

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between flex-wrap gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Studio Telemetry & Performance Analytics</span>
            </h1>
            <p className="text-xs text-slate-400">
              Live domain dashboards, render node saturation, and velocity forecasting
            </p>
          </div>
        </div>

        {/* Timeframe selector & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
            {(['7d', '30d', '90d', 'live'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg uppercase text-[11px] font-mono transition-colors cursor-pointer ${
                  timeframe === tf
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={refresh}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Refresh telemetry metrics"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Domain Nav */}
        <aside className="w-64 border-r border-slate-800/80 bg-slate-950/70 p-3 space-y-1 overflow-y-auto shrink-0 select-none">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5">
            Analytics Domains
          </div>
          {availableDomains.map((dom) => {
            const isSelected = activeDomain === dom.id;
            return (
              <button
                key={dom.id}
                id={`btn-nav-domain-${dom.id}`}
                onClick={() => setActiveDomain(dom.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-600/30 text-indigo-300' : 'bg-slate-900 text-slate-400'}`}>
                  {DOMAIN_ICONS[dom.id] || <BarChart3 className="w-4 h-4" />}
                </div>
                <div className="truncate">
                  <div className="truncate font-medium">{dom.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{dom.description}</div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Right Dashboard Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <DomainDashboardView dashboard={dashboard} />
          </div>
        </main>
      </div>
    </div>
  );
};
