import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { playlistsApi, reviewMediaRefetchInterval, versionPlayback, versionsApi } from '@/api/production/review';
import type { Version } from '@/api/production/review';
import { publishApi } from '@/api/publishing/publishing';
import { formatDateTime } from '@/core/locale/studioLocale';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { JobStatusBadge, useFilesListConfig } from '@/modules/publishing';
import { Badge } from '@/shared/components/Badge';
import { MediaCompare } from '@/shared/components/media/MediaCompare';
import { toFps } from '@/shared/components/media/frameTime';
import { fetchAllRows } from '@/shared/data/listing';
import { StatusBadge } from '@/shared/components/StatusBadge';

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">{children}</p>;

/** The playlists holding the version (`version_id`, C-RP-04), with where it sits in each. (Adding it to one is the button in the page header.) */
export const VersionPlaylistsTab: React.FC<{ version: Version }> = ({ version }) => {
  const playlists = useQuery({
    queryKey: [...playlistsApi.keys.all, 'holding', version.id],
    queryFn: ({ signal }) => fetchAllRows(playlistsApi.list, { version_id: version.id }, { signal }),
  });
  if (playlists.isLoading) return <p className="text-xs text-slate-500">Loading…</p>;
  const rows = playlists.data ?? [];
  if (rows.length === 0) return <Empty>This version is not in any playlist. Use “Add to playlist” above to put it in one.</Empty>;
  return (
    <ul aria-label="Playlists holding this version" className="space-y-2">
      {rows.map((p) => {
        const position = [...p.entries].sort((a, b) => a.item_order - b.item_order).findIndex((e) => e.version_id === version.id) + 1;
        const times = p.entries.filter((e) => e.version_id === version.id).length;
        return (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
            <span className="min-w-0">
              <Link to={`/playlists/${p.id}`} className="font-semibold text-cyan-300 hover:underline">
                {p.name}
              </Link>
              <span className="ml-2 font-mono text-[11px] text-slate-500">{p.code}</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">{`Entry ${position} of ${p.entries.length}${times > 1 ? ` · in ${times} entries` : ''}`}</span>
            {p.client_only && <Badge variant="outline">Client only</Badge>}
            <StatusBadge status={p.status} size="xs" />
          </li>
        );
      })}
    </ul>
  );
};

/** Whether the version is published, the export jobs that made it, and the files registered for it. */
export const VersionPublishingTab: React.FC<{ version: Version }> = ({ version }) => {
  const jobs = useQuery({ queryKey: [...publishApi.keys.lists(), 'of-version', version.id], queryFn: ({ signal }) => fetchAllRows(publishApi.list, { version_id: version.id }, { signal }) });
  const files = useFilesListConfig({ versionId: version.id });
  return (
    <div className="space-y-5">
      <section aria-label="Publish state" className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
        {version.is_published ? <Badge variant="success">Published</Badge> : <Badge variant="outline">Not published</Badge>}
        <span className="text-slate-400">
          {version.is_published ? `Published ${formatDateTime(version.published_at, '')}. Unpublish it before archiving it or changing its status.` : version.status === 'Approved' ? 'Approved and ready to publish: use Publish above.' : 'Only an approved version can be published.'}
        </span>
      </section>

      <section aria-label="Export jobs" className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Export jobs</h2>
        {jobs.isLoading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : (jobs.data ?? []).length === 0 ? (
          <Empty>No export job is tied to this version.</Empty>
        ) : (
          <ul aria-label="Export jobs of this version" className="space-y-1.5">
            {(jobs.data ?? []).map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
                <Link to={`/publishing/${j.id}`} className="font-semibold text-cyan-300 hover:underline">
                  {j.code} · {j.name}
                </Link>
                <span className="font-mono text-[11px] text-slate-400">{`${j.dcc_tool_display}${j.dcc_version ? ` ${j.dcc_version}` : ''}${j.export_format ? ` · ${j.export_format}` : ''}`}</span>
                <JobStatusBadge status={j.job_status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Registered files" className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Registered files</h2>
        <DirectoryListPage config={files} />
      </section>
    </div>
  );
};

/**
 * This version against another version of the same shot or asset, on the compare screen: wipe, side by side,
 * difference, onion skin or flip, on one transport. A is this version and B the newest other one; either side can be
 * switched to any version of the same record from the toolbar.
 */
export const VersionCompareTab: React.FC<{ version: Version }> = ({ version }) => {
  const [picked, setPicked] = useState<{ a: string; b: string } | null>(null);
  const others = useQuery({
    queryKey: [...versionsApi.keys.all, 'to-compare', version.id],
    queryFn: ({ signal }) => fetchAllRows(versionsApi.list, { project_id: version.project_id, entity_type: version.entity_type }, { signal }),
    select: (rows) => rows.filter((v) => v.entity_id === version.entity_id && v.id !== version.id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    refetchInterval: (q) => reviewMediaRefetchInterval((q.state.data ?? []).filter((v) => v.entity_id === version.entity_id)),
  });
  if (others.isLoading) return <p className="text-xs text-slate-500">Loading…</p>;
  const choices = others.data ?? [];
  if (choices.length === 0) return <Empty>{`There is no other version of ${version.entity_code || 'this record'} to compare with.`}</Empty>;
  const all = [version, ...choices];
  const find = (id: string | undefined, fallback: Version) => all.find((v) => v.id === id) ?? fallback;
  const a = find(picked?.a, version);
  const b = find(picked?.b, choices[0]);
  const source = (v: Version) => {
    const shown = versionPlayback(v);
    return { id: v.id, label: v.code, src: shown.src, poster: shown.poster, sourceId: shown.sourceId };
  };
  const sa = source(a);
  const sb = source(b);
  return (
    <MediaCompare
      key={`${a.id}|${b.id}`}
      label={`${a.code} against ${b.code}`}
      a={sa}
      b={sb}
      choices={all.map((v) => ({ id: v.id, label: `${v.version_number ? `${v.version_number} · ` : ''}${v.code} · ${v.status}` }))}
      onPick={(side, id) => setPicked({ a: side === 'a' ? id : a.id, b: side === 'b' ? id : b.id })}
      fps={toFps(versionPlayback(a).fps)}
      startFrame={a.start_frame ?? 1}
    />
  );
};
