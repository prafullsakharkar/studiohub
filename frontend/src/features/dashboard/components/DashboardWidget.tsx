import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Layers,
  Clock,
  ShieldAlert,
  BarChart3,
  PieChart as PieChartIcon,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DashboardSummaryKpis,
  DashboardTasksData,
  DashboardProductionProgress,
  DashboardShotsData,
} from '../types';
import {
  getCategoryComparison,
  getHealthMetrics,
  getTaskStatusDistribution,
} from '../utils/dashboardMetrics';

export interface DashboardWidgetProps {
  summary?: DashboardSummaryKpis;
  tasksData?: DashboardTasksData;
  production?: DashboardProductionProgress;
  shotsData?: DashboardShotsData;
  projectId?: string;
  title?: string;
  className?: string;
}

type WidgetTab = 'health' | 'tasks' | 'velocity';

const STATUS_COLORS: Record<string, string> = {
  Completed: '#10b981', // emerald-500
  'In Progress': '#38bdf8', // sky-400
  Open: '#94a3b8', // slate-400
  Review: '#818cf8', // indigo-400
  Blocked: '#f43f5e', // rose-500
  Overdue: '#f59e0b', // amber-500
  Approved: '#059669', // emerald-600
  'In Cut': '#6366f1', // indigo-500
};

const PIE_COLORS = ['#38bdf8', '#818cf8', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'];

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  summary,
  tasksData,
  production,
  shotsData,
  projectId,
  title = 'Project Health & Production Analytics',
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<WidgetTab>('health');

  // Project health, task partition, and domain comparison are derived
  // centrally (see ../utils/dashboardMetrics) from the project-scoped
  // payload only — no sample literals, no fabricated history.
  const healthMetrics = useMemo(
    () => getHealthMetrics(summary, tasksData),
    [summary, tasksData],
  );

  // Task distribution pie: exact partition of this project's tasks.
  const taskStatusData = useMemo(
    () => getTaskStatusDistribution(tasksData ?? undefined, summary),
    [tasksData, summary],
  );

  // Health Metrics Comparison Dataset (Shots vs Tasks vs Assets vs Reviews).
  const categoryComparisonData = useMemo(
    () => getCategoryComparison(summary, tasksData),
    [summary, tasksData],
  );

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700/80 px-3 py-2 rounded-lg shadow-xl text-xs font-mono">
          <p className="font-semibold text-slate-200 mb-1">{label || payload[0].name}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-bold text-white">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="dashboard-widget-recharts"
      className={`p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg ${className}`}
    >
      {/* Widget Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">{title}</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Live Telemetry
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Interactive Recharts telemetry for active pipeline workloads
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('health')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'health'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Health Metrics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'tasks'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Active Tasks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('velocity')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'velocity'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Velocity Trend
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Health Index</div>
            <div className="text-lg font-bold text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
              {healthMetrics.healthScore}%
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Active Tasks</div>
            <div className="text-lg font-bold text-sky-400 font-mono mt-0.5">
              {healthMetrics.activeTasks}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Blocked Risks</div>
            <div className={`text-lg font-bold font-mono mt-0.5 ${healthMetrics.blockedCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {healthMetrics.blockedCount}
            </div>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            healthMetrics.blockedCount > 0 ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'bg-slate-900 border border-slate-800 text-slate-500'
          }`}>
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Overdue Items</div>
            <div className={`text-lg font-bold font-mono mt-0.5 ${healthMetrics.overdueCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {healthMetrics.overdueCount}
            </div>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            healthMetrics.overdueCount > 0 ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-slate-900 border border-slate-800 text-slate-500'
          }`}>
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Recharts Visual Display Area */}
      <div className="pt-2">
        {activeTab === 'health' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Pipeline Domain Breakdown (Active vs Completed vs At Risk)</span>
              {projectId && (
                <Link
                  to={`/tasks?project=${projectId}`}
                  className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-mono transition-colors"
                >
                  Inspect Tasks <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryComparisonData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis dataKey="category" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    formatter={(value) => <span className="text-slate-300 font-mono text-xs">{value}</span>}
                  />
                  <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="Active" fill="#38bdf8" radius={[0, 0, 0, 0]} stackId="a" />
                  <Bar dataKey="Risk" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Pie / Donut Chart */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-medium">Task Distribution by Status</div>
              <div className="h-60 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="count"
                    >
                      {taskStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill || PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Task Status List Breakdown */}
            <div className="space-y-2.5">
              <div className="text-xs text-slate-400 font-medium">Status Breakdown</div>
              <div className="space-y-2">
                {taskStatusData.map((status) => {
                  const total = tasksData?.total || summary?.total_tasks || 1;
                  const pct = Math.round((status.count / (total || 1)) * 100);
                  return (
                    <div
                      key={status.name}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: status.fill }}
                        />
                        <span className="text-xs text-slate-200 font-medium">{status.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: status.fill }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-white w-8 text-right">
                          {status.count}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 w-8 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'velocity' && (
          <div className="p-6 rounded-lg bg-slate-950/60 border border-slate-800 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-slate-300">
              <Layers className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold">Velocity history is unavailable</span>
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Cumulative burn-up requires completed-task timestamps, which the
              API does not collect yet. Only recorded project data is shown —
              no projected trend is fabricated.
            </p>
          </div>
        )}
      </div>

      {/* Footer / Context status note */}
      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Calculated across active sequence tasks &amp; delivery milestones</span>
        </div>
        {projectId && (
          <Link
            to={`/tasks?project=${projectId}`}
            className="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Manage Production Board &rarr;
          </Link>
        )}
      </div>
    </div>
  );
};
