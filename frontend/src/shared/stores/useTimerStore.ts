import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActiveTimerState {
  isRunning: boolean;
  activeTaskId: string | null;
  activeTaskCode: string | null;
  activeTaskTitle: string | null;
  activeProjectId: string | null;
  activeProjectCode: string | null;
  activeProjectName: string | null;
  department?: string;
  /** When the current running stretch began (ms since the epoch); null while paused or idle. */
  startTime: number | null;
  /** Seconds counted before the current running stretch, i.e. up to the last pause. */
  elapsedSeconds: number;
  isBillable: boolean;
  notes: string;
}

interface TimerStoreState extends ActiveTimerState {
  startTimer: (task: {
    id: string;
    code: string;
    title: string;
    project_id: string;
    project_code: string;
    project_name?: string;
    department?: string;
  }, isBillable?: boolean, notes?: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => {
    taskId: string | null;
    taskCode: string | null;
    taskTitle: string | null;
    projectId: string | null;
    projectCode: string | null;
    projectName: string | null;
    department?: string;
    durationHours: number;
    durationMinutes: number;
    isBillable: boolean;
    notes: string;
  };
  resetTimer: () => void;
  setNotes: (notes: string) => void;
  setIsBillable: (billable: boolean) => void;
}

/**
 * Seconds on the stopwatch at `now`: the time before the last pause plus the current stretch. Worked out from the
 * clock, not counted, so it stays right in a background tab and after a reload.
 */
export function timerElapsedSeconds(state: Pick<ActiveTimerState, 'isRunning' | 'startTime' | 'elapsedSeconds'>, now = Date.now()): number {
  const running = state.isRunning && state.startTime !== null ? Math.max(0, Math.floor((now - state.startTime) / 1000)) : 0;
  return state.elapsedSeconds + running;
}

export const useTimerStore = create<TimerStoreState>()(
  persist(
    (set, get) => ({
      isRunning: false,
      activeTaskId: null,
      activeTaskCode: null,
      activeTaskTitle: null,
      activeProjectId: null,
      activeProjectCode: null,
      activeProjectName: null,
      department: undefined,
      startTime: null,
      elapsedSeconds: 0,
      isBillable: true,
      notes: '',

      startTimer: (task, isBillable = true, notes = '') => {
        set({
          isRunning: true,
          activeTaskId: task.id,
          activeTaskCode: task.code,
          activeTaskTitle: task.title,
          activeProjectId: task.project_id,
          activeProjectCode: task.project_code,
          activeProjectName: task.project_name || task.project_code,
          department: task.department,
          startTime: Date.now(),
          elapsedSeconds: 0,
          isBillable,
          notes,
        });
      },

      pauseTimer: () => {
        const state = get();
        if (!state.isRunning) return;
        set({ isRunning: false, elapsedSeconds: timerElapsedSeconds(state), startTime: null });
      },

      resumeTimer: () => {
        const state = get();
        if (state.isRunning || !state.activeTaskId) return;
        set({ isRunning: true, startTime: Date.now() });
      },

      stopTimer: () => {
        const state = get();
        const elapsed = timerElapsedSeconds(state);
        const durationHours = Math.max(0.1, Number((elapsed / 3600).toFixed(2)));
        const durationMinutes = Math.floor(elapsed / 60);

        const summary = {
          taskId: state.activeTaskId,
          taskCode: state.activeTaskCode,
          taskTitle: state.activeTaskTitle,
          projectId: state.activeProjectId,
          projectCode: state.activeProjectCode,
          projectName: state.activeProjectName,
          department: state.department,
          durationHours,
          durationMinutes,
          isBillable: state.isBillable,
          notes: state.notes,
        };

        set({
          isRunning: false,
          activeTaskId: null,
          activeTaskCode: null,
          activeTaskTitle: null,
          activeProjectId: null,
          activeProjectCode: null,
          activeProjectName: null,
          department: undefined,
          startTime: null,
          elapsedSeconds: 0,
          notes: '',
        });

        return summary;
      },

      resetTimer: () => {
        set({
          isRunning: false,
          activeTaskId: null,
          activeTaskCode: null,
          activeTaskTitle: null,
          activeProjectId: null,
          activeProjectCode: null,
          activeProjectName: null,
          department: undefined,
          startTime: null,
          elapsedSeconds: 0,
          notes: '',
        });
      },

      setNotes: (notes: string) => set({ notes }),
      setIsBillable: (isBillable: boolean) => set({ isBillable }),
    }),
    {
      name: 'studiohub-timer-store',
    }
  )
);
