import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { episodesApi, projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import type { Episode, Project, Sequence } from '@/api/production/structure';
import { assetsApi, shotsApi, tasksApi } from '@/api/production/work';
import type { Asset, Shot, Task } from '@/api/production/work';
import { EntityPicker } from '@/components/forms/EntityPicker';
import { listFetcher } from '@/shared/data/listing';
import type { PickerProps } from '@/modules/directory/pickers';

/** Task and asset types come from the catalog (bare arrays, no trailing slash). */
const taskTypes = listFetcher<{ id: string; code: string; name: string }>('/api/v1/platform/master-data/task-types');
const assetTypes = listFetcher<{ id: string; code: string; name: string }>('/api/v1/platform/master-data/asset-types');

export const ProjectPicker: React.FC<PickerProps> = ({ label = 'Project', ...p }) => (
  <EntityPicker<Project> label={label} queryKey={projectsApi.keys.all} fetchPage={projectsApi.list} fetchOne={projectsApi.get} getLabel={(x) => `${x.code} · ${x.name}`} {...p} />
);
export const EpisodePicker: React.FC<PickerProps> = ({ label = 'Episode', ...p }) => (
  <EntityPicker<Episode> label={label} queryKey={episodesApi.keys.all} fetchPage={episodesApi.list} fetchOne={episodesApi.get} getLabel={(x) => `${x.code}${x.name ? ` · ${x.name}` : ''}`} {...p} />
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

export const AssetTypePicker: React.FC<PickerProps> = ({ label = 'Asset type', ...p }) => (
  <EntityPicker<{ id: string; code: string; name: string }> label={label} queryKey={['catalog', 'asset-types']} fetchPage={assetTypes} getLabel={(x) => x.name} {...p} />
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

/** A client or vendor as the project names it. */
export interface ProjectPartner {
  id: string;
  name: string;
}

/**
 * The project's client and vendors (CR-60), read from the project record: a delivery, a task or a member of the
 * project may name only these. `vendor_names` skips a vendor deleted since; then the names cannot be paired with the
 * ids, and each vendor shows by its id.
 */
export function useProjectPartners(projectId: string | undefined) {
  const project = useQuery({
    queryKey: projectsApi.keys.detail(projectId ?? ''),
    queryFn: ({ signal }) => projectsApi.get(projectId as string, signal),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });
  const row = project.data;
  const client: ProjectPartner | null = row?.client_id ? { id: row.client_id, name: row.client_name || 'The project’s client' } : null;
  const ids = row?.vendor_ids ?? [];
  const names = row?.vendor_names ?? [];
  const vendors: ProjectPartner[] = ids.map((id, index) => ({ id, name: ids.length === names.length ? names[index] : `Vendor ${id.slice(0, 8)}` }));
  return { client, vendors, loaded: Boolean(row) };
}

interface PartnerSelectProps {
  projectId: string | undefined;
  value: string;
  onChange: (id: string) => void;
  error?: string;
}

const selectClass = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 disabled:opacity-50';

const SetOnProject: React.FC<{ projectId: string; what: string }> = ({ projectId, what }) => (
  <p className="text-[11px] text-amber-300">
    {what}{' '}
    <Link to={`/projects/${projectId}/edit`} className="underline hover:text-amber-200">
      Edit the project
    </Link>
  </p>
);

/**
 * A delivery's client (CR-60): only the project's client can be chosen, and it is filled in when a project is picked.
 * A project with no client offers none.
 */
export const ProjectClientSelect: React.FC<PartnerSelectProps> = ({ projectId, value, onChange, error }) => {
  const { client, loaded } = useProjectPartners(projectId);
  const filledFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!projectId || !loaded || filledFor.current === projectId) return;
    filledFor.current = projectId;
    onChange(client?.id ?? '');
  }, [projectId, loaded, client?.id, onChange]);
  return (
    <div className="space-y-1">
      <label htmlFor="project-client" className="block text-xs font-mono text-slate-400">
        Client
      </label>
      <select id="project-client" value={value} disabled={!projectId || !client} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">{!projectId ? 'Choose a project first' : client ? '— No client —' : 'The project has no client'}</option>
        {client && <option value={client.id}>{client.name}</option>}
      </select>
      {projectId && loaded && !client && <SetOnProject projectId={projectId} what="Set the project’s client first." />}
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
};

/** A task's vendor (CR-60): one of the project's vendors, or none. A vendor that has left the project stays shown as it is. */
export const ProjectVendorSelect: React.FC<PartnerSelectProps> = ({ projectId, value, onChange, error }) => {
  const { vendors, loaded } = useProjectPartners(projectId);
  const stale = Boolean(value) && loaded && !vendors.some((v) => v.id.toLowerCase() === value.toLowerCase());
  return (
    <div className="space-y-1">
      <label htmlFor="project-vendor" className="block text-xs font-mono text-slate-400">
        Vendor
      </label>
      <select id="project-vendor" value={value} disabled={!projectId} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">{projectId ? '— In house —' : 'Choose a project first'}</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
        {stale && <option value={value}>A vendor no longer on the project</option>}
      </select>
      {projectId && loaded && vendors.length === 0 && <SetOnProject projectId={projectId} what="This project has no vendors." />}
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
};
