import { auditApi, auditKeys } from '@/api/audit/audit';
import type { ActivityEntry, ApiRequestLog, AuditLogEntry, BackgroundJob, ChangeLog, ErrorLog, TrackEvent } from '@/api/audit/audit';
import { ChangeDiff } from '@/components/history/EntityHistory';
import { Badge } from '@/shared/components/Badge';
import type { LogListConfig } from './LogListPage';

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—');
const who = (r: { user_name?: string; user_email?: string }) => r.user_name || r.user_email || '—';
const json = (value: unknown) => (
  <pre className="max-h-96 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-300 whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>
);
const sevVariant = (s: string) => (s === 'critical' || s === 'error' ? 'error' : s === 'warning' ? 'warning' : 'info');

export const changeLogsConfig: LogListConfig<ChangeLog> = {
  title: 'Change log',
  subtitle: 'Every create, update and delete of the tracked records, with who made it and the before/after values.',
  queryKey: [...auditKeys.all, 'change-logs'],
  fetchPage: auditApi.changeLogs.list,
  searchPlaceholder: 'Search record or description…',
  dateRange: true,
  filters: [
    { key: 'change_type', label: 'Change', options: [{ value: 'create', label: 'Create' }, { value: 'update', label: 'Update' }, { value: 'delete', label: 'Delete' }] },
    { key: 'target_type', label: 'Record type' },
  ],
  rowTitle: (r) => `${r.change_type} ${r.target_type} ${r.target_name}`,
  columns: [
    { header: 'When', cell: (r) => when(r.created_at) },
    { header: 'Change', cell: (r) => <Badge variant={r.change_type === 'create' ? 'success' : r.change_type === 'delete' ? 'error' : 'info'}>{r.change_type}</Badge> },
    { header: 'Record', cell: (r) => `${r.target_type}: ${r.target_name}` },
    { header: 'By', cell: who },
    { header: 'Fields', cell: (r) => r.changed_fields.join(', ') || '—' },
  ],
  detail: (r) => <ChangeDiff log={r} />,
  exportColumns: [
    { header: 'When', value: (r) => r.created_at },
    { header: 'Change', value: (r) => r.change_type },
    { header: 'Record type', value: (r) => r.target_type },
    { header: 'Record', value: (r) => r.target_name },
    { header: 'By', value: (r) => who(r) },
    { header: 'Fields', value: (r) => r.changed_fields.join(' ') },
  ],
};

export const auditLogsConfig: LogListConfig<AuditLogEntry> = {
  title: 'Audit log',
  subtitle: 'Business and security actions (approvals, deliveries, publishing, scheduling, masterdata events).',
  queryKey: [...auditKeys.all, 'audit-logs'],
  fetchPage: auditApi.auditLogs.list,
  searchPlaceholder: 'Search action, record, actor…',
  rowTitle: (r) => `${r.action} ${r.entity_type}`,
  columns: [
    { header: 'When', cell: (r) => when(r.created_at) },
    { header: 'Action', cell: (r) => <span className="font-mono">{r.action}</span> },
    { header: 'Record', cell: (r) => `${r.entity_type}${r.entity_code ? `: ${r.entity_code}` : ''}` },
    { header: 'By', cell: who },
    { header: 'Description', cell: (r) => <span className="line-clamp-1">{r.description}</span> },
  ],
  detail: (r) => json(r),
};

export const activityConfig: LogListConfig<ActivityEntry> = {
  title: 'Activity',
  subtitle: 'A feed of what people did.',
  queryKey: [...auditKeys.all, 'activity'],
  fetchPage: auditApi.activity.list,
  rowTitle: (r) => r.action,
  columns: [
    { header: 'When', cell: (r) => when(r.timestamp || r.created_at) },
    { header: 'Who', cell: (r) => r.actor_name || r.actor_email || '—' },
    { header: 'Action', cell: (r) => <span className="font-mono">{r.action}</span> },
    { header: 'Description', cell: (r) => <span className="line-clamp-1">{r.description}</span> },
  ],
  detail: (r) => json(r),
};

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m }));

export const apiRequestsConfig: LogListConfig<ApiRequestLog> = {
  title: 'API requests',
  subtitle: 'Requests the API served, with status and timing.',
  queryKey: [...auditKeys.all, 'api-requests'],
  fetchPage: auditApi.apiRequests.list,
  searchPlaceholder: 'Search path, method, user, IP…',
  dateRange: true,
  filters: [
    { key: 'method', label: 'Method', options: METHODS },
    { key: 'status_code', label: 'Status code' },
  ],
  rowTitle: (r) => `${r.method} ${r.path}`,
  columns: [
    { header: 'When', cell: (r) => when(r.created_at) },
    { header: 'Method', cell: (r) => <span className="font-mono">{r.method}</span> },
    { header: 'Path', cell: (r) => <span className="font-mono line-clamp-1">{r.path}</span> },
    { header: 'Status', cell: (r) => <Badge variant={r.status_code >= 500 ? 'error' : r.status_code >= 400 ? 'warning' : 'success'}>{r.status_code}</Badge> },
    { header: 'Time', cell: (r) => `${r.response_time_ms} ms` },
    { header: 'User', cell: who },
  ],
  detail: (r) => json(r),
  exportColumns: [
    { header: 'When', value: (r) => r.created_at },
    { header: 'Method', value: (r) => r.method },
    { header: 'Path', value: (r) => r.path },
    { header: 'Status', value: (r) => r.status_code },
    { header: 'Time (ms)', value: (r) => r.response_time_ms },
    { header: 'User', value: (r) => who(r) },
  ],
};

