import React from 'react';
import { AIProjectSummary, AIShotSummary } from '@/types/intelligence';
import {
  Activity,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Film,
} from 'lucide-react';

interface AIProjectSummarizerProps {
  summary: AIProjectSummary | null;
  shotSummary?: AIShotSummary | null;
  onSelectProject?: (code: string) => void;
}

export const AIProjectSummarizer: React.FC<AIProjectSummarizerProps> = ({
  summary,
  shotSummary,
  onSelectProject,
}) => {
  if (!summary) return null;

  return (
    <div className="space-y-4 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs">
      {/* Header & Health Score */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              [{summary.project_code}]
            </span>
            <h3 className="text-base font-bold text-slate-100">{summary.project_name} Executive Brief</h3>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">{summary.headline}</p>
        </div>

        {/* Project Health Gauge */}
        <div className="flex items-center gap-3 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Health Index</div>
            <div className="text-lg font-mono font-bold text-emerald-400">
              {summary.health_score}/100
            </div>
          </div>
          <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
          <div className="text-slate-400 text-[10px] uppercase">Approved Cuts</div>
          <div className="text-base font-mono font-bold text-slate-100">
            {summary.key_metrics.shots_completed} / {summary.key_metrics.shots_total}
          </div>
          <div className="text-[10px] text-teal-400">
            {summary.key_metrics.completion_percentage}% completed
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
          <div className="text-slate-400 text-[10px] uppercase">Countdown</div>
          <div className="text-base font-mono font-bold text-slate-100">
            {summary.key_metrics.days_to_final_delivery} Days
          </div>
          <div className="text-[10px] text-slate-400">Until master delivery</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
          <div className="text-slate-400 text-[10px] uppercase">Budget Burn</div>
          <div className="text-base font-mono font-bold text-emerald-400">
            {summary.key_metrics.budget_burn_rate_pct}%
          </div>
          <div className="text-[10px] text-slate-400">Paced 4.2% below cap</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
          <div className="text-slate-400 text-[10px] uppercase">Open Sup Notes</div>
          <div className="text-base font-mono font-bold text-amber-400">
            {summary.key_metrics.open_critical_notes}
          </div>
          <div className="text-[10px] text-slate-400">Action items pending</div>
        </div>
      </div>

      {/* Department Velocity Breakdown */}
      <div className="space-y-2 pt-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Department Velocity & Pipeline Stages
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {summary.department_breakdown.map((dept) => (
            <div
              key={dept.department}
              className={`p-2.5 rounded-lg border space-y-1.5 ${
                dept.bottleneck_detected
                  ? 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                  : 'bg-slate-950/50 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium truncate">{dept.department}</span>
                <span className="font-mono font-semibold">{dept.progress_pct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    dept.bottleneck_detected ? 'bg-rose-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${dept.progress_pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Executive Narrative */}
      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Synthesis & Recommendation</span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">{summary.executive_brief}</p>
      </div>
    </div>
  );
};
