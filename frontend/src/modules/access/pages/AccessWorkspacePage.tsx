import { useAuth } from '@/modules/auth';
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shield,
  Users,
  Users2,
  Lock,
  Film,
  Activity,
  Sliders,
  Plus,
} from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { PageLayout } from '@/shared/layouts/PageLayout';
import { TabContentTransition } from '@/shared/components/tabs/TabContentTransition';
import { cn } from '@/shared/utils/cn';
import { useAccessManagementStore } from '@/core/access/useAccessManagementStore';
import type { AccessWorkspaceTab } from '@/types/identity';
import { AccessOverviewSection } from '../components/AccessOverviewSection';
import { RolesWorkspaceSection } from '../components/RolesWorkspaceSection';
import { UserAccessSection } from '../components/UserAccessSection';
import { GroupsManagementSection } from '../components/GroupsManagementSection';
import { PermissionsCatalogSection } from '../components/PermissionsCatalogSection';
import { ProjectAccessSection } from '../components/ProjectAccessSection';
import { PermissionSimulatorSection } from '../components/PermissionSimulatorSection';
import { AccessAuditSection } from '../components/AccessAuditSection';
import { RoleEditorModal } from '../components/RoleEditorModal';

const ACCESS_TABS: { id: AccessWorkspaceTab; label: string; icon: React.FC<{ className?: string }>; permission?: string }[] = [
  { id: 'overview', label: 'Overview', icon: Shield, permission: 'security.view' },
  { id: 'users', label: 'Users', icon: Users, permission: 'people.view' },
  { id: 'roles', label: 'Roles', icon: Shield, permission: 'roles.view' },
  { id: 'groups', label: 'Groups', icon: Users2, permission: 'group.view' },
  { id: 'permissions', label: 'Permissions', icon: Lock, permission: 'security.view' },
  { id: 'projects', label: 'Projects', icon: Film, permission: 'project.view' },
  { id: 'simulator', label: 'Simulator', icon: Sliders, permission: 'permissions.manage' },
  { id: 'audit', label: 'Audit', icon: Activity, permission: 'audit.view' },
];

const VALID_SECTIONS = ['overview', 'users', 'roles', 'groups', 'permissions', 'projects', 'simulator', 'audit'];

/**
 * Org-free RBAC workspace. `/access[/:section]` is the single canonical entry
 * for role/group/permission management (Task 12 sections rendered verbatim;
 * the org-scoped page that previously hosted them is gone).
 */
export const AccessWorkspacePage: React.FC = () => {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();

  const { activeTab, setActiveTab } = useAccessManagementStore();
  const [isRoleEditorOpen, setIsRoleEditorOpen] = useState(false);
  const { can } = useAuth();

  const visibleAccessTabs = useMemo(
    () => ACCESS_TABS.filter((tab) => !tab.permission || can(tab.permission)),
    [can]
  );
  const canCreateRole = can('roles.create');
  const isActiveAccessTabAllowed = useMemo(() => {
    const tabDef = ACCESS_TABS.find((t) => t.id === activeTab);
    if (!tabDef) return true;
    return !tabDef.permission || can(tabDef.permission);
  }, [activeTab, can]);

  // Sync tab with the URL section when provided; a bare /access renders the
  // persisted tab.
  useEffect(() => {
    if (section && VALID_SECTIONS.includes(section)) {
      setActiveTab(section as AccessWorkspaceTab);
    }
  }, [section, setActiveTab]);

  const handleTabChange = (tabId: AccessWorkspaceTab) => {
    setActiveTab(tabId);
    navigate(`/access/${tabId}`);
  };

  return (
    <PageLayout id="access-workspace-root">
      {/* Studio Header Bar */}
      <PageLayout.Header>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Access & RBAC Workspace
                </h1>
                <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
                  RBAC Engine v2
                </Badge>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Policy Engine Active
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="text-indigo-400">Security & Governance Matrix</span>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <PageLayout.Actions>
            {canCreateRole && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setIsRoleEditorOpen(true)}
              >
                Create Role
              </Button>
            )}
          </PageLayout.Actions>
        </div>

        {/* Tab Navigation strip */}
        <PageLayout.Tabs>
          {visibleAccessTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </PageLayout.Tabs>
      </PageLayout.Header>

      {/* Main Workspace Body */}
      <PageLayout.Body>
        {!isActiveAccessTabAllowed ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-2">
            <p className="text-sm font-bold text-amber-300 font-mono">Access Denied</p>
            <p className="text-xs text-slate-500 font-mono">Your role does not grant access to the "{activeTab}" section.</p>
          </div>
        ) : (
        <TabContentTransition tabKey={activeTab}>
          {activeTab === 'overview' && (
            <AccessOverviewSection
              onNavigateTab={handleTabChange}
              onOpenRoleEditor={() => setIsRoleEditorOpen(true)}
            />
          )}

          {activeTab === 'users' && <UserAccessSection />}

          {activeTab === 'roles' && <RolesWorkspaceSection />}

          {activeTab === 'groups' && <GroupsManagementSection />}

          {activeTab === 'permissions' && <PermissionsCatalogSection />}

          {activeTab === 'projects' && <ProjectAccessSection />}

          {activeTab === 'simulator' && <PermissionSimulatorSection />}

          {activeTab === 'audit' && <AccessAuditSection />}
        </TabContentTransition>
        )}
      </PageLayout.Body>

      {/* Create Role Global Modal */}
      <RoleEditorModal
        isOpen={isRoleEditorOpen}
        onClose={() => setIsRoleEditorOpen(false)}
      />
    </PageLayout>
  );
};
