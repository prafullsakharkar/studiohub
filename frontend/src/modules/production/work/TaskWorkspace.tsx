import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tasksApi, timelogsApi } from '@/api/production/work';
import type { Task } from '@/api/production/work';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { EntityHistory } from '@/components/history/EntityHistory';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { usePaginatedList } from '@/shared/data/usePaginatedList';
import { StatusHistory } from './StatusHistory';
import { StatusMenu } from './StatusMenu';
import { TaskLink, TaskTimeCell } from './tasks';
import { formatHours } from './format';

type TabId = 'time' | 'status' | 'history';
const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'time', label: 'Time' },
  { id: 'status', label: 'Status history' },
  { id: 'history', label: 'Changes' },
];

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-sm text-slate-200">{children}</dd>
  </div>
);

/** The time logged on this task, with each entry's state; approving is done from Time logs. */
const TaskTime: React.FC<{ taskId: string }> = ({ taskId }) => {
  const list = usePaginatedList({ queryKey: [...timelogsApi.keys.lists(), 'task', taskId], fetchPage: timelogsApi.list, filters: { task: taskId }, ordering: '-date' });
  return (
    <QueryBoundary isLoading={list.isLoading} error={list.rows.length === 0 ? list.error : null} onRetry={() => void list.refetch()} entityName="time logs" isEmpty={list.rows.length === 0} empty={{ title: 'No time logged', description: 'Time logged on this task shows here. You see your own entries; leads see everyone’s.' }}>
      <table aria-label="Time logged on this task" className="w-full text-xs">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="py-1 pr-3">Date</th>
            <th className="py-1 pr-3">Person</th>
            <th className="py-1 pr-3">Hours</th>
            <th className="py-1 pr-3">Status</th>
            <th className="py-1">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {list.rows.map((log) => (
            <tr key={log.id}>
              <td className="py-1.5 pr-3">{log.date}</td>
              <td className="py-1.5 pr-3">{log.person_name || '—'}</td>
              <td className="py-1.5 pr-3">{formatHours(log.duration_hours)}</td>
              <td className="py-1.5 pr-3">
                <Badge variant={log.status === 'Approved' ? 'success' : log.status === 'Rejected' ? 'destructive' : 'outline'}>{log.status}</Badge>
                {log.status === 'Rejected' && log.rejection_reason && <span className="ml-2 text-rose-300">{log.rejection_reason}</span>}
              </td>
              <td className="py-1.5">{log.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </QueryBoundary>
  );
};

export const TaskWorkspace: React.FC = () => {
  const { taskId = '' } = useParams();
  const canUpdate = useCan('task.update');
  const [tab, setTab] = useState<TabId>('time');
  const task = useQuery({ queryKey: tasksApi.keys.detail(taskId), queryFn: ({ signal }) => tasksApi.get(taskId, signal), enabled: Boolean(taskId) });
  const row = task.data as Task | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <QueryBoundary isLoading={task.isLoading} error={task.error} onRetry={() => void task.refetch()} entityName="task">
        {row && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <Link to="/tasks" className="text-[11px] text-slate-500 hover:text-slate-300">
                  ← Tasks
                </Link>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {row.code} · {row.title}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {row.project_code} · <TaskLink task={row} />
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusMenu entity="task" status={row.status} name={row.code} canChange={canUpdate && !row.is_archived} change={(next) => tasksApi.update(row.id, { status: next })} invalidate={[tasksApi.keys.all]} />
                <TaskTimeCell task={row} />
                {canUpdate && !row.is_archived && (
                  <Link to={`/tasks/${row.id}/edit`}>
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Fact label="Priority">{row.priority}</Fact>
              <Fact label="Assignee">{row.assignee_name || '—'}</Fact>
              <Fact label="Reviewer">{row.reviewer_name || '—'}</Fact>
              <Fact label="Task type">{row.task_type_name || '—'}</Fact>
              <Fact label="Due">{row.due_date ?? '—'}</Fact>
              <Fact label="Estimated">{formatHours(row.estimated_hours)}</Fact>
              <Fact label="Logged (approved)">{formatHours(row.logged_hours)}</Fact>
              <Fact label="Awaiting approval">{formatHours(row.pending_hours)}</Fact>
            </dl>
            {row.description && <p className="text-sm text-slate-300 whitespace-pre-wrap">{row.description}</p>}

            <div role="tablist" aria-label="Task sections" className="flex gap-1 border-b border-slate-800">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 text-xs font-semibold ${tab === t.id ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'time' && <TaskTime taskId={row.id} />}
            {tab === 'status' && <StatusHistory queryKey={[...tasksApi.keys.detail(row.id), 'status-history']} fetch={(signal) => tasksApi.statusHistory(row.id, signal)} />}
            {tab === 'history' && <EntityHistory targetType="Task" targetId={row.id} />}
          </>
        )}
      </QueryBoundary>
    </div>
  );
};
