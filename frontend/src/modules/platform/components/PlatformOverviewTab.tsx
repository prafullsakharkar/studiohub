import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Database,
  Terminal,
  Layers,
  CheckSquare,
  Box,
  Clapperboard,
  Eye,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Plus,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { PlatformOverviewStats } from '@/types/masterData';
import { usePermissionEvaluator } from '@/core/permissions/usePermissionEvaluator';

interface PlatformOverviewTabProps {
  stats: PlatformOverviewStats | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  onNavigateTab: (tabId: string) => void;
  onOpenCreateSoftware: () => void;
  onOpenCreateStatus: () => void;
  onOpenCreateTaskType: () => void;
}

export const PlatformOverviewTab: React.FC<PlatformOverviewTabProps> = ({
  stats,
  isLoading,
  onRefresh,
  onNavigateTab,
  onOpenCreateSoftware,
  onOpenCreateStatus,
  onOpenCreateTaskType,
}) => {
  const { can } = usePermissionEvaluator();

  const canCreateSoftware = can('platform.software.create') || can('platform.master_data.create') || can('platform.admin.view');
  const canCreateStatus = can('platform.status.create') || can('platform.master_data.create') || can('platform.admin.view');
  const canCreateTaskType = can('platform.task_type.create') || can('platform.master_data.create') || can('platform.admin.view');

  const metricCards = [
    {
      id: 'software',
      label: 'Software & DCC Suites',
      count: stats?.global_software_count ?? 0,
      subtext: `${stats?.global_version_count ?? 0} active versions`,
      icon: Terminal,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
      tab: 'software',
    },
    {
      id: 'statuses',
      label: 'Lifecycle Statuses',
      count: stats?.global_status_count ?? 0,
      subtext: 'Shot, Task, Asset & Review workflows',
      icon: CheckSquare,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      tab: 'statuses',
    },
    {
      id: 'task-types',
      label: 'Task Crafts & Types',
      count: stats?.global_task_type_count ?? 0,
      subtext: 'Department-aligned workflows',
      icon: Layers,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      tab: 'task-types',
    },
    {
      id: 'asset-types',
      label: 'Asset Taxonomies',
      count: stats?.global_asset_type_count ?? 0,
      subtext: '3D, 2D, Prop & Character kinds',
      icon: Box,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      tab: 'asset-types',
    },
    {
      id: 'shot-types',
      label: 'Shot Classifications',
      count: stats?.global_shot_type_count ?? 0,
      subtext: 'Live action, CG, Matte & Stereo',
      icon: Clapperboard,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/10',
      borderColor: 'border-pink-500/20',
      tab: 'shot-types',
    },
    {
      id: 'review-file-types',
      label: 'Review & File Formats',
      count: (stats?.global_review_type_count ?? 0) + (stats?.global_file_type_count ?? 0),
      subtext: `${stats?.global_review_type_count ?? 0} reviews, ${stats?.global_file_type_count ?? 0} formats`,
      icon: FileCode,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
      tab: 'review-types',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Telemetry Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">System Telemetry</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-lg font-bold text-white capitalize">{stats?.system_health || 'Healthy'}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Last updated: {stats?.last_definition_update ? new Date(stats.last_definition_update).toLocaleTimeString() : 'Real-time'}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Activity className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">Tenant Sync Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-white">{stats?.active_organizations_count || 1} Organizations</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {stats?.total_custom_records_across_orgs || 0} custom tenant overrides active
              </p>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Database className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardBody className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">RBAC Enforcement</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-amber-300">Default-Deny</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Strict granular platform authorization active
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.id}
              className="bg-slate-900 border-slate-800 hover:border-slate-700 transition cursor-pointer group"
              onClick={() => onNavigateTab(card.tab)}
            >
              <CardBody className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${card.bgColor} ${card.borderColor} border`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <button
                    type="button"
                    className="text-slate-500 group-hover:text-white transition flex items-center gap-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateTab(card.tab);
                    }}
                  >
                    Manage <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-white tracking-tight">{card.count}</span>
                  <h3 className="text-sm font-semibold text-slate-200 mt-1">{card.label}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{card.subtext}</p>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions & Governance Hub */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-white">Platform Master Data Actions</h2>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            AUTHORITATIVE RBAC
          </Badge>
        </CardHeader>
        <CardBody className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" /> Register DCC Software
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Add new digital content creation software with versions, executable path definitions, and environment variables.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                disabled={!canCreateSoftware}
                title={canCreateSoftware ? 'Register software' : 'Requires platform.software.create'}
                onClick={onOpenCreateSoftware}
              >
                Register Software
              </Button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" /> Create Platform Status
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Define global production status steps with workflow categories, visual colors, and final approval flags.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                disabled={!canCreateStatus}
                title={canCreateStatus ? 'Create status' : 'Requires platform.status.create'}
                onClick={onOpenCreateStatus}
              >
                Create Status
              </Button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" /> Create Task Type
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Define canonical task types with department routing, icon tokens, and pipeline stage bindings.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                disabled={!canCreateTaskType}
                title={canCreateTaskType ? 'Create task type' : 'Requires platform.task_type.create'}
                onClick={onOpenCreateTaskType}
              >
                Create Task Type
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
