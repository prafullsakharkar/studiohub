import { ClientSelect, ClientContactSelect } from '@/modules/clients';
import { VendorSelect } from '@/modules/vendors';
import React, { useState } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useProjectMutations } from '../hooks/useProjectMutations';
import { Card, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Modal } from '@/shared/components/Modal';
import { Can } from '@/core/permissions/Can';
import { usePermissions } from '@/core/permissions/usePermissions';
import {
  Plus,
  Film,
  Calendar,
  Clapperboard,
  Layers,
  Sparkles,
  Building,
  Building2,
  Trash2,
  Edit3,
  AlertTriangle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Project } from '@/types/production';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { useProductionStore } from '@/core/production/useProductionStore';
;
;
;
import { ApiErrorState } from '@/components/system/ApiErrorState';
import { WorkspaceOpenButton } from '@/shared/workspace/canonical/WorkspaceButtons';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { can: canScoped } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const { data, isLoading, error, refetch } = useProjects({
    search: search || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
  });

  const { createProject, deleteProject, isCreating, isDeleting } = useProjectMutations();
  const [codeError, setCodeError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    client_id: 'cl-001',
    client_name: 'Warner Nexus Studios',
    client_contact_id: 'cc-001',
    client_contact_name: 'Sarah Jenkins',
    vendor_ids: ['ven-001'],
    vendor_names: ['Silhouette FX Labs India'],
    description: '',
    fps: 24,
    resolution: '3840x2160',
    color_space: 'ACES - ACEScg',
    delivery_date: '2026-12-15',
  });

  const handleCodeChange = (rawCode: string) => {
    const formatted = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    setFormData((prev) => ({ ...prev, code: formatted }));

    if (!formatted) {
      setCodeError('Project code is required.');
      return;
    }

    const duplicate = (data?.results || []).find((p) => p.code?.toUpperCase() === formatted);
    if (duplicate) {
      setCodeError(`Code "${formatted}" already in use by "${duplicate.name}". Must be unique.`);
    } else {
      setCodeError(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentCode = formData.code.trim().toUpperCase();
    if (!currentCode) {
      setCodeError('Project code is required.');
      return;
    }

    const duplicate = (data?.results || []).find((p) => p.code?.toUpperCase() === currentCode);
    if (duplicate) {
      setCodeError(`Project code "${currentCode}" already exists. Project codes must be unique.`);
      return;
    }

    await createProject({
      ...formData,
      code: currentCode,
      status: 'In Progress',
      total_shots: 0,
      approved_shots: 0,
      in_progress_shots: 0,
      total_assets: 0,
      supervisor_name: 'Alex Chen',
      coordinator_name: 'Marcus Vance',
      budget_usd: 1500000,
    } as Partial<Project>);
    setIsCreateOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    await deleteProject(projectToDelete.id);
    setProjectToDelete(null);
    refetch();
  };

  const projects = data?.results || [];

  const hasUntitledProjects = projects.some(
    (p) => !p.name || p.name.toLowerCase().includes('untitled') || !p.code
  );

  const handlePurgeUntitled = async () => {
    const untitled = projects.filter(
      (p) => !p.name || p.name.toLowerCase().includes('untitled') || !p.code
    );
    for (const p of untitled) {
      await deleteProject(p.id);
    }
    refetch();
  };

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
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Productions & Shows
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-indigo-300 border border-indigo-500/30 rounded-md flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-indigo-400" />
                  Studio Context
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  {projects.length} Active Shows
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  OpenUSD 24.08 Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Feature films, episodic series, and commercial pipeline projects across the studio.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Can permission="projects:create">
              <Button
                id="create-project-btn"
                variant="primary"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                New Production
              </Button>
            </Can>
          </div>
        </div>
      </div>

      {/* Main Studio View */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Filter Bar */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
            <SearchInput
              className="w-full sm:w-80"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              placeholder="Filter by title, show code, or client..."
            />
          </div>

          <div className="flex items-center space-x-2 w-full lg:w-auto overflow-x-auto">
            {['ALL', 'In Progress', 'Approved', 'Pending Review', 'On Hold'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Untitled Projects Purge Alert Banner */}
        {hasUntitledProjects && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-200">
                  Legacy / Untitled Productions Detected
                </h4>
                <p className="text-xs text-amber-300/80">
                  Some productions were saved without required title or unique code. You can delete them below or purge them immediately.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={handlePurgeUntitled}
              disabled={isDeleting}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              className="shrink-0"
            >
              Purge Untitled Productions
            </Button>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <LoadingSpinner size="lg" label="Loading productions..." />
        ) : error ? (
          <div className="p-6">
            <ApiErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<Film className="w-8 h-8 text-indigo-400" />}
            title="No Productions Found"
            description="There are no active productions matching your current filter criteria."
            actionLabel="Create Production"
            onAction={() => setIsCreateOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((proj) => {
              const completionPct =
                proj.total_shots > 0 ? Math.round((proj.approved_shots / proj.total_shots) * 100) : 0;
              const isUntitled = !proj.name || proj.name.toLowerCase().includes('untitled') || !proj.code;

              return (
                <Card
                  key={proj.id}
                  className={`bg-slate-900 transition-all flex flex-col justify-between shadow-md group ${
                    isUntitled
                      ? 'border-amber-500/40 hover:border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <CardBody className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                            {proj.code || 'NO-CODE'}
                          </span>
                          {isUntitled && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              UNTITLED
                            </span>
                          )}
                        </div>
                        <Link
                          to={`/projects/${proj.id}`}
                          onClick={() => {
                            useProductionStore.getState().setActiveProject(proj.id);
                          }}
                          className="hover:text-indigo-400 transition-colors"
                        >
                          <h3 className="text-base font-bold text-white pt-1 hover:text-indigo-300 transition-colors">
                            {proj.name || 'Untitled Production'}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Building className="w-3 h-3 text-indigo-400 shrink-0" />
                          {proj.client_id ? (
                            <Link
                              to={`/clients/${proj.client_id}`}
                              className="hover:text-indigo-300 transition-colors underline-offset-2 hover:underline"
                            >
                              {proj.client_name}
                            </Link>
                          ) : (
                            <span>{proj.client_name}</span>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={proj.status} />
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {proj.description || 'Production pipeline show.'}
                    </p>

                    {/* Vendor Partners Badges */}
                    {proj.vendor_names && proj.vendor_names.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">
                          Outsourcing Partners:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {proj.vendor_names.map((vName, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 text-[10px] font-mono border border-purple-500/30"
                            >
                              {vName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Shot Pipeline Progress</span>
                        <span className="font-mono font-bold text-white">
                          {proj.approved_shots} / {proj.total_shots} ({completionPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2">
                      <div className="flex items-center gap-1.5">
                        <Clapperboard className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{proj.total_assets} Assets</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Delivery: {proj.delivery_date}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-500" />
                        <span>{proj.color_space}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-slate-500" />
                        <span>{proj.fps} FPS @ {proj.resolution}</span>
                      </div>
                    </div>
                  </CardBody>

                  <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 truncate">
                      Sup: <strong className="text-slate-200">{proj.supervisor_name}</strong>
                    </span>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <WorkspaceOpenButton
                        to={`/projects/${proj.id}`}
                        onClick={() => {
                          useProductionStore.getState().setActiveProject(proj.id);
                        }}
                        title="Open Show Workspace"
                      />
                      <button
                        onClick={() => {
                          useProductionStore.getState().setActiveProject(proj.id);
                          useWorkspaceStore.getState().openInWorkspace({
                            id: proj.id,
                            type: 'project',
                            title: proj.name,
                            code: proj.code,
                            subtitle: proj.type,
                            status: proj.status,
                            thumbnail_url: proj.thumbnail_url,
                          }, 'full');
                          navigate('/workspace');
                        }}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-mono font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Open in Non-Linear Studio Canvas"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        <span>Canvas</span>
                      </button>

                      {canScoped({ permission: 'project.update', projectId: proj.id }) && (
                        <button
                          onClick={() => navigate(`/projects/${proj.id}/edit`)}
                          className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 border border-slate-800 text-xs transition-colors cursor-pointer"
                          title="Edit Production"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canScoped({ permission: 'project.delete', projectId: proj.id }) && (
                        <button
                          onClick={() => setProjectToDelete(proj)}
                          className="p-1 rounded bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 text-xs transition-colors cursor-pointer"
                          title="Delete / Archive Production"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete / Archive Confirmation Modal */}
      <Modal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        title="Delete / Archive Production"
        subtitle={`Confirm removal of ${projectToDelete?.name} [${projectToDelete?.code}]`}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-rose-950/30 border border-rose-800/50 rounded-xl text-xs text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">Are you sure you want to delete this show?</p>
              <p className="mt-1 text-slate-300 leading-relaxed">
                Deleting <strong>{projectToDelete?.name} ({projectToDelete?.code})</strong> will remove it from all studio workspaces, access policies, sequences, and shot rosters.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProjectToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteConfirm}
              isLoading={isDeleting}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Initialize New VFX Production"
        subtitle="Register a new feature, episodic show, or commercial campaign into StudioHub"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Production Title *</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Chrono Station"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Show Code (Prefix) *</label>
                <span className="text-[10px] font-mono text-slate-400">Must be unique</span>
              </div>
              <input
                required
                type="text"
                value={formData.code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="e.g. CS01"
                className={`w-full px-3 py-2 bg-slate-900 border rounded-lg text-sm text-white font-mono uppercase focus:ring-2 ${
                  codeError ? 'border-rose-500 focus:ring-rose-500 text-rose-200' : 'border-slate-700 focus:ring-indigo-500'
                }`}
              />
              {codeError && (
                <p className="text-[11px] text-rose-400 font-mono mt-0.5">{codeError}</p>
              )}
            </div>
          </div>

          {/* Client Selection (Reusable Selector) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Client Studio</label>
              <ClientSelect
                value={formData.client_id}
                onChange={(cId, cName) => {
                  setFormData({
                    ...formData,
                    client_id: cId,
                    client_name: cName || '',
                  });
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Client Contact Liaison</label>
              <ClientContactSelect
                clientId={formData.client_id}
                value={formData.client_contact_id}
                onChange={(contId, contName) => {
                  setFormData({
                    ...formData,
                    client_contact_id: contId,
                    client_contact_name: contName ?? '',
                  });
                }}
              />
            </div>
          </div>

          {/* Primary Vendor Partner Selection (Reusable Selector) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Primary Outsourcing Vendor Partner</label>
            <VendorSelect
              value={formData.vendor_ids[0] || ''}
              onChange={(vId, vName) => {
                setFormData({
                  ...formData,
                  vendor_ids: vId ? [vId] : [],
                  vendor_names: vName ? [vName] : [],
                });
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Synopsis and VFX scope..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Target Frame Rate</label>
              <input
                type="number"
                value={formData.fps}
                onChange={(e) => setFormData({ ...formData, fps: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Master Resolution</label>
              <input
                type="text"
                value={formData.resolution}
                onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Delivery Date</label>
              <input
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button variant="ghost" size="md" onClick={() => setIsCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isCreating}
              disabled={!formData.name || !formData.code || !!codeError}
            >
              Initialize Show
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
