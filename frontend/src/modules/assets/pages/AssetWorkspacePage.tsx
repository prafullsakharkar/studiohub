import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertCircle, Archive, Box, CheckSquare, ChevronLeft, Clapperboard, Copy, Edit, FileText, Film, GitBranch, HardDrive, Layers, LayoutGrid, Plus, UserCheck } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { assetsApi } from '@/api/production/work';
import { SmartImg } from '@/components/ui/SmartImg';
import { notify } from '@/core/notifications/notify';
import { AssignArtistDialog } from '@/modules/production/work/AssignArtistDialog';
import { EntityNotesTab } from '@/modules/production/work/EntityNotes';
import { AssetShotsPanel, EntityTasksPanel, WorkHistoryPanel } from '@/modules/production/work/panels';
import { EntityMediaTab, EntityReviewsTab, EntityVersionsTab } from '@/modules/production/review/EntityRecords';
import { Button } from '@/shared/components/Button';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { ScrollableTabs, type TabItem } from '@/shared/components/tabs/ScrollableTabs';
import { type BreadcrumbItem, CanonicalWorkspaceHeader, WorkspaceShell, type WorkspaceAction } from '@/shared/workspace/canonical';
import { AssetOverview } from '../components/workspace/AssetOverview';

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'shots', label: 'Shots', icon: Clapperboard },
  { id: 'versions', label: 'Versions', icon: GitBranch },
  { id: 'reviews', label: 'Reviews', icon: Film },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'media', label: 'Media & Files', icon: HardDrive },
  { id: 'history', label: 'History', icon: Activity },
];

