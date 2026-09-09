import React, { useState } from 'react';
import {
  Film,
  CheckCircle2,
  Clock,
  Layers,
  Cpu,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  PlaySquare,
  Sparkles,
  Users,
  Box,
  Sliders,
  Filter,
  CheckSquare,
  Activity,
  Zap,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { useProductionKpis, useDepartmentProgress } from '../hooks/useDashboardData';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { useShots } from '@/modules/shots/hooks/useShots';
import { useReviews } from '@/modules/reviews/hooks/useReviews';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useInspectorStore } from '@/shared/stores/useInspectorStore';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const openInspector = useInspectorStore((state) => state.openInspector);
  const { data: kpis, isLoading: isKpisLoading } = useProductionKpis();
  const { data: departments, isLoading: isDeptsLoading } = useDepartmentProgress();
  const { data: projectsData, isLoading: isProjectsLoading } = useProjects({ page_size: 4 });
  const { data: shotsData } = useShots({ page_size: 6, ordering: '-updated_at' });
  const { data: reviewsData } = useReviews({ page_size: 3 });

  const [activeDeptFilter, setActiveDeptFilter] = useState<string>('ALL');

  if (isKpisLoading || isDeptsLoading || isProjectsLoading) {
    return <LoadingSpinner size="lg" label="Aggregating VFX studio telemetry..." />;
  }

  const projects = projectsData?.results || [];
  const recentShots = shotsData?.results || [];
  const recentReviews = reviewsData?.results || [];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Studio Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Production Control Center
                  <span className="text-xs font-mono font-normal text-slate-400">({user?.role})</span>
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  [NK99] NEBULA KNIGHTS
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACEScg 1.3
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Resolution: 4096x2160 DCI • 24.00 fps • 18 sequence shots queued for supervisor approval
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <Link to="/reviews" className="inline-flex">
              <Button variant="primary" size="sm" leftIcon={<PlaySquare className="w-3.5 h-3.5" />}>
                Screening Room
              </Button>
            </Link>
            <Link to="/shots" className="inline-flex">
              <Button variant="outline" size="sm" leftIcon={<Film className="w-3.5 h-3.5" />}>
                Shot Matrix
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Studio View */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
        {/* KPI HUD Metric Cards (ShotGrid & Linear style) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Shots Cut */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[10px] uppercase">Sequence Shots</span>
            <Film className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">{kpis?.total_shots || 342}</span>
            <span className="text-[11px] text-emerald-400 font-mono">+14 cut this wk</span>
          </div>
          <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-1 border-t border-slate-800">
            <span>Approved: {kpis?.approved_shots || 198}</span>
            <span className="text-emerald-400">{Math.round(((kpis?.approved_shots || 198) / (kpis?.total_shots || 342)) * 100)}%</span>
          </div>
        </div>

        {/* Active WIP Tasks */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[10px] uppercase">Pipeline WIP</span>
            <Clock className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">{kpis?.in_progress_shots || 236}</span>
            <span className="text-[11px] text-sky-400 font-mono">112 In Review</span>
          </div>
          <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-1 border-t border-slate-800">
            <span>Discipline Stages</span>
            <span className="text-sky-300">5 Passes/Shot</span>
          </div>
        </div>

        {/* Storage SAN TB */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[10px] uppercase">NVMe Storage Quota</span>
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">{kpis?.storage_usage_tb || 168.4} TB</span>
            <span className="text-[11px] text-slate-400 font-mono">/ 250 TB</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-400 h-full rounded-full" style={{ width: '67%' }} />
          </div>
        </div>

        {/* Render Farm Blades */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[10px] uppercase">Deadline Render Farm</span>
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">
              {Math.round(((kpis?.render_nodes_busy || 94) / (kpis?.render_nodes_total || 128)) * 100)}%
            </span>
            <span className="text-[11px] text-emerald-400 font-mono">{kpis?.render_nodes_busy || 94}/128 Blades</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full"
              style={{ width: `${Math.round(((kpis?.render_nodes_busy || 94) / (kpis?.render_nodes_total || 128)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Discipline Breakdown & Active Productions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Department Pipeline Progress Matrix (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Discipline Pipeline Pass Matrix
                </h3>
                <p className="text-[11px] text-slate-400">Real-time completion across VFX departments</p>
              </div>
              <span className="text-[10px] font-mono text-indigo-400 px-2 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20">
                Live OpenUSD Sync
              </span>
            </div>

            <div className="space-y-3">
              {departments?.map((dept) => {
                const pct = Math.round((dept.completed_tasks / dept.total_tasks) * 100);
                return (
                  <div key={dept.department} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{dept.department}</span>
                      <div className="flex items-center space-x-2 text-slate-400 font-mono text-[11px]">
                        <span>
                          {dept.completed_tasks} / {dept.total_tasks}
                        </span>
                        <span className="font-bold text-white">{pct}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/80">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Shows Table */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Active Productions
                </h3>
                <p className="text-[11px] text-slate-400">Features, episodic cuts, and lookdev shows</p>
              </div>
              <Link to="/projects" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono">
                All Shows <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-800/60 font-sans">
              {projects.map((proj) => (
                <div key={proj.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-indigo-400 font-bold text-xs border border-slate-800 font-mono">
                      {proj.code}
                    </div>
                    <div>
                      <Link to={`/projects/${proj.id}`} className="text-xs font-semibold text-white hover:text-indigo-300 transition-colors">
                        {proj.name}
                      </Link>
                      <p className="text-[10px] text-slate-400">{proj.client_name} • Target: {proj.delivery_date}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right hidden sm:block font-mono">
                      <span className="text-xs text-slate-200 font-semibold">{proj.approved_shots}/{proj.total_shots} Shots</span>
                      <p className="text-[9px] text-slate-500">Passed</p>
                    </div>
                    <StatusBadge status={proj.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Dailies Screening Feed & Latest Shot Matrix (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Screening Room Queue */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <PlaySquare className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Pending Dailies Cuts
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {recentReviews.length} Cuts In Queue
              </span>
            </div>

            <div className="space-y-2">
              {recentReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white">{rev.entity_code}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 bg-slate-800 text-indigo-300 rounded border border-slate-700">
                      {rev.version_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-1">{rev.title}</p>
                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-800/60">
                    <span>Supervisor: {rev.lead_reviewer_name}</span>
                    <Link to="/reviews" className="text-indigo-400 hover:text-indigo-300 font-semibold font-mono">
                      Screening Room →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Shot Stream */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Recent Sequence Updates
              </h3>
              <Link to="/shots" className="text-xs text-indigo-400 hover:text-indigo-300 font-mono">
                All Shots →
              </Link>
            </div>

            <div className="divide-y divide-slate-800/60">
              {recentShots.map((shot) => (
                <div
                  key={shot.id}
                  onClick={() => openInspector('shot', shot)}
                  className="py-2 text-xs flex items-center justify-between cursor-pointer hover:bg-slate-800/40 rounded px-1.5 transition-colors group"
                >
                  <div>
                    <span className="font-semibold text-white group-hover:text-indigo-400 font-mono transition-colors">
                      {shot.code}
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {shot.sequence_code} • {shot.assigned_artist_name || 'Unassigned'}
                    </p>
                  </div>
                  <StatusBadge status={shot.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
