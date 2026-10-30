import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { reviewsApi, versionsApi } from '@/api/production/review';
import type { Version } from '@/api/production/review';
import { EntityHistory } from '@/components/history/EntityHistory';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { StatusHistory } from '@/modules/production/work/StatusHistory';
import { StatusMenu } from '@/modules/production/work/StatusMenu';
import { PlaylistPicker } from './pickers';
import { reviewStatusVariant } from './reviews';
import { versionActions, versionBadges } from './versions';

type TabId = 'overview' | 'reviews' | 'status' | 'changes';
const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'status', label: 'Status history' },
  { id: 'changes', label: 'Changes' },
];

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-sm text-slate-200">{children || '—'}</dd>
  </div>
);

/** Reviews of this version. The server cannot list "reviews containing a version", so the entity's reviews are read and filtered here. */
const VersionReviews: React.FC<{ version: Version }> = ({ version }) => {
  const canCreate = useCan('review.create');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: [...reviewsApi.keys.lists(), 'of-version', version.id],
    queryFn: async ({ signal }) => (await reviewsApi.list({ project_id: version.project_id, entity_type: version.entity_type, entity_id: version.entity_id, page_size: 100 }, signal)).results.filter((r) => r.versions.some((v) => v.id === version.id)),
  });
  const [starting, setStarting] = useState(false);
  const [title, setTitle] = useState(`${version.entity_code} ${version.version_number} review`);
  const [code, setCode] = useState(`${version.code}_REVIEW`.toUpperCase());
  return (
    <div className="space-y-3">
      {canCreate && (
        <Button size="sm" variant="primary" onClick={() => setStarting(true)}>
          Start a review
        </Button>
      )}
      <QueryBoundary isLoading={reviews.isLoading} error={reviews.error} onRetry={() => void reviews.refetch()} entityName="reviews" isEmpty={(reviews.data ?? []).length === 0} empty={{ title: 'Not in any review', description: 'Start a review to put this version in front of the supervisor.' }}>
        <ul aria-label="Reviews of this version" className="space-y-2">
          {(reviews.data ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
              <Link to={`/reviews/${r.id}`} className="font-semibold text-cyan-300 hover:underline">
                {r.code} · {r.title}
              </Link>
              <Badge variant={reviewStatusVariant(r.status)}>{r.status}</Badge>
            </li>
          ))}
        </ul>
      </QueryBoundary>
      <ConfirmDialog
        isOpen={starting}
        title={`Start a review of ${version.version_number}`}
        confirmLabel="Start review"
        onClose={() => setStarting(false)}
        message={
          <div className="space-y-3">
            <label className="block text-xs text-slate-400">
              Title
              <input aria-label="Review title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
            </label>
            <label className="block text-xs text-slate-400">
              Code
              <input aria-label="Review code" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
            </label>
          </div>
        }
        onConfirm={async () => {
          const created = await reviewsApi.create({ project: version.project_id, title: title.trim(), code: code.trim(), entity_type: version.entity_type, entity_id: version.entity_id, entity_code: version.entity_code });
          await reviewsApi.addVersion(created.id, version.id);
          await queryClient.invalidateQueries({ queryKey: reviewsApi.keys.all });
          navigate(`/reviews/${created.id}`);
        }}
      />
    </div>
  );
};

const AddToPlaylist: React.FC<{ version: Version }> = ({ version }) => {
  const [open, setOpen] = useState(false);
  const [playlist, setPlaylist] = useState<string | null>(null);
  const [name, setName] = useState('');
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Add to playlist
      </Button>
      <ConfirmDialog
        isOpen={open}
        title={`Add ${version.version_number} to a playlist`}
        confirmLabel="Add"
        onClose={() => setOpen(false)}
        message={
          <div className="space-y-3">
            <PlaylistPicker label="Existing playlist" value={playlist} onChange={setPlaylist} filters={{ project_id: version.project_id }} />
            <label className="block text-xs text-slate-400">
              …or a new playlist
              <input aria-label="New playlist name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
            </label>
          </div>
        }
        onConfirm={async () => {
          if (!playlist && !name.trim()) throw new Error('Choose a playlist or name a new one.');
          await versionsApi.addToPlaylist(version.id, playlist ? { playlist_id: playlist } : { playlist_name: name.trim() });
          notify.success('Added to the playlist.');
        }}
      />
    </>
  );
};

export const VersionWorkspace: React.FC = () => {
  const { versionId = '' } = useParams();
  const queryClient = useQueryClient();
  const canUpdate = useCan('version.update');
  const canPublish = useCan('version.publish');
  const [tab, setTab] = useState<TabId>('overview');
  const [action, setAction] = useState<ReturnType<typeof versionActions>[number] | null>(null);
  const query = useQuery({ queryKey: versionsApi.keys.detail(versionId), queryFn: ({ signal }) => versionsApi.get(versionId, signal), enabled: Boolean(versionId) });
  const v = query.data;
  const refresh = () => Promise.all([versionsApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName="version">
        {v && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <Link to="/versions" className="text-[11px] text-slate-500 hover:text-slate-300">
                  ← Versions
                </Link>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {v.code} · {v.version_number}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {v.entity_type} {v.entity_code} · {v.project_code}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {versionBadges(v)}
                <StatusMenu entity="version" status={v.status} name={v.code} canChange={canUpdate && !v.is_published} change={(next) => versionsApi.update(v.id, { status: next })} invalidate={[versionsApi.keys.all]} />
                {versionActions(v, canPublish).map((a) => (
                  <Button key={a.label} size="sm" variant="outline" onClick={() => setAction(a)}>
                    {a.label}
                  </Button>
                ))}
                <AddToPlaylist version={v} />
                {canUpdate && (
                  <Link to={`/versions/${v.id}/edit`}>
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            <div role="tablist" aria-label="Version sections" className="flex gap-1 border-b border-slate-800">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 text-xs font-semibold ${tab === t.id ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'overview' && (
              <>
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Fact label="Department">{v.department}</Fact>
                  <Fact label="Artist">{v.artist_name}</Fact>
                  <Fact label="Frames">{v.frame_range}</Fact>
                  <Fact label="Resolution">{v.resolution}</Fact>
                  <Fact label="Frame rate">{v.fps}</Fact>
                  <Fact label="Colour space">{v.color_space}</Fact>
                  <Fact label="Published">{v.published_at ? new Date(v.published_at).toLocaleString() : ''}</Fact>
                  <Fact label="Created">{new Date(v.created_at).toLocaleString()}</Fact>
                </dl>
                {v.notes && <p className="text-sm text-slate-300 whitespace-pre-wrap">{v.notes}</p>}
                {v.changelog && <p className="text-xs text-slate-400 whitespace-pre-wrap">{v.changelog}</p>}
              </>
            )}
            {tab === 'reviews' && <VersionReviews version={v} />}
            {tab === 'status' && <StatusHistory queryKey={[...versionsApi.keys.detail(v.id), 'status-history']} fetch={(signal) => versionsApi.statusHistory(v.id, signal)} />}
            {tab === 'changes' && <EntityHistory targetType="Version" targetId={v.id} />}

            <ConfirmDialog
              isOpen={action !== null}
              title={action ? `${action.label}: ${v.code}` : ''}
              message={action?.confirm ?? ''}
              confirmLabel={action?.label ?? 'Confirm'}
              destructive={action?.destructive}
              onClose={() => setAction(null)}
              onConfirm={async () => {
                if (!action) return;
                await action.run(); // a refusal (not approved, separation of duties…) stays in the dialog with the server's reason
                await refresh();
              }}
            />
          </>
        )}
      </QueryBoundary>
    </div>
  );
};
