import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { isAllowedMove } from '@/api/production/statusFlow';
import { tasksApi } from '@/api/production/work';
import type { Task } from '@/api/production/work';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { AuthContext } from '@/core/auth/AuthContext';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { StatusMenu } from './StatusMenu';
import { TaskTimeCell } from './tasks';
import { ProjectPicker } from './pickers';
import { formatHours } from './format';

/** One column per status a task can rest in; Archived is an action, not a column. */
export const BOARD_COLUMNS = ['Not Started', 'In Progress', 'Pending Review', 'Retake', 'Approved'] as const;
/** A board shows one page of the matching tasks (the list is for everything). */
const BOARD_LIMIT = 500;

/**
 * Tasks as columns by status. A card moves by drag and drop or by its status menu, and only to columns the backend
 * allows from where it is (`statusFlow.ts`); the server still decides, and its refusal is shown.
 */
export const TaskBoard: React.FC<{ projectId?: string; toolbarExtra?: React.ReactNode }> = ({ projectId: scopedProject, toolbarExtra }) => {
  const queryClient = useQueryClient();
  const me = useContext(AuthContext)?.user?.id ?? '';
  const canUpdate = useCan('task.update');
  const [project, setProject] = useState<string | null>(scopedProject ?? null);
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const [dragging, setDragging] = useState<Task | null>(null);
  const params = { ...(project ? { project_id: project } : {}), ...(mine && me ? { assignee_id: me } : {}), ...(debounced ? { search: debounced } : {}), ordering: 'code', page_size: BOARD_LIMIT };
  const tasks = useQuery({ queryKey: [...tasksApi.keys.lists(), 'board', params], queryFn: ({ signal }) => tasksApi.list(params, signal) });
  const rows = tasks.data?.results ?? [];

  const move = async (task: Task, next: string) => {
    try {
      await tasksApi.update(task.id, { status: next });
      await Promise.all([tasksApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    } catch (error) {
      notify.error(serverMessage(error));
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 flex-1 min-h-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Task board</h1>
          <p className="text-xs text-slate-400 mt-1">Drag a card to the next status, or use its menu.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {!scopedProject && (
            <div className="w-56">
              <ProjectPicker label="Project" value={project} onChange={setProject} />
            </div>
          )}
          <SearchInput placeholder="Search tasks" value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} aria-label="Search tasks" className="w-48" />
          <label className="flex items-center gap-1.5 text-xs text-slate-300 pb-2">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Mine
          </label>
          {toolbarExtra}
        </div>
      </div>

      <QueryBoundary isLoading={tasks.isLoading} error={rows.length === 0 ? tasks.error : null} onRetry={() => void tasks.refetch()} entityName="tasks" isEmpty={rows.length === 0} empty={{ title: 'No tasks found', description: 'Nothing matches the search, project or assignee.' }}>
        {tasks.data && tasks.data.count > rows.length && <p className="text-[11px] text-amber-300">Showing the first {rows.length} of {tasks.data.count} tasks. Narrow by project or use the list.</p>}
        <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${BOARD_COLUMNS.length}, minmax(15rem, 1fr))` }}>
          {BOARD_COLUMNS.map((column) => {
            const cards = rows.filter((t) => t.status === column);
            const canDrop = Boolean(dragging) && dragging?.status !== column && isAllowedMove('task', dragging?.status ?? '', column);
            return (
              <section
                key={column}
                aria-label={column}
                onDragOver={(e) => canDrop && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging && canDrop) void move(dragging, column);
                  setDragging(null);
                }}
                className={`rounded-xl border bg-slate-900/50 p-2 space-y-2 min-h-32 ${canDrop ? 'border-cyan-500/60' : 'border-slate-800'}`}
              >
                <header className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold text-slate-200">{column}</h2>
                  <Badge variant="outline">{cards.length}</Badge>
                </header>
                {cards.map((task) => (
                  <article key={task.id} aria-label={task.code} draggable={canUpdate} onDragStart={() => setDragging(task)} onDragEnd={() => setDragging(null)} className="rounded-lg border border-slate-800 bg-slate-950/80 p-2.5 space-y-1.5 text-xs">
                    <Link to={`/tasks/${task.id}`} className="font-semibold text-cyan-300 hover:underline">
                      {task.code} · {task.title}
                    </Link>
                    <p className="text-[11px] text-slate-500">
                      {task.entity_type === 'General' ? 'General' : `${task.entity_type} ${task.entity_code}`} · {task.project_code}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{task.assignee_name || 'Unassigned'}</span>
                      <span>
                        {task.priority}
                        {task.due_date ? ` · due ${task.due_date}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500">
                        {formatHours(task.logged_hours)} / {formatHours(task.estimated_hours)}
                      </span>
                      <StatusMenu entity="task" status={task.status} name={task.code} canChange={canUpdate} change={(next) => tasksApi.update(task.id, { status: next })} invalidate={[tasksApi.keys.all]} />
                    </div>
                    <TaskTimeCell task={task} />
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      </QueryBoundary>
    </div>
  );
};

