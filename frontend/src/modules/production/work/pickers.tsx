import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import type { Project, Sequence } from '@/api/production/structure';
import { assetsApi, shotsApi, tasksApi } from '@/api/production/work';
import type { Asset, Shot, Task } from '@/api/production/work';
import { EntityPicker } from '@/components/forms/EntityPicker';
import { listFetcher } from '@/shared/data/listing';
import type { PickerProps } from '@/modules/directory/pickers';

/** Task types come from the catalog (a bare array, no trailing slash). */
const taskTypes = listFetcher<{ id: string; code: string; name: string }>('/api/v1/platform/master-data/task-types');

export const ProjectPicker: React.FC<PickerProps> = ({ label = 'Project', ...p }) => (
  <EntityPicker<Project> label={label} queryKey={projectsApi.keys.all} fetchPage={projectsApi.list} fetchOne={projectsApi.get} getLabel={(x) => `${x.code} · ${x.name}`} {...p} />
);
export const SequencePicker: React.FC<PickerProps> = ({ label = 'Sequence', ...p }) => (
  <EntityPicker<Sequence> label={label} queryKey={sequencesApi.keys.all} fetchPage={sequencesApi.list} fetchOne={sequencesApi.get} getLabel={(x) => `${x.code}${x.name ? ` · ${x.name}` : ''}`} {...p} />
);
export const ShotPicker: React.FC<PickerProps> = ({ label = 'Shot', ...p }) => (
  <EntityPicker<Shot> label={label} queryKey={shotsApi.keys.all} fetchPage={shotsApi.list} fetchOne={shotsApi.get} getLabel={(x) => `${x.code}${x.name ? ` · ${x.name}` : ''}`} {...p} />
);
export const AssetPicker: React.FC<PickerProps> = ({ label = 'Asset', ...p }) => (
  <EntityPicker<Asset> label={label} queryKey={assetsApi.keys.all} fetchPage={assetsApi.list} fetchOne={assetsApi.get} getLabel={(x) => `${x.code} · ${x.name}`} {...p} />
);
export const TaskPicker: React.FC<PickerProps> = ({ label = 'Task', ...p }) => (
  <EntityPicker<Task> label={label} queryKey={tasksApi.keys.all} fetchPage={tasksApi.list} fetchOne={tasksApi.get} getLabel={(x) => `${x.code} · ${x.title}`} {...p} />
);
export const TaskTypePicker: React.FC<PickerProps> = ({ label = 'Task type', ...p }) => (
  <EntityPicker<{ id: string; code: string; name: string }> label={label} queryKey={['catalog', 'task-types']} fetchPage={taskTypes} getLabel={(x) => x.name} {...p} />
);

export interface MemberSelectProps {
  projectId: string | undefined;
  value: string;
  onChange: (userId: string) => void;
  label: string;
  error?: string;
  required?: boolean;
}

/**
 * Assignees and reviewers must be members of the task's project (the server answers 400 "Unknown user."
 * otherwise), so they are picked from the project's members and the value is the member's USER id.
 */
export const MemberSelect: React.FC<MemberSelectProps> = ({ projectId, value, onChange, label, error, required }) => {
  const members = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: ({ signal }) => projectScopedApi.members(projectId as string, signal),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });
  const id = `member-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-mono text-slate-400">
        {label}
        {required ? ' *' : ''}
      </label>
      <select id={id} value={value} disabled={!projectId} onChange={(e) => onChange(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 disabled:opacity-50">
        <option value="">{projectId ? '— Unassigned —' : 'Choose a project first'}</option>
        {(members.data?.results ?? []).map((m) => (
          <option key={m.id} value={m.user_id}>
            {m.name || m.email} ({m.role})
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
};
