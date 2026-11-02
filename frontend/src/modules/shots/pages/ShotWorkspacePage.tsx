import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertCircle, Archive, CheckCircle2, CheckSquare, ChevronLeft, Clapperboard, Clock, Copy, Edit, FileText, GitBranch, HardDrive, Layers, LayoutGrid, Film, Plus, UserCheck } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { shotsApi } from '@/api/production/work';
import { SmartImg } from '@/components/ui/SmartImg';
import { notify } from '@/core/notifications/notify';
import { AssignArtistDialog } from '@/modules/production/work/AssignArtistDialog';
import { EntityNotesTab } from '@/modules/production/work/EntityNotes';
import { EntityTasksPanel, ShotAssetsPanel, WorkHistoryPanel } from '@/modules/production/work/panels';
import { EntityMediaTab, EntityReviewsTab, EntityVersionsTab } from '@/modules/production/review/EntityRecords';
import { Button } from '@/shared/components/Button';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { ScrollableTabs, type TabItem } from '@/shared/components/tabs/ScrollableTabs';
import { type BreadcrumbItem, CanonicalWorkspaceHeader, WorkspaceShell, type WorkspaceAction } from '@/shared/workspace/canonical';
import { ShotOverview } from '../components/workspace/ShotOverview';

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'assets', label: 'Assets', icon: Layers },
  { id: 'versions', label: 'Versions', icon: GitBranch },
  { id: 'reviews', label: 'Reviews', icon: Film },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'media', label: 'Media & Files', icon: HardDrive },
  { id: 'history', label: 'History', icon: Activity },
];

