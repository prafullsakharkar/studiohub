import { useContext } from 'react';
import { timelogsApi } from '@/api/production/work';
import type { Timelog } from '@/api/production/work';
import { AuthContext } from '@/core/auth/AuthContext';
import { useCan } from '@/core/permissions/useCan';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef, RowAction } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';
import { formatHours, todayIso, toHours } from './format';
import { TaskPicker } from './pickers';

const statusVariant = (status: string) => (status === 'Approved' ? 'success' : status === 'Rejected' ? 'destructive' : 'outline');

/**
 * Time logged against tasks. An artist sees only their own logs; a holder of `timelog.view_all` (leads,
 * supervisors) sees the whole project's and approves them, except their own (the server refuses that).
 */
export function useTimelogsListConfig(scope?: { projectId: string }): DirectoryListConfig<Timelog> {
  const me = useContext(AuthContext)?.user?.id ?? '';
  const canApprove = useCan('timelog.approve');
  const canViewAll = useCan('timelog.view_all');
  return {
    title: 'Time logs',
    noun: 'time log',
    subtitle: canViewAll ? 'Time logged on tasks. Submitted entries wait here for approval.' : 'Your time logs. A lead approves them once submitted.',
    queryKey: timelogsApi.keys.lists(),
    fetchPage: timelogsApi.list,
    remove: timelogsApi.remove,
    rowName: (row) => `${row.task_code} ${row.date}`,
    defaultOrdering: '-date',
    searchPlaceholder: 'Search notes',
    basePath: '/timelogs',
    scope: scope ? { project_id: scope.projectId } : undefined,
    rowLink: (row) => `/tasks/${row.task_id}`,
    managePermission: 'timelog.create',
    deletePermission: 'timelog.delete',
    // An approved log is final (409): offer neither edit nor delete. A rejected one is edited and resubmitted.
    canEdit: (row) => row.status !== 'Approved',
    canRemove: (row) => row.status !== 'Approved',
    filters: [
      { key: 'status', label: 'Status', options: ['Submitted', 'Approved', 'Rejected', 'Draft'].map((value) => ({ value, label: value })) },
      ...(canViewAll && me ? [{ key: 'person', label: 'Person', options: [{ value: me, label: 'Me' }] }] : []),
      { key: 'billable', label: 'Billing', options: [{ value: 'true', label: 'Billable' }, { value: 'false', label: 'Non-billable' }] },
    ],
    columns: [
      { header: 'Task', cell: (row) => `${row.task_code} · ${row.task_title}` },
      ...(canViewAll ? [{ header: 'Person', cell: (row: Timelog) => row.person_name || '—' }] : []),
      { header: 'Date', cell: (row) => row.date, sortField: 'date' },
      { header: 'Hours', cell: (row) => formatHours(row.duration_hours), sortField: 'duration_hours' },
      {
        header: 'Status',
        cell: (row) => (
          <span className="inline-flex flex-col gap-0.5">
            <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
            {row.status === 'Rejected' && row.rejection_reason && <span className="text-[11px] text-rose-300">{row.rejection_reason}</span>}
          </span>
        ),
      },
      { header: 'Notes', cell: (row) => row.notes || '—' },
    ],
    exportColumns: [
      { header: 'Task', value: (r) => r.task_code },
      { header: 'Person', value: (r) => r.person_name },
      { header: 'Date', value: (r) => r.date },
      { header: 'Hours', value: (r) => toHours(r.duration_hours) },
      { header: 'Billable', value: (r) => r.billable },
      { header: 'Status', value: (r) => r.status },
    ],
    rowActions: (row): RowAction[] => {
      const actions: RowAction[] = [];
      if (canApprove && row.status === 'Submitted' && row.person_id !== me) {
        actions.push({ label: 'Approve', confirm: `Approve ${formatHours(row.duration_hours)} logged by ${row.person_name || 'this person'} on ${row.task_code}?`, run: () => timelogsApi.approve(row.id) });
        actions.push({ label: 'Reject', destructive: true, confirm: `Reject ${formatHours(row.duration_hours)} on ${row.task_code}? The person sees the reason and can resubmit.`, askText: { label: 'Reason', required: true }, run: (_date, reason) => timelogsApi.reject(row.id, reason as string) });
      }
      if (row.status === 'Rejected' && row.person_id === me) {
        actions.push({ label: 'Resubmit', confirm: `Send ${formatHours(row.duration_hours)} on ${row.task_code} for approval again?`, run: () => timelogsApi.update(row.id, { status: 'Submitted' }) });
      }
      return actions;
    },
  };
}

export function timelogsFormFields(): ReadonlyArray<FieldDef> {
  return [
    { kind: 'entity', name: 'task_id', label: 'Task', required: true, render: (p) => <TaskPicker label="Task *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
    { kind: 'date', name: 'date', label: 'Date', required: true, initial: todayIso() },
    // The server refuses non-positive hours on an ordinary entry (CR-14); the form says so before sending.
    { kind: 'number', name: 'duration_hours', label: 'Hours', required: true, positive: true, hint: 'Greater than zero. Correct an approved entry with an adjustment, not a negative entry.' },
    { kind: 'textarea', name: 'notes', label: 'Notes' },
    { kind: 'checkbox', name: 'billable', label: 'Billable', initial: true },
  ];
}

export const timelogsFormConfig: DirectoryFormConfig<Timelog> = {
  noun: 'time log',
  basePath: '/timelogs',
  queryKey: timelogsApi.keys.lists(),
  fields: timelogsFormFields(),
  get: timelogsApi.get,
  create: (input) => timelogsApi.create(input as never),
  update: (id, patch) => timelogsApi.update(id, patch as never),
  // The task cannot change (the update serializer has no `task`): log the time again on the right task.
  immutableOnEdit: ['task_id'],
  afterSavePath: () => '/timelogs',
};
