import { useEffect, useRef } from 'react';
import type React from 'react';
import { REVIEW_STATUSES, reviewsApi } from '@/api/production/review';
import type { Review } from '@/api/production/review';
import { projectsApi } from '@/api/production/structure';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';
import { AssetPicker, ProjectPicker, ShotPicker } from '@/modules/production/work/pickers';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));

export const reviewStatusVariant = (status: string) => (status === 'Approved' ? 'success' : status === 'Rejected' || status === 'Retake' ? 'destructive' : status === 'Closed' ? 'neutral' : 'outline');

export function useReviewsListConfig(scope?: { projectId: string }): DirectoryListConfig<Review> {
  return {
    title: 'Reviews',
    noun: 'review',
    subtitle: 'Review sessions on shots and assets. A supervisor decides; whoever submitted a review cannot approve it.',
    queryKey: reviewsApi.keys.lists(),
    fetchPage: reviewsApi.list,
    // `archive` is unmapped on reviews (CR-15): DELETE archives.
    remove: reviewsApi.remove,
    deleteLabel: 'Archive',
    deletePermission: 'review.delete',
    createPermission: 'review.create',
    managePermission: 'review.update',
    archived: { fetchPage: reviewsApi.archived, restore: reviewsApi.restoreOne },
    rowName: (row) => row.code,
    defaultOrdering: '-created_at',
    searchPlaceholder: 'Search title, code',
    basePath: '/reviews',
    scope: scope ? { project_id: scope.projectId } : undefined,
    createQuery: scope ? `project=${scope.projectId}` : undefined,
    filters: [
      { key: 'project_id', label: 'Project', optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: { code: string }) => p.code) as never } },
      { key: 'status', label: 'Status', options: options(REVIEW_STATUSES) },
      { key: 'entity_type', label: 'For', options: options(['Shot', 'Asset']) },
    ],
    columns: [
      { header: 'Review', cell: (row) => `${row.code} · ${row.title}`, sortField: 'created_at' },
      { header: 'For', cell: (row) => `${row.entity_type} ${row.entity_code}`.trim() || '—' },
      { header: 'Versions', cell: (row) => row.versions.length },
      { header: 'People', cell: (row) => row.reviewers.length },
      { header: 'Status', sortField: 'status', cell: (row) => <Badge variant={reviewStatusVariant(row.status)}>{row.status}</Badge> },
    ],
  };
}

/** The shot or asset a review is about; the id is cleared when the type changes. */
export const ReviewTargetField: React.FC<{ type: string; project: string; value: string; onChange: (id: string) => void; error?: string }> = ({ type, project, value, onChange, error }) => {
  const previous = useRef(type);
  useEffect(() => {
    if (previous.current !== type) {
      previous.current = type;
      onChange('');
    }
  }, [type, onChange]);
  const Picker = type === 'Asset' ? AssetPicker : ShotPicker;
  return <Picker label={type || 'Shot'} value={value} onChange={(id) => onChange(id ?? '')} filters={{ project_id: project }} disabled={!project} error={error} />;
};

export const reviewsFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project', rowKey: 'project_id', label: 'Project', required: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 50 },
  { kind: 'text', name: 'title', label: 'Title', required: true, maxLength: 255 },
  { kind: 'select', name: 'entity_type', label: 'About', options: options(['Shot', 'Asset']), initial: 'Shot' },
  { kind: 'entity', name: 'entity_id', label: 'Shot or asset', render: (p) => <ReviewTargetField type={String(p.values.entity_type || 'Shot')} project={String(p.values.project ?? '')} value={p.value} onChange={p.onChange} error={p.error} /> },
  { kind: 'textarea', name: 'description', label: 'Description' },
];

// The form never sends `status`: a new review starts Pending Review and moves by the actions (the server accepts any text on create, CR-16).
export const reviewsFormConfig: DirectoryFormConfig<Review> = {
  noun: 'review',
  basePath: '/reviews',
  queryKey: reviewsApi.keys.lists(),
  fields: reviewsFormFields,
  get: reviewsApi.get,
  create: (input) => reviewsApi.create(input as never),
  update: (id, patch) => reviewsApi.update(id, patch as never),
  immutableOnEdit: ['project'],
};
