import React from 'react';
import { AnalyticsDashboard } from '@/types/intelligence';
import { MetricKpiCard } from './MetricKpiCard';
import { WidgetCard } from './WidgetCard';

interface DomainDashboardViewProps {
  dashboard: AnalyticsDashboard | null;
}

export const DomainDashboardView: React.FC<DomainDashboardViewProps> = ({ dashboard }) => {
  if (!dashboard) {
    return (
      <div className="py-20 text-center text-xs text-slate-400">
        Loading domain analytics metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Subtitle */}
      <div>
        <h2 className="text-lg font-bold text-slate-100">{dashboard.title}</h2>
        <p className="text-xs text-slate-400">{dashboard.subtitle}</p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboard.kpis.map((kpi) => (
          <MetricKpiCard key={kpi.id} metric={kpi} />
        ))}
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {dashboard.widgets.map((widget) => (
          <WidgetCard key={widget.id} widget={widget} />
        ))}
      </div>
    </div>
  );
};
