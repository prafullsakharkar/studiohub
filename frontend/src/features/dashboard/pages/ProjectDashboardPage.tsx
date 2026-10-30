import React from 'react';
import { useProductionStore } from '@/core/production/useProductionStore';
import { useProjectDashboard } from '../hooks/useProjectDashboard';
import {
  DashboardHeader,
  ProjectKpiHud,
  DashboardWidget,
  ProductionProgressWidget,
  ShotStatusMatrix,
  TaskHealthWidget,
  ReviewVersionHealth,
  ScheduleMilestonesWidget,
  TeamWorkloadWidget,
  ProjectActivityFeed,
  UpcomingOverdueWidget,
  ClientDeliveryHealth,
  DashboardSkeleton,
  DashboardEmptyState,
  DashboardErrorState,
} from '../components';

export const ProjectDashboardPage: React.FC = () => {
  const { activeProjectId } = useProductionStore();
  const { data, isLoading, isError, error, isFetching, refetch } = useProjectDashboard();

  // 1. Guard against unselected project
  if (!activeProjectId) {
    return <DashboardEmptyState />;
  }

  // 2. Loading state with VFX HUD Skeleton
  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  // 3. Error state with Retry option
  if (isError || !data) {
    return <DashboardErrorState error={error} onRetry={() => refetch()} />;
  }

  return (
    <div
      id="project-context-dashboard"
      className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 selection:bg-indigo-500/30 overflow-hidden"
    >
      {/* 1. Project Context Command Header */}
      <DashboardHeader
        project={data.project}
        isFetching={isFetching}
        onRefresh={() => refetch()}
      />

      {/* 2. Scrollable VFX Command Center Layout */}
      <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar">
        {/* KPI Telemetry HUD Cards */}
        <ProjectKpiHud summary={data.summary} projectId={data.project.id} />

        {/* Two Column Command Deck */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Stage (2 Columns on Large Screens) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recharts Interactive Project Health & Active Tasks Widget */}
            <DashboardWidget
              summary={data.summary}
              tasksData={data.tasks}
              production={data.production}
              shotsData={data.shots}
              projectId={data.project.id}
            />

            {/* Overall Production Velocity & Linear Gauge */}
            <ProductionProgressWidget
              production={data.production}
              totalShots={data.summary.total_shots}
            />

            {/* Shot Pipeline Breakdown Matrix */}
            <ShotStatusMatrix shotsData={data.shots} projectId={data.project.id} />

            {/* Task Health & Work Velocity */}
            <TaskHealthWidget tasksData={data.tasks} projectId={data.project.id} />

            {/* Schedule & Milestones Tracker */}
            <ScheduleMilestonesWidget schedule={data.schedule} projectId={data.project.id} />
          </div>

          {/* Side Telemetry Deck (1 Column on Large Screens) */}
          <div className="space-y-6">
            {/* Screening Room & Reviews */}
            <ReviewVersionHealth reviewsData={data.reviews} projectId={data.project.id} />

            {/* Action Items & Critical Watchlist */}
            <UpcomingOverdueWidget tasks={data.tasks} deliveries={data.deliveries} />

            {/* Client Deliveries & Turnover Packages */}
            <ClientDeliveryHealth deliveries={data.deliveries} projectId={data.project.id} />

            {/* Key Artist Roster & Workload */}
            <TeamWorkloadWidget workload={data.workload} />

            {/* Live Project Telemetry Stream */}
            <ProjectActivityFeed activities={data.activity} />
          </div>
        </div>
      </div>
    </div>
  );
};
