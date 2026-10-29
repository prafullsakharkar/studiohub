import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '@/api/production/structure';
import { TASK_ENTITY_TYPES, TASK_PRIORITIES, TASK_STATUSES, tasksApi } from '@/api/production/work';
import type { Task } from '@/api/production/work';
import { AuthContext } from '@/core/auth/AuthContext';
import { useCan } from '@/core/permissions/useCan';
import type { BulkAction, DirectoryFormConfig, DirectoryListConfig, FieldDef } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';
import { useTimerStore } from '@/shared/stores/useTimerStore';
import { useContext } from 'react';
import { LogTimeDialog } from './LogTimeDialog';
import { StatusMenu } from './StatusMenu';
import { formatHours } from './format';
import { AssetPicker, MemberSelect, ProjectPicker, SequencePicker, ShotPicker, TaskTypePicker } from './pickers';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));

/** Log time on a task, or run the stopwatch. Both need `timelog.create`. */
export const TaskTimeCell: React.FC<{ task: Task }> = ({ task }) => {
  const canLog = useCan('timelog.create');
  const [open, setOpen] = useState(false);
  const { activeTaskId, startTimer } = useTimerStore();
  if (!canLog || task.is_archived) return <span className="text-slate-600">—</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <button type="button" className="text-cyan-300 hover:underline" aria-label={`Log time on ${task.code}`} onClick={() => setOpen(true)}>
        Log time
      </button>
      {activeTaskId === task.id ? (
        <Badge variant="success">Timer running</Badge>
      ) : (
        <button
          type="button"
          className="text-slate-400 hover:text-slate-200"
          aria-label={`Start timer on ${task.code}`}
          onClick={() => startTimer({ id: task.id, code: task.code, title: task.title, project_id: task.project_id, project_code: task.project_code, project_name: task.project_name, department: task.department })}
        >
          Start timer
        </button>
      )}
      {open && <LogTimeDialog isOpen onClose={() => setOpen(false)} task={task} />}
    </span>
  );
};

export function useTasksListConfig(scope?: { projectId: string }): DirectoryListConfig<Task> {
  const me = useContext(AuthContext)?.user?.id ?? '';
  const canUpdate = useCan('task.update');
  return {
    title: 'Tasks',
    noun: 'task',
    subtitle: 'Work items on shots, assets and sequences. Change status from the list; log time on a task you work on.',
    queryKey: tasksApi.keys.lists(),
    fetchPage: tasksApi.list,
    // Archiving is task.update, deleting is task.delete: the list archives, so artists can too.
    remove: tasksApi.archive,
    deleteLabel: 'Archive',
    deletePermission: 'task.update',
    createPermission: 'task.create',
    managePermission: 'task.update',
    archived: { fetchPage: tasksApi.archived, restore: tasksApi.restoreOne },
    rowName: (row) => row.code,
    defaultOrdering: '-created_at',
    searchPlaceholder: 'Search title, code, description',
    basePath: '/tasks',
    scope: scope ? { project_id: scope.projectId } : undefined,
    createQuery: scope ? `project=${scope.projectId}` : undefined,
    filters: [
      { key: 'project_id', label: 'Project', optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: { code: string }) => p.code) as never } },
      { key: 'status', label: 'Status', options: options(TASK_STATUSES.filter((s) => s !== 'Archived')) },
      { key: 'priority', label: 'Priority', options: options(TASK_PRIORITIES) },
      { key: 'entity_type', label: 'Type', options: options(TASK_ENTITY_TYPES) },
      ...(me ? [{ key: 'assignee_id', label: 'Assignee', options: [{ value: me, label: 'Me' }] }] : []),
    ],
    columns: [
      { header: 'Task', cell: (row) => `${row.code} · ${row.title}`, sortField: 'code' },
      { header: 'For', cell: (row) => (row.entity_type === 'General' ? 'General' : `${row.entity_type} ${row.entity_code}`) },
      { header: 'Assignee', cell: (row) => row.assignee_name || '—' },
      { header: 'Priority', cell: (row) => row.priority, sortField: 'priority' },
      { header: 'Due', cell: (row) => row.due_date ?? '—', sortField: 'due_date' },
      { header: 'Hours', cell: (row) => `${formatHours(row.logged_hours)} / ${formatHours(row.estimated_hours)}` },
      {
        header: 'Status',
        sortField: 'status',
        cell: (row) => <StatusMenu entity="task" status={row.status} name={row.code} canChange={canUpdate && !row.is_archived} change={(next) => tasksApi.update(row.id, { status: next })} invalidate={[tasksApi.keys.all]} />,
      },
      { header: 'Time', cell: (row) => <TaskTimeCell task={row} /> },
    ],
    exportColumns: [
      { header: 'Code', value: (r) => r.code },
      { header: 'Title', value: (r) => r.title },
      { header: 'Project', value: (r) => r.project_code },
      { header: 'Entity', value: (r) => `${r.entity_type} ${r.entity_code}`.trim() },
      { header: 'Assignee', value: (r) => r.assignee_name },
      { header: 'Priority', value: (r) => r.priority },
      { header: 'Status', value: (r) => r.status },
      { header: 'Due', value: (r) => r.due_date },
      { header: 'Estimated hours', value: (r) => r.estimated_hours },
      { header: 'Logged hours', value: (r) => r.logged_hours },
    ],
    bulk: { actions: bulkTaskActions() },
  };
}

