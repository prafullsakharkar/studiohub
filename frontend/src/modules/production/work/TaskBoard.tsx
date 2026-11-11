import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ArrowRight, Box, Calendar, Clock, Film, Layers, User } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { isAllowedMove } from '@/api/production/statusFlow';
import { tasksApi } from '@/api/production/work';
import type { Task } from '@/api/production/work';
import { SmartImg } from '@/components/ui/SmartImg';
import { formatDate } from '@/core/locale/studioLocale';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { PriorityBadge } from '@/shared/components/StatusBadge';
import { StatusMenu } from './StatusMenu';
import { TaskTimeCell } from './TaskTimeCell';
import { formatHours, todayIso } from './format';

/** One column per status a task can rest in; Archived is an action, not a column. */
export const BOARD_COLUMNS = ['Not Started', 'In Progress', 'Pending Review', 'Retake', 'Approved'] as const;
/** The colour of each lane: its border, and the pill that counts its cards. */
const LANE_STYLE: Record<(typeof BOARD_COLUMNS)[number], { border: string; pill: string }> = {
  'Not Started': { border: 'border-slate-700', pill: 'bg-slate-500/10 text-slate-300' },
  'In Progress': { border: 'border-indigo-500/30', pill: 'bg-indigo-500/10 text-indigo-300' },
  'Pending Review': { border: 'border-amber-500/30', pill: 'bg-amber-500/10 text-amber-300' },
  Retake: { border: 'border-rose-500/30', pill: 'bg-rose-500/10 text-rose-300' },
  Approved: { border: 'border-emerald-500/30', pill: 'bg-emerald-500/10 text-emerald-300' },
};

/** The arrows on a card: one step forward along the usual path, one back. Only a move the backend allows is offered. */
const FORWARD: Record<string, string> = { 'Not Started': 'In Progress', 'In Progress': 'Pending Review', 'Pending Review': 'Approved', Retake: 'In Progress' };
const BACK: Record<string, string> = { 'In Progress': 'Not Started', 'Pending Review': 'In Progress' };

const EntityIcon: React.FC<{ type: string }> = ({ type }) =>
  type === 'Shot' ? <Film className="w-3 h-3 text-cyan-400 shrink-0" aria-hidden /> : type === 'Asset' ? <Box className="w-3 h-3 text-amber-400 shrink-0" aria-hidden /> : <Layers className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />;


/**
 * Tasks as lanes by status: the Board view of the task list, which supplies the rows (its own search and filters).
 * A card moves by drag and drop, by its arrows or by its status menu, and only to lanes the backend allows from
 * where it is (`statusFlow.ts`); the server still decides, and its refusal is shown.
 */
