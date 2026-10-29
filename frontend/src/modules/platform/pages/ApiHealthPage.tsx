import React from 'react';
import { Activity, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiHealthDashboard } from '../components/ApiHealthDashboard';
import { Button } from '@/shared/components/Button';

export const ApiHealthPage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-y-auto custom-scrollbar">
      {/* Page Header */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/platform/admin">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Platform Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                API Endpoints & Core Services Health
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time operational status, latency waterfall, SLA compliance, and distributed cluster telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link to="/testing" className="text-xs font-mono px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors">
              Open QA Runner
            </Link>
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              SLA 99.98% Operational
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 p-4 sm:p-6 w-full">
        <ApiHealthDashboard />
      </div>
    </div>
  );
};