export const tracksConfig: LogListConfig<TrackEvent> = {
  title: 'Tracking events',
  subtitle: 'Interface events reported by the app.',
  queryKey: [...auditKeys.all, 'tracks'],
  fetchPage: auditApi.tracks.list,
  searchPlaceholder: 'Search event, page, session…',
  dateRange: true,
  filters: [{ key: 'event_type', label: 'Event type' }],
  rowTitle: (r) => `${r.event_type} ${r.event_name}`,
  columns: [
    { header: 'When', cell: (r) => when(r.created_at) },
    { header: 'Type', cell: (r) => r.event_type },
    { header: 'Event', cell: (r) => r.event_name },
    { header: 'Page', cell: (r) => <span className="line-clamp-1">{r.page_title || r.page_url}</span> },
    { header: 'User', cell: who },
  ],
  detail: (r) => json(r),
};

const jobStatuses = ['queued', 'running', 'completed', 'failed', 'cancelled'].map((s) => ({ value: s, label: s }));

export const backgroundJobsConfig: LogListConfig<BackgroundJob> = {
  title: 'Background jobs',
  subtitle: 'Queued and finished jobs. Cancelling or retrying needs audit.update.',
  queryKey: [...auditKeys.all, 'background-jobs'],
  fetchPage: auditApi.backgroundJobs.list,
  searchPlaceholder: 'Search job, type, worker…',
  dateRange: true,
  filters: [
    { key: 'status', label: 'Status', options: jobStatuses },
    { key: 'job_type', label: 'Job type' },
  ],
  rowTitle: (r) => `${r.job_type} ${r.job_id}`,
  columns: [
    { header: 'Created', cell: (r) => when(r.created_at) },
    { header: 'Type', cell: (r) => r.job_type },
    { header: 'Status', cell: (r) => <Badge variant={r.status === 'failed' ? 'error' : r.status === 'completed' ? 'success' : r.status === 'cancelled' ? 'neutral' : 'info'}>{r.status}</Badge> },
    { header: 'Progress', cell: (r) => `${r.progress}%` },
    { header: 'Worker', cell: (r) => r.worker_id || '—' },
  ],
  detail: (r) => json(r),
  actions: [
    { label: 'Cancel job', when: (r) => r.status === 'queued' || r.status === 'running', confirm: (r) => `Cancel job ${r.job_id}?`, run: (r) => auditApi.backgroundJobs.cancel(r.id) },
    { label: 'Retry', when: (r) => r.status === 'failed', confirm: (r) => `Run job ${r.job_id} again?`, run: (r) => auditApi.backgroundJobs.retry(r.id) },
  ],
};

export const errorLogsConfig: LogListConfig<ErrorLog> = {
  title: 'Error log',
  subtitle: 'Errors the system recorded. Resolving needs audit.update.',
  queryKey: [...auditKeys.all, 'error-logs'],
  fetchPage: auditApi.errorLogs.list,
  searchPlaceholder: 'Search message, type, code, path…',
  dateRange: true,
  filters: [
    { key: 'severity', label: 'Severity', options: ['info', 'warning', 'error', 'critical'].map((s) => ({ value: s, label: s })) },
    { key: 'error_type', label: 'Error type' },
  ],
  rowTitle: (r) => `${r.error_type}: ${r.message.slice(0, 40)}`,
  columns: [
    { header: 'When', cell: (r) => when(r.created_at) },
    { header: 'Severity', cell: (r) => <Badge variant={sevVariant(r.severity)}>{r.severity}</Badge> },
    { header: 'Type', cell: (r) => r.error_type },
    { header: 'Message', cell: (r) => <span className="line-clamp-1">{r.message}</span> },
    { header: 'Resolved', cell: (r) => (r.resolved ? <Badge variant="success">Resolved</Badge> : <Badge variant="warning">Open</Badge>) },
  ],
  detail: (r) => json(r),
  actions: [{ label: 'Resolve', when: (r) => !r.resolved, confirm: () => 'Mark this error as resolved?', run: (r) => auditApi.errorLogs.resolve(r.id) }],
};
