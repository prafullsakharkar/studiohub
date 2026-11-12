import { useState } from 'react';
import type React from 'react';
import type { Task } from '@/api/production/work';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { useTimerStore } from '@/shared/stores/useTimerStore';
import { LogTimeDialog } from './LogTimeDialog';

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
