import React from 'react';
import { KPIMetric } from '@/types/intelligence';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

interface MetricKpiCardProps {
  metric: KPIMetric;
}

export const MetricKpiCard: React.FC<MetricKpiCardProps> = ({ metric }) => {
  const getStatusBorder = () => {
    switch (metric.status) {
      case 'optimal':
        return 'border-emerald-500/30 bg-emerald-950/10';
      case 'warning':
        return 'border-amber-500/30 bg-amber-950/10';
      case 'critical':
        return 'border-rose-500/30 bg-rose-950/10';
      default:
        return 'border-slate-800 bg-slate-900/60';
    }
  };

  return (
    <div
      id={`kpi-${metric.id}`}
      className={`p-4 rounded-xl border ${getStatusBorder()} transition-all space-y-2 flex flex-col justify-between`}
    >
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wider text-[11px] truncate">
          {metric.label}
        </span>
        {metric.info_tooltip && (
          <div title={metric.info_tooltip} className="cursor-help text-slate-400 hover:text-slate-300">
            <Info className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold font-mono text-slate-100 tracking-tight">
          {metric.value}
          {metric.unit && <span className="text-sm font-normal text-slate-400 ml-1">{metric.unit}</span>}
        </div>

        {metric.delta_percentage !== undefined && (
          <div
            className={`flex items-center gap-0.5 text-xs font-semibold font-mono px-2 py-0.5 rounded-full ${
              metric.delta_percentage >= 0
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {metric.delta_percentage >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{Math.abs(metric.delta_percentage)}%</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/40">
        {metric.target && <span>Target: <strong className="text-slate-300">{metric.target}</strong></span>}
        {metric.trend_label && <span className="text-slate-400 font-medium">{metric.trend_label}</span>}
      </div>
    </div>
  );
};
