import type React from 'react';
import { cn } from '@/shared/utils/cn';
import type { ProductionStatus, PriorityLevel } from '@/types/common';

export interface StatusBadgeProps {
  status?: ProductionStatus | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export interface PriorityBadgeProps {
  priority?: PriorityLevel | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const statusColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  // Production statuses
  'Approved': {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  'Delivered': {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-300',
  },
  'In Progress': {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    dot: 'bg-sky-400',
  },
  'Ready': {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    dot: 'bg-indigo-400',
  },
  'Not Started': {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    dot: 'bg-slate-400',
  },
  'Pre-Production': {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/30',
    dot: 'bg-violet-400',
  },
  'Bidding': {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
  },
  'Internal Review': {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  'Supervisor Review': {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    dot: 'bg-purple-400',
  },
  'Client Review': {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    dot: 'bg-cyan-400',
  },
  'Pending Review': {
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
    dot: 'bg-amber-300',
  },
  'Retake': {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    dot: 'bg-rose-400',
  },
  'On Hold': {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    dot: 'bg-orange-400',
  },
  'Omitted': {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    border: 'border-zinc-500/30',
    dot: 'bg-zinc-400',
  },
  'Archived': {
    bg: 'bg-slate-700/20',
    text: 'text-slate-400',
    border: 'border-slate-700/40',
    dot: 'bg-slate-500',
  },
  // Generic statuses
  'Active': {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  'Completed': {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  'Pending': {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  'Failed': {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    dot: 'bg-rose-400',
  },
};

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

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'Not Started',
  size = 'sm',
  showDot = true,
  className,
}) => {
  const label = status || 'Unknown';
  const scheme =
    statusColors[label] || {
      bg: 'bg-slate-700/20',
      text: 'text-slate-300',
      border: 'border-slate-700/50',
      dot: 'bg-slate-400',
    };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-md border whitespace-nowrap select-none',
        sizeClasses[size] || sizeClasses.sm,
        scheme.bg,
        scheme.text,
        scheme.border,
        className
      )}
    >
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', scheme.dot)} aria-hidden="true" />
      )}
      <span>{label}</span>
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
