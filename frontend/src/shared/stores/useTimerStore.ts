import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ActiveTimerState, Task } from '@/types/tasks';

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
  tick: () => void;
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
        set({ isRunning: false });
      },

      resumeTimer: () => {
        set({ isRunning: true });
      },

      stopTimer: () => {
        const state = get();
        const durationHours = Math.max(0.1, Number((state.elapsedSeconds / 3600).toFixed(2)));
        const durationMinutes = Math.floor(state.elapsedSeconds / 60);

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

      tick: () => {
        const { isRunning, elapsedSeconds } = get();
        if (isRunning) {
          set({ elapsedSeconds: elapsedSeconds + 1 });
        }
      },
    }),
    {
      name: 'studiohub-timer-store',
    }
  )
);
