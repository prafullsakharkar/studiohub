import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Layers,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  CheckSquare,
  Box,
  Clapperboard,
  Eye,
  FileCode,
  Building2,
  Database,
  ArrowRight,
  Terminal,
  Activity,
  History,
  Shield,
  Users,
  Briefcase,
  PlaySquare,
  Sparkles,
  Layout,
} from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import { useAuth } from '@/modules/auth';
import { ScrollableTabs } from '@/shared/components/tabs/ScrollableTabs';
import { TabContentTransition } from '@/shared/components/tabs/TabContentTransition';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePlatformStats,
  useCreatePlatformSoftware,
  useCreatePlatformStatus,
  useCreatePlatformTaskType,
  useSeedPlatformOrgStructure,
} from '@/core/masterData/useMasterData';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { usePermissionEvaluator } from '@/core/permissions/usePermissionEvaluator';

import { PlatformOverviewTab } from '../components/PlatformOverviewTab';
import { PlatformSoftwareTab } from '../components/PlatformSoftwareTab';
import { PlatformStatusesTab } from '../components/PlatformStatusesTab';
import { PlatformTaskTypesTab } from '../components/PlatformTaskTypesTab';
import { PlatformTaxonomiesTab } from '../components/PlatformTaxonomiesTab';
import { PlatformFormatsTab } from '../components/PlatformFormatsTab';
import { PlatformRolesTab } from '../components/PlatformRolesTab';

export const VALID_ADMIN_TABS = [
  'overview',
  'software',
  'statuses',
  'task-types',
  'asset-shot-types',
  'asset-types',
  'shot-types',
  'review-file-types',
  'review-types',
  'file-types',
  'roles',
  'groups',
  'departments',
  'positions',
];

export const resolveAdminTab = (slug: string | undefined): string =>
  slug && VALID_ADMIN_TABS.includes(slug) ? slug : 'overview';

// Every tab here is platform master data. System settings (pipeline defaults, themes, locales, flags) live under
// /settings/system/*; a viewer without platform rights sees no tab and is sent there.
export function filterAdminTabsForViewer(tabIds: string[], canViewPlatform: boolean): string[] {
  return canViewPlatform ? tabIds : [];
}

