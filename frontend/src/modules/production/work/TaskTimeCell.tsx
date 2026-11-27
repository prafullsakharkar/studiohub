import { useState } from 'react';
import type React from 'react';
import { Clock, Play } from 'lucide-react';
import type { Task } from '@/api/production/work';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { useTimerStore } from '@/shared/stores/useTimerStore';
import { LogTimeDialog } from './LogTimeDialog';

/** Log time on a task, or run the stopwatch. Both need `timelog.create`. */
export const TaskTimeCell: React.FC<{ task: Task }> = ({ task }) => {
  const canLog = useCan('timelog.create');
  const [open, setOpen] = useState(false);
  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const startTimer = useTimerStore((state) => state.startTimer);
  if (!canLog || task.is_archived) return <span className="text-slate-600">—</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <Button
        type="button"
        size="xs"
        variant="outline"
        leftIcon={<Clock className="w-3.5 h-3.5" aria-hidden="true" />}
        aria-label={`Log time on ${task.code}`}
        onClick={() => setOpen(true)}
      >
        Log time
      </Button>
      {activeTaskId === task.id ? (
        <Badge variant="success">Timer running</Badge>
      ) : (
        <Button
          type="button"
          size="xs"
          variant="outline"
          leftIcon={<Play className="w-3.5 h-3.5" aria-hidden="true" />}
          aria-label={`Start timer on ${task.code}`}
          onClick={() =>
            startTimer({ id: task.id, code: task.code, title: task.title, project_id: task.project_id, project_code: task.project_code, project_name: task.project_name, department: task.department })
          }
        >
          Start timer
        </Button>
      )}
      {open && <LogTimeDialog isOpen onClose={() => setOpen(false)} task={task} />}
    </span>
  );
};