export const TaskBoardLanes: React.FC<{ tasks: Task[] }> = ({ tasks: rows }) => {
  const queryClient = useQueryClient();
  const canUpdate = useCan('task.update');
  const [dragging, setDragging] = useState<Task | null>(null);

  const move = async (task: Task, next: string) => {
    try {
      await tasksApi.update(task.id, { status: next });
      await Promise.all([tasksApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    } catch (error) {
      notify.error(serverMessage(error));
    }
  };

  return (
    <div className="flex gap-4 items-start overflow-x-auto pb-4 min-w-0">
      {BOARD_COLUMNS.map((column) => {
        const cards = rows.filter((t) => t.status === column);
        const canDrop = Boolean(dragging) && dragging?.status !== column && isAllowedMove('task', dragging?.status ?? '', column);
        const lane = LANE_STYLE[column];
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
            className={`flex w-[280px] min-w-[280px] shrink-0 max-h-[calc(100vh-280px)] flex-col rounded-xl border bg-slate-900/60 shadow-lg ${canDrop ? 'border-cyan-500/60' : lane.border}`}
          >
            <header className="flex shrink-0 items-center justify-between rounded-t-xl border-b border-slate-800/80 bg-slate-900/90 p-3.5">
              <h2 className="text-xs font-semibold text-slate-200">{column}</h2>
              <span className={`rounded-full border border-slate-700 px-2 py-0.5 font-mono text-[11px] font-bold ${lane.pill}`}>{cards.length}</span>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-2.5">
              {cards.length === 0 && <p className="py-8 text-center text-xs italic text-slate-500">No tasks</p>}
              {cards.map((task) => {
                const overdue = Boolean(task.due_date) && (task.due_date as string) < todayIso() && task.status !== 'Approved';
                const forward = FORWARD[task.status];
                const back = BACK[task.status];
                const arrow = (to: string | undefined, icon: React.ReactNode, hover: string) =>
                  to && canUpdate && isAllowedMove('task', task.status, to) ? (
                    <button type="button" aria-label={`Move ${task.code} to ${to}`} title={`Move to ${to}`} onClick={() => void move(task, to)} className={`rounded border border-slate-700 bg-slate-900 p-1 text-slate-400 ${hover}`}>
                      {icon}
                    </button>
                  ) : null;
                return (
                  <article key={task.id} aria-label={task.code} draggable={canUpdate} onDragStart={() => setDragging(task)} onDragEnd={() => setDragging(null)} className="group flex min-w-0 flex-col gap-2.5 rounded-lg border border-slate-700/80 bg-slate-800/80 p-3.5 text-xs shadow-sm transition-all hover:border-slate-600 hover:bg-slate-800">
                    <div className="flex min-w-0 items-center justify-between gap-1.5">
                      <Link to={`/tasks/${task.id}`} className="truncate font-mono text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline">
                        {task.code}
                      </Link>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <Link to={`/tasks/${task.id}`} title={task.title} className="line-clamp-2 text-xs font-medium text-slate-100 hover:text-indigo-300">
                      {task.title}
                    </Link>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded border border-slate-700/80 bg-slate-900 px-1.5 py-0.5 text-slate-300">
                        <EntityIcon type={task.entity_type} />
                        <span className="truncate">{task.entity_type === 'General' ? 'General' : task.entity_code}</span>
                      </span>
                      {(task.task_type_name || task.department) && <span className="shrink-0 rounded border border-slate-800 bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-slate-400">{task.task_type_name || task.department}</span>}
                      <span className="font-mono text-[10px] text-slate-500">{task.project_code}</span>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-2 border-t border-slate-700/60 pt-2 text-slate-400">
                      <div className="flex min-w-0 items-center gap-1.5" title={task.assignee_name || 'Unassigned'}>
                        {task.assignee_avatar ? (
                          <SmartImg src={task.assignee_avatar} alt="" className="h-5 w-5 shrink-0 rounded-full border border-slate-600 object-cover" />
                        ) : (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-400">
                            <User className="h-3 w-3" aria-hidden />
                          </span>
                        )}
                        <span className="max-w-[90px] truncate text-[11px] text-slate-300">{task.assignee_name ? task.assignee_name.split(' ')[0] : 'Unassigned'}</span>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px]" title="Logged / estimated">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatHours(task.logged_hours)} / {formatHours(task.estimated_hours)}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className={`inline-flex min-w-0 items-center gap-1 truncate font-mono text-[10px] ${overdue ? 'font-semibold text-rose-400' : 'text-slate-400'}`}>
                        <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{task.due_date ? formatDate(task.due_date) : 'No date'}</span>
                        {overdue && <AlertCircle className="h-3 w-3 shrink-0" aria-label="Overdue" />}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {arrow(back, <ArrowLeft className="h-3 w-3" aria-hidden />, 'hover:text-slate-200')}
                        {arrow(forward, <ArrowRight className="h-3 w-3" aria-hidden />, 'hover:text-indigo-300')}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-slate-700/60 pt-2">
                      <TaskTimeCell task={task} />
                      <StatusMenu entity="task" status={task.status} name={task.code} canChange={canUpdate} change={(next) => tasksApi.update(task.id, { status: next })} invalidate={[tasksApi.keys.all]} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>

  );
};
