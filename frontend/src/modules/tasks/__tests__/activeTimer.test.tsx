import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@/api/production/work';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { TaskTimeCell } from '@/modules/production/work/TaskTimeCell';
import { timerElapsedSeconds, useTimerStore } from '@/shared/stores/useTimerStore';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { ActiveTimerBanner } from '../components/ActiveTimerBanner';

/**
 * The stopwatch on a task. It used to stay at 00:00:00: the store counted seconds through a `tick()` nobody called.
 * The time now comes from the clock (time before the last pause plus the current stretch), and the banner redraws
 * once a second while it runs.
 */
type Captured = { status: number; body: any };
const admin = loadSample<Record<string, Captured>>('identity/auth__me.json').list_admin.body as User;
const task = (loadSample<Record<string, Captured>>('production/tasks.json').list_admin.body.results as Task[])[0];

const shown = () => screen.getByRole('timer').textContent;
const start = () =>
  useTimerStore.getState().startTimer({ id: task.id, code: task.code, title: task.title, project_id: task.project_id, project_code: task.project_code });

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-27T10:00:00Z') });
  useTimerStore.getState().resetTimer();
});

afterEach(() => {
  cleanup();
  useTimerStore.getState().resetTimer();
  vi.useRealTimers();
});

describe('timerElapsedSeconds', () => {
  it('adds the running stretch to the time before the last pause', () => {
    const now = Date.now();
    expect(timerElapsedSeconds({ isRunning: true, startTime: now - 61_500, elapsedSeconds: 30 }, now)).toBe(91);
    expect(timerElapsedSeconds({ isRunning: false, startTime: null, elapsedSeconds: 30 }, now)).toBe(30);
    expect(timerElapsedSeconds({ isRunning: true, startTime: now + 5_000, elapsedSeconds: 0 }, now)).toBe(0);
  });
});

describe('ActiveTimerBanner', () => {
  it('counts up once the timer is started', () => {
    render(<ActiveTimerBanner />);
    act(() => start());
    expect(shown()).toBe('00:00:00');
    act(() => vi.advanceTimersByTime(3_000));
    expect(shown()).toBe('00:00:03');
    act(() => vi.advanceTimersByTime(62_000));
    expect(shown()).toBe('00:01:05');
  });

  it('holds while paused and carries on from there when resumed', () => {
    render(<ActiveTimerBanner />);
    act(() => start());
    act(() => vi.advanceTimersByTime(10_000));
    act(() => fireEvent.click(screen.getByTitle('Pause Timer')));
    act(() => vi.advanceTimersByTime(60_000));
    expect(shown()).toBe('00:00:10');
    act(() => fireEvent.click(screen.getByTitle('Resume Timer')));
    act(() => vi.advanceTimersByTime(5_000));
    expect(shown()).toBe('00:00:15');
  });

  it('keeps the time of a timer started before a reload', () => {
    useTimerStore.setState({ isRunning: true, activeTaskId: task.id, activeTaskCode: task.code, startTime: Date.now() - 90_000, elapsedSeconds: 0 });
    render(<ActiveTimerBanner />);
    expect(shown()).toBe('00:01:30');
  });

  it('stops with the elapsed time, paused or not', () => {
    start();
    vi.advanceTimersByTime(1_800_000);
    useTimerStore.getState().pauseTimer();
    vi.advanceTimersByTime(600_000);
    useTimerStore.getState().resumeTimer();
    vi.advanceTimersByTime(1_800_000);
    const summary = useTimerStore.getState().stopTimer();
    expect(summary.durationMinutes).toBe(60);
    expect(summary.durationHours).toBe(1);
  });
});

describe('TaskTimeCell', () => {
  function renderCell() {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <AuthContext.Provider value={{ user: admin, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <TaskTimeCell task={task} />
          <ActiveTimerBanner />
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  }

  it('shows Log time and Start timer as buttons with an icon and a name', () => {
    renderCell();
    for (const [label, text] of [
      [`Log time on ${task.code}`, 'Log time'],
      [`Start timer on ${task.code}`, 'Start timer'],
    ]) {
      const button = screen.getByRole('button', { name: label });
      expect(button).toHaveTextContent(text);
      expect(button.querySelector('svg')).not.toBeNull();
    }
  });

  it('starts a running timer on the task', () => {
    renderCell();
    act(() => fireEvent.click(screen.getByRole('button', { name: `Start timer on ${task.code}` })));
    expect(useTimerStore.getState().activeTaskId).toBe(task.id);
    expect(screen.getByText('Timer running')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2_000));
    expect(shown()).toBe('00:00:02');
  });
});
