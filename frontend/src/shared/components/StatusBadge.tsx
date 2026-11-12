import type React from 'react';
import { cn } from '@/shared/utils/cn';
import type { ProductionStatus, PriorityLevel } from '@/types/common';

export interface StatusBadgeProps {
  status?: ProductionStatus | string | null;
  /** The text to show when it is not the status itself (e.g. "Comp: Approved"); the colour still comes from `status`. */
  label?: React.ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export interface PriorityBadgeProps {
  priority?: PriorityLevel | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * The colours a status can have, by meaning. Each is spelled out in full so Tailwind sees the classes; the light
 * values are for the light theme, the `dark:` ones for the default dark theme.
 */
const TONES = {
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
  running: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30',
  ready: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30',
  waiting: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
  failed: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30',
  held: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30',
  idle: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30',
  omitted: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-400 dark:border-zinc-500/30',
  bidding: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
  preproduction: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30',
  signoff: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30',
  client: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30',
} as const;

const DOTS: Record<Tone, string> = {
  done: 'bg-emerald-500 dark:bg-emerald-400',
  running: 'bg-sky-500 dark:bg-sky-400',
  ready: 'bg-indigo-500 dark:bg-indigo-400',
  waiting: 'bg-amber-500 dark:bg-amber-400',
  failed: 'bg-rose-500 dark:bg-rose-400',
  held: 'bg-orange-500 dark:bg-orange-400',
  idle: 'bg-slate-400',
  omitted: 'bg-zinc-400',
  bidding: 'bg-blue-500 dark:bg-blue-400',
  preproduction: 'bg-violet-500 dark:bg-violet-400',
  signoff: 'bg-purple-500 dark:bg-purple-400',
  client: 'bg-cyan-500 dark:bg-cyan-400',
};

export type Tone = keyof typeof TONES;

/**
 * Every status the backend sends, by meaning, written in lower case with spaces (`toneOf` folds case, `_` and `-`).
 * A status that is not here is shown in the neutral tone.
 */
const STATUS_TONE: Record<string, Tone> = {
  // finished, accepted, live
  approved: 'done', completed: 'done', complete: 'done', delivered: 'done', active: 'done', enabled: 'done',
  exported: 'done', registered: 'done', verified: 'done', pass: 'done', success: 'done', available: 'done',
  resolved: 'done', conformed: 'done', published: 'done', final: 'done', done: 'done',
  // being worked on now
  'in progress': 'running', progress: 'running', started: 'running', validating: 'running', exporting: 'running',
  'in review': 'running', running: 'running', wip: 'running', booked: 'running', scheduled: 'running',
  // prepared, waiting for the next step
  ready: 'ready', validated: 'ready',
  // a note answered and waiting for its author to close it (review-pipeline RP-2)
  addressed: 'ready',
  // waiting on someone
  pending: 'waiting', 'pending review': 'waiting', 'internal review': 'waiting', submitted: 'waiting', queued: 'waiting',
  open: 'waiting', 'on leave': 'waiting', postponed: 'waiting', deprecated: 'waiting',
  // refused or broken
  rejected: 'failed', retake: 'failed', failed: 'failed', fail: 'failed', revoked: 'failed', mismatch: 'failed',
  missing: 'failed', overbooked: 'failed', blocking: 'failed',
  // stopped on purpose
  'on hold': 'held',
  // not started, ended or switched off
  'not started': 'idle', draft: 'idle', archived: 'idle', closed: 'idle', inactive: 'idle', disabled: 'idle',
  blocked: 'idle', cancelled: 'idle', expired: 'idle', terminated: 'idle', unavailable: 'idle', muted: 'idle',
  paused: 'idle', declared: 'idle', 'not checked': 'idle',
  omitted: 'omitted',
  // production stages with a colour of their own
  bidding: 'bidding',
  'pre production': 'preproduction',
  'signed off': 'signoff', 'supervisor review': 'signoff',
  'client review': 'client',
};

const keyOf = (status: string | null | undefined) => (status ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

/** The tone of a status, whatever its case or separator ("In Progress", "in_progress", "IN-PROGRESS"). */
export function toneOf(status: string | null | undefined): Tone {
  return isKnownStatus(status) ? STATUS_TONE[keyOf(status)] : 'idle';
}

/** Whether the status has a tone of its own (false: it falls back to the neutral tone). */
export function isKnownStatus(status: string | null | undefined): boolean {
  return Object.hasOwn(STATUS_TONE, keyOf(status));
}

const priorityColors: Record<string, { bg: string; text: string; border: string }> = {
  'Critical': {
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
  },
  'Urgent': {
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  'High': {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  'Medium': {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  'Low': {
    bg: 'bg-slate-500/15',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
  },
};

const sizeClasses = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

/**
 * The one way to show a status. The text is the status as the API sends it (or `label`); the colour is its tone.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'Not Started',
  label,
  size = 'sm',
  showDot = true,
  className,
}) => {
  const text = status || 'Unknown';
  const tone = toneOf(text);

  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-md border whitespace-nowrap select-none',
        sizeClasses[size] || sizeClasses.sm,
        TONES[tone],
        className
      )}
    >
      {showDot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', DOTS[tone])} aria-hidden="true" />}
      <span>{label ?? text}</span>
    </span>
  );
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority = 'Medium',
  size = 'sm',
  className,
}) => {
  const label = priority || 'Medium';
  const scheme =
    priorityColors[label] || {
      bg: 'bg-slate-700/20',
      text: 'text-slate-300',
      border: 'border-slate-700/50',
    };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-md border whitespace-nowrap select-none uppercase tracking-wider',
        sizeClasses[size] || sizeClasses.sm,
        scheme.bg,
        scheme.text,
        scheme.border,
        className
      )}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