/** The asset's page: its own fields from `GET /assets/{id}/`, and the typed panels for what hangs off it. */
export const AssetWorkspacePage: React.FC = () => {
  const params = useParams<{ projectId?: string; assetId?: string; id?: string; tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState(false);

  const assetId = params.assetId || params.id || '';
  const tab = params.tab || searchParams.get('tab') || 'overview';
  const query = useQuery({ queryKey: assetsApi.keys.detail(assetId), queryFn: ({ signal }) => assetsApi.get(assetId, signal), enabled: assetId !== '' });
  const asset = query.data;
  const listPath = params.projectId ? `/projects/${params.projectId}/assets` : '/assets';

  const changeTab = (tabId: string) => {
    if (params.tab) navigate(`${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))}/${tabId}`);
    else setSearchParams({ tab: tabId });
  };
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: assetsApi.keys.all }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
  const attempt = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      notify.fromError(error);
    }
  };

  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    if (!asset) return [];
    const projectId = params.projectId || asset.project_id;
    return [
      { label: 'StudioHub', href: '/' },
      { label: asset.project_code || 'Project', href: projectId ? `/projects/${projectId}` : '/projects' },
      { label: 'Assets', href: listPath },
      { label: asset.code, isCurrent: true },
    ];
  }, [asset, params.projectId, listPath]);

  const actions: WorkspaceAction[] = useMemo(() => {
    if (!asset) return [];
    return [
      { id: 'edit-asset', label: 'Edit Asset', icon: <Edit className="w-3.5 h-3.5" />, variant: 'primary', permission: 'asset.update', onClick: () => navigate(`/assets/${asset.id}/edit`) },
      { id: 'assign-artist', label: asset.assigned_artist_name ? 'Reassign' : 'Assign Artist', icon: <UserCheck className="w-3.5 h-3.5" />, variant: 'secondary', permission: 'asset.update', onClick: () => setAssigning(true) },
      { id: 'add-task', label: 'Add Task', icon: <Plus className="w-3.5 h-3.5" />, variant: 'outline', permission: 'task.create', onClick: () => navigate(`/tasks/new?project=${asset.project_id}&entity_type=Asset&entity_id=${asset.id}`) },
      { id: 'submit-version', label: 'Submit New Version', icon: <GitBranch className="w-3.5 h-3.5" />, permission: 'version.create', onClick: () => navigate(`/versions/new?project=${asset.project_id}&asset=${asset.id}`) },
      { id: 'add-note', label: 'Add Note', icon: <FileText className="w-3.5 h-3.5" />, permission: 'note.create', onClick: () => changeTab('notes') },
      { id: 'copy-asset-code', label: 'Copy Asset Code', icon: <Copy className="w-3.5 h-3.5" />, onClick: () => { void navigator.clipboard.writeText(asset.code); notify.info(`Asset code ${asset.code} copied.`); } },
      { id: 'copy-usd-prim', label: 'Copy USD Prim Path', icon: <Layers className="w-3.5 h-3.5" />, visible: Boolean(asset.usd_prim_path), onClick: () => { void navigator.clipboard.writeText(asset.usd_prim_path); notify.info('USD prim path copied.'); } },
      {
        // The server's DELETE and its archive route are the same soft delete: there is no permanent delete. Restoring is in the archived view of the asset list.
        id: 'archive-asset',
        label: 'Archive Asset',
        icon: <Archive className="w-3.5 h-3.5 text-amber-400" />,
        dividerBefore: true,
        danger: true,
        permission: 'asset.archive',
        confirm: { title: `Archive ${asset.code}?`, message: `${asset.code} is hidden from the asset lists and can be restored from the archived view.`, confirmText: 'Archive Asset', variant: 'warning' },
        onClick: () => attempt(async () => { await assetsApi.archive(asset.id); await refresh(); notify.success(`${asset.code} archived.`); navigate(listPath); }),
      },
    ];
    // biome-ignore lint/correctness/useExhaustiveDependencies: the handlers close over stable helpers
  }, [asset, navigate, listPath]);

  if (query.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
        <span className="text-xs text-slate-400 mt-3 font-mono">Loading the asset…</span>
      </div>
    );
  }
  if (query.error || !asset) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Asset not found</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          The asset <span className="font-mono text-slate-300">{assetId}</span> does not exist, was archived, or you cannot see its project.
        </p>
        <Link to={listPath}>
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
            Back to Assets
          </Button>
        </Link>
      </div>
    );
  }

  const entity = { type: 'Asset' as const, id: asset.id, projectId: asset.project_id };
  return (
    <WorkspaceShell
      activeTabKey={tab}
      header={
        <CanonicalWorkspaceHeader
          breadcrumbs={breadcrumbs}
          backTo={listPath}
          backLabel="Back to Assets"
          avatar={
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">
              {asset.thumbnail_url ? <SmartImg src={asset.thumbnail_url} alt={asset.code} className="w-full h-full object-cover" /> : <Box className="w-8 h-8 text-indigo-400" />}
            </div>
          }
          title={asset.name || asset.code}
          code={asset.code}
          status={asset.status}
          metadata={[
            { label: 'Category', value: asset.category },
            { label: 'Version', value: asset.version || '—' },
            { label: 'Artist', value: asset.assigned_artist_name || 'Unassigned' },
          ]}
          actions={actions}
        />
      }
      tabs={
        <div className="px-1">
          <ScrollableTabs tabs={TABS} activeTab={tab} onTabChange={changeTab} variant="pills" size="sm" />
        </div>
      }
    >
      {tab === 'overview' && <AssetOverview asset={asset} />}
      {tab === 'tasks' && <EntityTasksPanel target={{ ...entity, code: asset.code }} />}
      {tab === 'shots' && <AssetShotsPanel asset={asset} />}
      {tab === 'versions' && <EntityVersionsTab entity={entity} />}
      {tab === 'reviews' && <EntityReviewsTab entity={entity} />}
      {tab === 'notes' && <EntityNotesTab target={{ ...entity, code: asset.code, name: asset.name }} />}
      {tab === 'media' && <EntityMediaTab entity={entity} />}
      {tab === 'history' && <WorkHistoryPanel targetType="Asset" id={asset.id} />}
      {assigning && <AssignArtistDialog target={{ id: asset.id, code: asset.code, projectId: asset.project_id, assignedArtistId: asset.assigned_artist_id }} save={(userId) => assetsApi.update(asset.id, { assigned_artist: userId })} queryKey={assetsApi.keys.all} onClose={() => setAssigning(false)} />}
    </WorkspaceShell>
  );
};
