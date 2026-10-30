import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { Link } from 'react-router-dom';
import { mediaApi, reviewsApi, versionsApi } from '@/api/production/review';
import type { Media, Review, Version } from '@/api/production/review';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useCan } from '@/core/permissions/useCan';
import { fetchAllRows } from '@/shared/data/listing';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { mediaName } from './media';
import { reviewStatusVariant } from './reviews';
import { versionBadges } from './versions';

export interface EntityRef {
  type: 'Shot' | 'Asset';
  id: string;
  projectId: string;
}

interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
}

/**
 * The records that belong to one shot or asset. The server narrows versions and reviews by project and
 * entity TYPE only (entity_id, shot_id and asset_id are ignored) and media by project only, so every row of
 * that narrower list is read and the entity's own are kept here.
 */
function EntityRecords<T extends { id: string }>({ title, queryKey, load, columns, rowLink, createTo, createPermission, createLabel, empty }: {
  title: string;
  queryKey: readonly unknown[];
  load: (signal?: AbortSignal) => Promise<T[]>;
  columns: ReadonlyArray<Column<T>>;
  rowLink?: (row: T) => string;
  createTo: string;
  createPermission: string;
  createLabel: string;
  empty: string;
}) {
  const canCreate = useCan(createPermission);
  const query = useQuery({ queryKey, queryFn: ({ signal }) => load(signal) });
  const rows = query.data ?? [];
  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">
          {title}
          {query.data ? ` (${rows.length})` : ''}
        </h2>
        {canCreate && (
          <Link to={createTo}>
            <Button size="sm" variant="primary">
              {createLabel}
            </Button>
          </Link>
        )}
      </div>
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName={title.toLowerCase()}>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">{empty}</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-left text-slate-400">
              <tr>
                {columns.map((c) => (
                  <th key={c.header} className="py-1 pr-3">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-800 text-slate-300">
                  {columns.map((c, index) => (
                    <td key={c.header} className="py-1.5 pr-3">
                      {index === 0 && rowLink ? (
                        <Link to={rowLink(row)} className="font-semibold text-cyan-300 hover:underline">
                          {c.cell(row)}
                        </Link>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </QueryBoundary>
    </section>
  );
}

const prefill = (entity: EntityRef) => `project=${entity.projectId}&entity_type=${entity.type}&entity_id=${entity.id}`;

export const EntityVersionsTab: React.FC<{ entity: EntityRef }> = ({ entity }) => (
  <EntityRecords<Version>
    title="Versions"
    queryKey={[...versionsApi.keys.all, 'of', entity.type, entity.id]}
    load={async (signal) => (await fetchAllRows(versionsApi.list, { project_id: entity.projectId, entity_type: entity.type }, { signal })).filter((v) => v.entity_id === entity.id)}
    columns={[
      { header: 'Version', cell: (v) => `${v.code} · ${v.version_number}` },
      { header: 'Department', cell: (v) => v.department || '—' },
      { header: 'Artist', cell: (v) => v.artist_name || '—' },
      { header: 'State', cell: versionBadges },
      { header: 'Status', cell: (v) => v.status },
    ]}
    rowLink={(v) => `/versions/${v.id}`}
    createTo={`/versions/new?project=${entity.projectId}&${entity.type === 'Shot' ? 'shot' : 'asset'}=${entity.id}`}
    createPermission="version.create"
    createLabel="New version"
    empty={`No versions of this ${entity.type.toLowerCase()} yet.`}
  />
);

export const EntityReviewsTab: React.FC<{ entity: EntityRef }> = ({ entity }) => (
  <EntityRecords<Review>
    title="Reviews"
    queryKey={[...reviewsApi.keys.all, 'of', entity.type, entity.id]}
    load={async (signal) => (await fetchAllRows(reviewsApi.list, { project_id: entity.projectId, entity_type: entity.type }, { signal })).filter((r) => r.entity_id === entity.id)}
    columns={[
      { header: 'Review', cell: (r) => `${r.code} · ${r.title}` },
      { header: 'Versions', cell: (r) => r.versions.length },
      { header: 'People', cell: (r) => r.reviewers.length },
      { header: 'Status', cell: (r) => <Badge variant={reviewStatusVariant(r.status)}>{r.status}</Badge> },
    ]}
    rowLink={(r) => `/reviews/${r.id}`}
    createTo={`/reviews/new?${prefill(entity)}`}
    createPermission="review.create"
    createLabel="New review"
    empty={`No reviews of this ${entity.type.toLowerCase()} yet.`}
  />
);

export const EntityMediaTab: React.FC<{ entity: EntityRef }> = ({ entity }) => (
  <EntityRecords<Media>
    title="Media"
    queryKey={[...mediaApi.keys.all, 'of', entity.type, entity.id]}
    load={async (signal) => (await fetchAllRows(mediaApi.list, { project_id: entity.projectId }, { signal })).filter((m) => m.entity_id === entity.id && m.entity_type === entity.type)}
    columns={[
      { header: 'Media', cell: mediaName },
      { header: 'Type', cell: (m) => m.media_type || '—' },
      { header: 'Category', cell: (m) => m.category || '—' },
      { header: 'Format', cell: (m) => m.file_format || '—' },
      {
        header: 'Link',
        cell: (m) =>
          m.preview_url || m.source_url ? (
            <a href={m.preview_url || m.source_url} target="_blank" rel="noreferrer noopener" className="text-cyan-300 hover:underline">
              Open
            </a>
          ) : (
            '—'
          ),
      },
    ]}
    createTo={`/media/new?${prefill(entity)}`}
    createPermission="media.create"
    createLabel="Add media"
    empty={`No media on this ${entity.type.toLowerCase()} yet.`}
  />
);