/** The shot's page: its own fields from `GET /shots/{id}/`, and the typed panels for what hangs off it. */
export const ShotWorkspacePage: React.FC = () => {
  const params = useParams<{ projectId?: string; shotId?: string; id?: string; tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState(false);

  const shotId = params.shotId || params.id || '';
  const tab = params.tab || searchParams.get('tab') || 'overview';
  const query = useQuery({ queryKey: shotsApi.keys.detail(shotId), queryFn: ({ signal }) => shotsApi.get(shotId, signal), enabled: shotId !== '' });
  const shot = query.data;
  const listPath = params.projectId ? `/projects/${params.projectId}/shots` : '/shots';

  const changeTab = (tabId: string) => {
    if (params.tab) navigate(`${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))}/${tabId}`);
    else setSearchParams({ tab: tabId });
  };
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: shotsApi.keys.all }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
  const attempt = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      notify.fromError(error);
    }
  };

  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    if (!shot) return [];
    const projectId = params.projectId || shot.project_id;
    return [
      { label: 'StudioHub', href: '/' },
      { label: shot.project_code || 'Project', href: projectId ? `/projects/${projectId}` : '/projects' },
      { label: shot.sequence_code || 'Shots', href: listPath },
      { label: shot.code, isCurrent: true },
    ];
  }, [shot, params.projectId, listPath]);

  const actions: WorkspaceAction[] = useMemo(() => {
    if (!shot) return [];
    return [
      { id: 'edit-shot', label: 'Edit Shot', icon: <Edit className="w-3.5 h-3.5" />, variant: 'primary', permission: 'shot.update', onClick: () => navigate(`/shots/${shot.id}/edit`) },
      { id: 'assign-artist', label: shot.assigned_artist_name ? 'Reassign' : 'Assign Artist', icon: <UserCheck className="w-3.5 h-3.5" />, variant: 'secondary', permission: 'shot.update', onClick: () => setAssigning(true) },
      { id: 'add-task', label: 'Add Task', icon: <Plus className="w-3.5 h-3.5" />, variant: 'outline', permission: 'task.create', onClick: () => navigate(`/tasks/new?project=${shot.project_id}&entity_type=Shot&entity_id=${shot.id}`) },
      { id: 'submit-version', label: 'Submit New Version', icon: <GitBranch className="w-3.5 h-3.5" />, permission: 'version.create', onClick: () => navigate(`/versions/new?project=${shot.project_id}&shot=${shot.id}`) },
      { id: 'add-note', label: 'Add Note', icon: <FileText className="w-3.5 h-3.5" />, permission: 'note.create', onClick: () => changeTab('notes') },
      {
        id: 'approve-shot',
        label: 'Approve Shot',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
        permission: 'shot.approve',
        // The server approves only from Pending Review; any other state answers 400 invalid_transition.
        visible: shot.status === 'Pending Review',
        confirm: { title: `Approve ${shot.code}?`, message: 'The shot is approved by the supervisor.', confirmText: 'Approve', variant: 'primary' },
        onClick: () => attempt(async () => { await shotsApi.approve(shot.id); await refresh(); notify.success(`${shot.code} approved.`); }),
      },
      { id: 'copy-shot-code', label: 'Copy Shot Code', icon: <Copy className="w-3.5 h-3.5" />, onClick: () => { void navigator.clipboard.writeText(shot.code); notify.info(`Shot code ${shot.code} copied.`); } },
      { id: 'copy-frame-range', label: 'Copy Frame Range', icon: <Clock className="w-3.5 h-3.5" />, onClick: () => { const text = `${shot.frame_in}-${shot.frame_out} (${shot.frame_count} frames)`; void navigator.clipboard.writeText(text); notify.info(`Frame range ${text} copied.`); } },
      {
        // The server's DELETE and its archive route are the same soft delete: there is no permanent delete. Restoring is in the archived view of the shot list.
        id: 'archive-shot',
        label: 'Archive Shot',
        icon: <Archive className="w-3.5 h-3.5 text-amber-400" />,
        dividerBefore: true,
        danger: true,
        permission: 'shot.archive',
        confirm: { title: `Archive ${shot.code}?`, message: `${shot.code} is hidden from the shot lists and can be restored from the archived view.`, confirmText: 'Archive Shot', variant: 'warning' },
        onClick: () => attempt(async () => { await shotsApi.archive(shot.id); await refresh(); notify.success(`${shot.code} archived.`); navigate(listPath); }),
      },
    ];
    // biome-ignore lint/correctness/useExhaustiveDependencies: the handlers close over stable helpers
  }, [shot, navigate, listPath]);

  if (query.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
        <span className="text-xs text-slate-400 mt-3 font-mono">Loading the shot…</span>
      </div>
    );
  }
  if (query.error || !shot) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Shot not found</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          The shot <span className="font-mono text-slate-300">{shotId}</span> does not exist, was archived, or you cannot see its project.
        </p>
        <Link to={listPath}>
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
            Back to Shots
          </Button>
        </Link>
      </div>
    );
  }

  const entity = { type: 'Shot' as const, id: shot.id, projectId: shot.project_id };
  return (
    <WorkspaceShell
      activeTabKey={tab}
      header={
        <CanonicalWorkspaceHeader
          breadcrumbs={breadcrumbs}
          backTo={listPath}
          backLabel="Back to Shots"
          avatar={
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">
              {shot.thumbnail_url ? <SmartImg src={shot.thumbnail_url} alt={shot.code} className="w-full h-full object-cover" /> : <Clapperboard className="w-8 h-8 text-indigo-400" />}
            </div>
          }
          title={shot.name || shot.code}
          code={shot.code}
          status={shot.status}
          metadata={[
            { icon: Clock, label: 'Frames', value: `${shot.frame_in} - ${shot.frame_out} (${shot.frame_count}f)` },
            { label: 'Handles', value: `${shot.handle_frames}f` },
            { label: 'Artist', value: shot.assigned_artist_name || 'Unassigned' },
            { label: 'Version', value: shot.current_version || '—' },
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
      {tab === 'overview' && <ShotOverview shot={shot} />}
      {tab === 'tasks' && <EntityTasksPanel target={{ ...entity, code: shot.code }} />}
      {tab === 'assets' && <ShotAssetsPanel shot={shot} />}
      {tab === 'versions' && <EntityVersionsTab entity={entity} />}
      {tab === 'reviews' && <EntityReviewsTab entity={entity} />}
      {tab === 'notes' && <EntityNotesTab target={{ ...entity, code: shot.code, name: shot.name }} />}
      {tab === 'media' && <EntityMediaTab entity={entity} />}
      {tab === 'history' && <WorkHistoryPanel targetType="Shot" id={shot.id} />}
      {assigning && <AssignArtistDialog target={{ id: shot.id, code: shot.code, projectId: shot.project_id, assignedArtistId: shot.assigned_artist_id }} save={(userId) => shotsApi.update(shot.id, { assigned_artist: userId })} queryKey={shotsApi.keys.all} onClose={() => setAssigning(false)} />}
    </WorkspaceShell>
  );
};