function bulkTaskActions(): ReadonlyArray<BulkAction> {
  return [
    {
      label: 'Set status',
      confirm: (n) => `Move ${n} task${n === 1 ? '' : 's'} to the chosen status. Moves the workflow does not allow are refused one by one.`,
      input: {
        label: 'Status',
        required: true,
        render: ({ value, onChange }) => (
          <select aria-label="Status" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200">
            <option value="">Choose…</option>
            {TASK_STATUSES.filter((s) => s !== 'Archived').map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ),
      },
      run: async (ids, status) => {
        const result = await tasksApi.bulkStatus(ids, status as string);
        return result.failed_count === 0 ? `${result.updated_count} updated.` : `${result.updated_count} updated, ${result.failed_count} refused (${[...new Set(result.results.filter((r) => !r.ok).map((r) => r.error))].join(', ')}).`;
      },
    },
    {
      label: 'Assign',
      // Each assignee must belong to the task's project, so members can only be offered for one project.
      available: (filters) => Boolean(filters.project_id),
      confirm: (n) => `Assign ${n} task${n === 1 ? '' : 's'} to a member of the project.`,
      input: { label: 'Assignee', required: true, render: ({ value, onChange, filters }) => <MemberSelect projectId={String(filters.project_id)} value={value} onChange={onChange} label="Assignee" /> },
      run: async (ids, assignee) => {
        const result = await tasksApi.bulkAssign(ids, { assignee_id: assignee });
        return `${result.updated_count} assigned.`;
      },
    },
    {
      label: 'Archive',
      destructive: true,
      confirm: (n) => `Archive ${n} task${n === 1 ? '' : 's'}? They move to the Archived view and can be restored.`,
      run: async (ids) => {
        const result = await tasksApi.bulkArchive(ids);
        return `${result.successful ?? result.processed - result.failed} archived${result.failed ? `, ${result.failed} failed` : ''}.`;
      },
    },
  ];
}

/** The shot, asset or sequence a task is about; the id is cleared when the type changes. */
const TaskLinkField: React.FC<{ type: string; project: string; value: string; onChange: (id: string) => void; error?: string }> = ({ type, project, value, onChange, error }) => {
  const previous = useRef(type);
  useEffect(() => {
    if (previous.current !== type) {
      previous.current = type;
      onChange('');
    }
  }, [type, onChange]);
  const Picker = type === 'Shot' ? ShotPicker : type === 'Asset' ? AssetPicker : SequencePicker;
  return <Picker label={`${type} *`} value={value} onChange={(id) => onChange(id ?? '')} filters={type === 'Sequence' ? { project } : { project_id: project }} disabled={!project} error={error} />;
};

export const tasksFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project', rowKey: 'project_id', label: 'Project', required: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 50 },
  { kind: 'text', name: 'title', label: 'Title', required: true, maxLength: 255 },
  // A task is linked with entity_type + entity_id; `shot_id` is read-only and would be dropped by the server.
  { kind: 'select', name: 'entity_type', label: 'About', options: options(TASK_ENTITY_TYPES), initial: 'General' },
  {
    kind: 'entity',
    name: 'entity_id',
    label: 'Linked record',
    required: true,
    visibleWhen: (v) => v.entity_type !== 'General' && v.entity_type !== '',
    render: (p) => <TaskLinkField type={String(p.values.entity_type)} project={String(p.values.project ?? '')} value={p.value} onChange={p.onChange} error={p.error} />,
  },
  { kind: 'entity', name: 'task_type_id', rowKey: 'task_type_id', label: 'Task type', render: (p) => <TaskTypePicker label="Task type" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'entity', name: 'assignee', rowKey: 'assignee_id', label: 'Assignee', render: (p) => <MemberSelect projectId={String(p.values.project ?? '') || undefined} value={p.value} onChange={p.onChange} label="Assignee" error={p.error} /> },
  { kind: 'entity', name: 'reviewer', rowKey: 'reviewer_id', label: 'Reviewer', render: (p) => <MemberSelect projectId={String(p.values.project ?? '') || undefined} value={p.value} onChange={p.onChange} label="Reviewer" error={p.error} /> },
  { kind: 'select', name: 'priority', label: 'Priority', options: options(TASK_PRIORITIES), initial: 'Medium' },
  { kind: 'date', name: 'due_date', label: 'Due date' },
  { kind: 'number', name: 'estimated_hours', label: 'Estimated hours' },
  { kind: 'textarea', name: 'description', label: 'Description' },
];

export const tasksFormConfig: DirectoryFormConfig<Task> = {
  noun: 'task',
  basePath: '/tasks',
  queryKey: tasksApi.keys.lists(),
  fields: tasksFormFields,
  get: tasksApi.get,
  create: (input) => tasksApi.create(input as never),
  update: (id, patch) => tasksApi.update(id, patch as never),
  // The update serializer has no `project`: a task stays in the project it was created in.
  immutableOnEdit: ['project'],
};

export const TaskLink: React.FC<{ task: Pick<Task, 'entity_type' | 'entity_id' | 'entity_code' | 'project_id'> }> = ({ task }) => {
  if (task.entity_type === 'General' || !task.entity_id) return <>General</>;
  const path = task.entity_type === 'Shot' ? `/shots/${task.entity_id}` : task.entity_type === 'Asset' ? `/assets/${task.entity_id}` : null;
  return path ? (
    <Link to={path} className="text-cyan-300 hover:underline">
      {task.entity_type} {task.entity_code}
    </Link>
  ) : (
    <>
      {task.entity_type} {task.entity_code}
    </>
  );
};
