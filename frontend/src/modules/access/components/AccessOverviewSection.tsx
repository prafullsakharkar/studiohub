import { useRoles, useGroups, useAccessActivity } from '@/modules/access/hooks/useAccessData';
import { usePeople } from '@/modules/people';
import { useProjects } from '@/modules/production';
import type React from 'react';
import { useMemo } from 'react';
import {
  Shield,
  Users,
  Users2,
  Lock,
  Film,
  Activity,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  Sliders,
  Terminal,
  Key,
  Building2,
} from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { useAccessManagementStore } from '@/core/access/useAccessManagementStore';
import { DOMAIN_PERMISSIONS_CATALOG, ACCESS_ROLE_TEMPLATES } from '@/core/access/domainPermissions';
import type { AccessWorkspaceTab } from '@/types/identity';
import type { Role } from '@/types/identity';

interface AccessOverviewSectionProps {
  onNavigateTab: (tab: AccessWorkspaceTab) => void;
  onOpenRoleEditor: () => void;
}

export const AccessOverviewSection: React.FC<AccessOverviewSectionProps> = ({
  onNavigateTab,
  onOpenRoleEditor,
}) => {
  const { data: peopleData } = usePeople();
  const { data: rolesData } = useRoles();
  const { data: groupsData } = useGroups();
  const { data: projectsData } = useProjects();
  const { data: activityData } = useAccessActivity();

  const projectsList = useMemo(() => projectsData?.results || [], [projectsData]);

  const {
    getAllRoles,
    groups: storeGroups,
    accessAuditLogs,
    createRoleFromTemplate,
    selectedProjectId,
  } = useAccessManagementStore();

  const currentActiveProjectId = selectedProjectId || (projectsList[0]?.id ?? '');
  const activeProject = projectsList.find((p) => p.id === currentActiveProjectId) || projectsList[0] || null;

  const allRoles: Role[] = useMemo(() => {
    if (rolesData && Array.isArray(rolesData) && rolesData.length > 0) {
      return rolesData as unknown as Role[];
    }
    return getAllRoles();
  }, [rolesData, getAllRoles]);

  const activeRoles = allRoles.filter((r: Role) => !(r as any).is_archived);
  const customRoles = allRoles.filter((r: Role) => r.type === 'custom');

  const usersCount = peopleData?.items?.length ?? 0;
  const groupsCount = groupsData && Array.isArray(groupsData)
    ? groupsData.length
    : storeGroups.length;
  const projectsCount = projectsList.length;

  const filteredLogs = useMemo(() => {
    const storeLogs = accessAuditLogs;

    const apiLogs = (activityData?.results || []).map((e: any) => ({
      id: e.id || `act-${Date.now()}-${Math.random()}`,
      timestamp: e.timestamp || e.created_at || new Date().toISOString(),
      actorName: e.actor_name || e.actor?.name || 'Administrator',
      actorEmail: e.actor_email || e.actor?.email || 'admin@studiohub.vfx',
      action: e.action || e.description || 'access.event',
      targetType: e.target_type || e.type || 'Permission',
      targetName: e.target_name || e.target || 'Entity',
      organizationId: e.organization_id || '',
    }));

    const existingIds = new Set(storeLogs.map((s) => s.id));
    const uniqueApiLogs = apiLogs.filter((a) => !existingIds.has(a.id));

    return [...storeLogs, ...uniqueApiLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [accessAuditLogs, activityData]);

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div
          onClick={() => onNavigateTab('roles')}
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/60 hover:bg-slate-900 transition-all cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">Total Roles</span>
            <Shield className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{activeRoles.length}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">{customRoles.length} custom tailored</div>
        </div>

        <div
          onClick={() => onNavigateTab('users')}
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/60 hover:bg-slate-900 transition-all cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">Studio Users</span>
            <Users className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{usersCount}</div>
          <div className="text-[11px] text-teal-400 mt-1 font-mono truncate">Studio Crew</div>
        </div>

        <div
          onClick={() => onNavigateTab('groups')}
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-900 transition-all cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">Access Groups</span>
            <Users2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{groupsCount}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">Department & Squads</div>
        </div>

        <div
          onClick={() => onNavigateTab('permissions')}
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/60 hover:bg-slate-900 transition-all cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">Permissions</span>
            <Lock className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {DOMAIN_PERMISSIONS_CATALOG.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">17 Granular Domains</div>
        </div>

        <div
          onClick={() => onNavigateTab('projects')}
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-sky-500/60 hover:bg-slate-900 transition-all cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">Projects</span>
            <Film className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{projectsCount}</div>
          <div className="text-[11px] text-sky-400 mt-1 font-mono truncate">
            {activeProject ? `${activeProject.code || activeProject.name}` : 'Scoped shows'}
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('audit')}
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900 transition-all cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono">Audit Trail</span>
            <Activity className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{filteredLogs.length}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">Logged mutations</div>
        </div>
      </div>

      {/* Main Grid: Fast Actions & Role Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Quick Role Templates */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Canonical Role Templates
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Deploy standard StudioHub role baselines that generate fully editable, customizable access roles for the studio.
                </p>
              </div>
              <Button size="xs" variant="primary" onClick={onOpenRoleEditor}>
                Create Custom Role
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACCESS_ROLE_TEMPLATES.slice(0, 6).map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{tmpl.name}</span>
                      <Badge variant="neutral" className="text-[9px] font-mono">
                        {tmpl.suggestedScope}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {tmpl.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-indigo-400">
                      {tmpl.defaultPermissions.length} permissions
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        createRoleFromTemplate(tmpl.id);
                        onNavigateTab('roles');
                      }}
                      className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <span>Deploy Template</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => onNavigateTab('roles')}
                className="text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1"
              >
                <span>View all templates and custom roles</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Simulator Callout */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/50 via-slate-900 to-slate-900 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Administrator Permission Simulator</h4>
              </div>
              <p className="text-xs text-slate-300 max-w-xl">
                Test and debug authorization decisions before applying changes to production shows.
                Evaluates user identity, project scopes, and effective permissions.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onNavigateTab('simulator')}
              leftIcon={<Sliders className="w-3.5 h-3.5" />}
              className="shrink-0"
            >
              Launch Simulator
            </Button>
          </div>
        </div>

        {/* Right Column: Recent Access Audit Events */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Recent Access Activity
            </h3>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300"
            >
              View Full Log
            </button>
          </div>

          <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredLogs.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500">
                No recent access activity.
              </div>
            ) : (
              filteredLogs.slice(0, 7).map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="neutral" className="text-[9px] font-mono">
                      {log.action}
                    </Badge>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-xs text-slate-200 font-medium truncate">
                    {log.targetType}: <span className="text-white">{log.targetName}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    by {log.actorName} ({log.actorEmail})
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