export const PlatformAdminPage: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { can } = usePermissionEvaluator();
  const { user } = useAuth();
  const { addNotification } = useNotificationStore();

  const canViewPlatformTabs = can('platform.admin.view') || can('platform.master_data.view') || can('platform.software.view') || can('platform.status.view');

  // Active tab state synced with URL parameter if available; redirect to canonical navigation route if api-health is requested
  const [activeTab, setActiveTab] = useState<string>(resolveAdminTab(tab));

  useEffect(() => {
    if (tab === 'api-health') {
      navigate('/platform/health', { replace: true });
      return;
    }
    const resolved = resolveAdminTab(tab);
    if (!filterAdminTabsForViewer([resolved], canViewPlatformTabs).includes(resolved)) {
      navigate('/settings/system/values', { replace: true });
    } else {
      setActiveTab(resolved);
    }
  }, [tab, navigate, canViewPlatformTabs]);

  const handleTabChange = (newTabId: string) => {
    setActiveTab(newTabId);
    navigate(`/platform/admin/${newTabId}`);
  };

  // Queries: overview only — each tab fetches its own list (no over-fetch on mount)
  const queryClient = useQueryClient();
  const { data: overview, isLoading: isOverviewLoading, refetch: refetchOverview } = usePlatformStats();

  // Global Creation Modals
  const [isCreateSoftwareModalOpen, setIsCreateSoftwareModalOpen] = useState(false);
  const [isCreateStatusModalOpen, setIsCreateStatusModalOpen] = useState(false);
  const [isCreateTaskTypeModalOpen, setIsCreateTaskTypeModalOpen] = useState(false);

  // Form states
  const [newSoftwareData, setNewSoftwareData] = useState({
    name: '',
    code: '',
    publisher: '',
    category: '3D DCC',
    description: '',
    website: '',
    initialVersion: '1.0.0',
  });

  const [newStatusData, setNewStatusData] = useState({
    name: '',
    code: '',
    entity_type: 'task' as 'shot' | 'task' | 'asset' | 'version' | 'review',
    category: 'in_progress' as const,
    color: '#06b6d4',
    order: 10,
    is_default: false,
    is_final: false,
    description: '',
  });

  const [newTaskTypeData, setNewTaskTypeData] = useState({
    name: '',
    code: '',
    category: 'shot' as 'shot' | 'asset' | 'general',
    department_code: 'comp',
    department_name: 'Compositing',
    color: '#a855f7',
    icon: 'Layers',
    description: '',
  });

  const createSoftwareMutation = useCreatePlatformSoftware();
  const createStatusMutation = useCreatePlatformStatus();
  const createTaskTypeMutation = useCreatePlatformTaskType();
  const seedBackendMutation = useSeedPlatformOrgStructure();

  const canSeedBackend = can('platform.admin.manage') || can('platform.master_data.create');

  const handleSeedBackend = async () => {
    try {
      const result = await seedBackendMutation.mutateAsync();
      const created =
        result.roles.created + result.groups.created + result.departments.created + result.positions.created;
      const skipped =
        result.roles.skipped + result.groups.skipped + result.departments.skipped + result.positions.skipped;
      addNotification({
        type: 'success',
        title: 'Backend Seeded',
        message: `Created ${created} records, skipped ${skipped} existing (roles, groups, departments, positions).`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Backend Seed Failed',
        message: err.message || 'Could not seed backend records.',
      });
    }
  };

  const handleCreateSoftware = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSoftwareMutation.mutateAsync({
        name: newSoftwareData.name,
        code: newSoftwareData.code,
        publisher: newSoftwareData.publisher,
        category: newSoftwareData.category,
        description: newSoftwareData.description,
        website: newSoftwareData.website || undefined,
        metadata: {
          initial_version: newSoftwareData.initialVersion,
        },
      });
      setIsCreateSoftwareModalOpen(false);
      setNewSoftwareData({
        name: '',
        code: '',
        publisher: '',
        category: '3D DCC',
        description: '',
        website: '',
        initialVersion: '1.0.0',
      });
      addNotification({
        type: 'success',
        title: 'Global Software Registered',
        message: `Added canonical platform definition for ${newSoftwareData.name}.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Registration Failed',
        message: err.message || 'Could not register software.',
      });
    }
  };

  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createStatusMutation.mutateAsync(newStatusData);
      setIsCreateStatusModalOpen(false);
      setNewStatusData({
        name: '',
        code: '',
        entity_type: 'task',
        category: 'in_progress',
        color: '#06b6d4',
        order: 10,
        is_default: false,
        is_final: false,
        description: '',
      });
      addNotification({
        type: 'success',
        title: 'Status Created',
        message: 'Registered new canonical platform status.',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Status Creation Failed',
        message: err.message || 'Could not create status.',
      });
    }
  };

  const handleCreateTaskType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTaskTypeMutation.mutateAsync(newTaskTypeData);
      setIsCreateTaskTypeModalOpen(false);
      setNewTaskTypeData({
        name: '',
        code: '',
        category: 'shot',
        department_code: 'comp',
        department_name: 'Compositing',
        color: '#a855f7',
        icon: 'Layers',
        description: '',
      });
      addNotification({
        type: 'success',
        title: 'Task Type Created',
        message: 'Registered new canonical platform task type.',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Task Type Creation Failed',
        message: err.message || 'Could not create task type.',
      });
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'software', label: 'Software / DCC', icon: Terminal },
    { id: 'statuses', label: 'Statuses', icon: CheckSquare },
    { id: 'task-types', label: 'Task Types', icon: Layers },
    { id: 'asset-shot-types', label: 'Asset & Shot Taxonomies', icon: Box },
    { id: 'review-file-types', label: 'Review & File Formats', icon: FileCode },
    { id: 'roles', label: 'Roles & Org Structure', icon: Shield },
  ];

  const visibleTabs = tabs.filter((t) => filterAdminTabsForViewer([t.id], canViewPlatformTabs).includes(t.id));
  // Coerce display tab so a settings-scoped viewer never renders platform tab content,
  // even for one frame before the redirect effect above fires.
  const effectiveTab = filterAdminTabsForViewer([activeTab], canViewPlatformTabs).includes(activeTab)
    ? activeTab
    : 'overview';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 min-h-0 w-full">
      {/* Platform Administration Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                GLOBAL PLATFORM
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
                PLATFORM ADMINISTRATION & MASTER DATA
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              Master Data & Environment Architecture
            </h1>
            <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
              Authoritative platform master registry. Governs DCC software suites, lifecycle statuses,
              department workflows, taxonomies, and multi-tenant security cascades under strict RBAC.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => {
                refetchOverview();
                queryClient.invalidateQueries({ queryKey: ['platform'] });
                addNotification({
                  type: 'info',
                  title: 'Catalog Refreshed',
                  message: 'Synchronized latest platform definitions.',
                });
              }}
            >
              Sync Cache
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Database className="w-3.5 h-3.5" />}
              disabled={!canSeedBackend}
              isLoading={seedBackendMutation.isPending}
              title={canSeedBackend ? 'Push mock roles, groups, departments and positions to the backend' : 'Requires platform.admin.manage'}
              onClick={handleSeedBackend}
            >
              Seed Backend
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SYSTEM ACTIVE
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <ScrollableTabs
        tabs={visibleTabs}
        activeTab={
          effectiveTab === 'asset-types' || effectiveTab === 'shot-types'
            ? 'asset-shot-types'
            : effectiveTab === 'review-types' || effectiveTab === 'file-types'
            ? 'review-file-types'
            : effectiveTab === 'groups' || effectiveTab === 'departments' || effectiveTab === 'positions'
            ? 'roles'
            : effectiveTab
        }
        onTabChange={handleTabChange}
      />

      {/* Tab Panels */}
      <TabContentTransition tabKey={effectiveTab}>
        {effectiveTab === 'overview' && (
          <PlatformOverviewTab
            stats={overview}
            isLoading={isOverviewLoading}
            onRefresh={() => {
              refetchOverview();
              queryClient.invalidateQueries({ queryKey: ['platform'] });
            }}
            onNavigateTab={handleTabChange}
            onOpenCreateSoftware={() => setIsCreateSoftwareModalOpen(true)}
            onOpenCreateStatus={() => setIsCreateStatusModalOpen(true)}
            onOpenCreateTaskType={() => setIsCreateTaskTypeModalOpen(true)}
          />
        )}

        {effectiveTab === 'software' && (
          <PlatformSoftwareTab
            onOpenCreate={() => setIsCreateSoftwareModalOpen(true)}
          />
        )}

        {effectiveTab === 'statuses' && (
          <PlatformStatusesTab
            onOpenCreate={() => setIsCreateStatusModalOpen(true)}
          />
        )}

        {effectiveTab === 'task-types' && (
          <PlatformTaskTypesTab
            onOpenCreate={() => setIsCreateTaskTypeModalOpen(true)}
          />
        )}

        {(effectiveTab === 'asset-shot-types' || effectiveTab === 'asset-types' || effectiveTab === 'shot-types') && (
          <PlatformTaxonomiesTab />
        )}

        {(effectiveTab === 'review-file-types' || effectiveTab === 'review-types' || effectiveTab === 'file-types') && (
          <PlatformFormatsTab />
        )}

        {(effectiveTab === 'roles' || effectiveTab === 'groups' || effectiveTab === 'departments' || effectiveTab === 'positions') && (
          <PlatformRolesTab
            initialSubTab={
              effectiveTab === 'groups'
                ? 'groups'
                : effectiveTab === 'departments'
                ? 'departments'
                : effectiveTab === 'positions'
                ? 'positions'
                : 'roles'
            }
          />
        )}

      </TabContentTransition>

      {/* CREATE SOFTWARE MODAL */}
      {isCreateSoftwareModalOpen && (
        <Modal
          isOpen={isCreateSoftwareModalOpen}
          onClose={() => setIsCreateSoftwareModalOpen(false)}
          title="Register Platform DCC Software"
          size="md"
        >
          <form onSubmit={handleCreateSoftware} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Software Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Autodesk Maya, SideFX Houdini"
                value={newSoftwareData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  const autoCode = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                  setNewSoftwareData({ ...newSoftwareData, name: val, code: newSoftwareData.code || autoCode });
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Code Slug Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="maya"
                  value={newSoftwareData.code}
                  onChange={(e) => setNewSoftwareData({ ...newSoftwareData, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Publisher</label>
                <input
                  type="text"
                  required
                  placeholder="Autodesk"
                  value={newSoftwareData.publisher}
                  onChange={(e) => setNewSoftwareData({ ...newSoftwareData, publisher: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Category</label>
                <select
                  value={newSoftwareData.category}
                  onChange={(e) => setNewSoftwareData({ ...newSoftwareData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="3D DCC">3D DCC</option>
                  <option value="2D Comp">2D Comp</option>
                  <option value="Tracking">Tracking / Matchmove</option>
                  <option value="Editorial">Editorial / Playback</option>
                  <option value="Renderer">Renderer</option>
                  <option value="Audio">Audio Suite</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Initial Version</label>
                <input
                  type="text"
                  required
                  placeholder="2026.1"
                  value={newSoftwareData.initialVersion}
                  onChange={(e) => setNewSoftwareData({ ...newSoftwareData, initialVersion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Website URL</label>
              <input
                type="url"
                placeholder="https://autodesk.com/maya"
                value={newSoftwareData.website}
                onChange={(e) => setNewSoftwareData({ ...newSoftwareData, website: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Standard production 3D modeling, rigging and animation tool."
                value={newSoftwareData.description}
                onChange={(e) => setNewSoftwareData({ ...newSoftwareData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateSoftwareModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={createSoftwareMutation.isPending}>
                Register Software
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE STATUS MODAL */}
      {isCreateStatusModalOpen && (
        <Modal
          isOpen={isCreateStatusModalOpen}
          onClose={() => setIsCreateStatusModalOpen(false)}
          title="Create Platform Status"
          size="md"
        >
          <form onSubmit={handleCreateStatus} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Entity Scope</label>
                <select
                  value={newStatusData.entity_type}
                  onChange={(e) => setNewStatusData({ ...newStatusData, entity_type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="task">Tasks</option>
                  <option value="shot">Shots</option>
                  <option value="asset">Assets</option>
                  <option value="version">Versions</option>
                  <option value="review">Reviews</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Workflow Category</label>
                <select
                  value={newStatusData.category}
                  onChange={(e) => setNewStatusData({ ...newStatusData, category: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="approved">Approved</option>
                  <option value="blocked">Blocked</option>
                  <option value="omitted">Omitted</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Status Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Director Approval, In Progress, Final"
                value={newStatusData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  const autoCode = val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
                  setNewStatusData({ ...newStatusData, name: val, code: newStatusData.code || autoCode });
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Code Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="dir_apr"
                  value={newStatusData.code}
                  onChange={(e) => setNewStatusData({ ...newStatusData, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Color Code</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newStatusData.color}
                    onChange={(e) => setNewStatusData({ ...newStatusData, color: e.target.value })}
                    className="w-9 h-9 rounded bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newStatusData.color}
                    onChange={(e) => setNewStatusData({ ...newStatusData, color: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 py-2">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newStatusData.is_default}
                  onChange={(e) => setNewStatusData({ ...newStatusData, is_default: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                />
                Default Starting Status
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newStatusData.is_final}
                  onChange={(e) => setNewStatusData({ ...newStatusData, is_final: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                />
                Final Completion Status
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateStatusModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={createStatusMutation.isPending}>
                Create Status
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE TASK TYPE MODAL */}
      {isCreateTaskTypeModalOpen && (
        <Modal
          isOpen={isCreateTaskTypeModalOpen}
          onClose={() => setIsCreateTaskTypeModalOpen(false)}
          title="Create Platform Task Type"
          size="md"
        >
          <form onSubmit={handleCreateTaskType} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Task Type Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Lookdev, Tracking, Layout"
                value={newTaskTypeData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  const autoCode = val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
                  setNewTaskTypeData({ ...newTaskTypeData, name: val, code: newTaskTypeData.code || autoCode });
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Code Slug</label>
                <input
                  type="text"
                  required
                  placeholder="lookdev"
                  value={newTaskTypeData.code}
                  onChange={(e) => setNewTaskTypeData({ ...newTaskTypeData, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Discipline Category</label>
                <select
                  value={newTaskTypeData.category}
                  onChange={(e) => setNewTaskTypeData({ ...newTaskTypeData, category: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="shot">Shot</option>
                  <option value="asset">Asset</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Department</label>
                <input
                  type="text"
                  required
                  placeholder="Surfacing & Lookdev"
                  value={newTaskTypeData.department_name}
                  onChange={(e) => setNewTaskTypeData({ ...newTaskTypeData, department_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Tag Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newTaskTypeData.color}
                    onChange={(e) => setNewTaskTypeData({ ...newTaskTypeData, color: e.target.value })}
                    className="w-9 h-9 rounded bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newTaskTypeData.color}
                    onChange={(e) => setNewTaskTypeData({ ...newTaskTypeData, color: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                value={newTaskTypeData.description}
                onChange={(e) => setNewTaskTypeData({ ...newTaskTypeData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateTaskTypeModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={createTaskTypeMutation.isPending}>
                Create Task Type
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
