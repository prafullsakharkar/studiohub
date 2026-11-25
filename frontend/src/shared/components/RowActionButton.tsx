import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Ban,
  CalendarClock,
  Check,
  CheckCheck,
  CircleCheck,
  CircleSlash,
  CircleX,
  Columns2,
  Copy,
  Eye,
  History,
  KeyRound,
  Layers,
  Lock,
  LockOpen,
  LogOut,
  Pause,
  Play,
  type LucideIcon,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Star,
  TextCursorInput,
  Trash2,
  Undo2,
  Unlink,
  Upload,
  X,
} from 'lucide-react';
import type React from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../utils/cn';

/** default: an ordinary action; warning: changes state in a way that can be undone; danger: removes something. */
export type RowActionTone = 'default' | 'warning' | 'danger';

/**
 * The icon of a row action, by its label (first match wins: "Make hero" before "Make default", "Unpublish" before
 * "Publish"). A label with no icon here is drawn as a rounded text pill, never as a guessed icon.
 */
const ICONS: ReadonlyArray<readonly [RegExp, LucideIcon]> = [
  [/^edit\b/i, Pencil],
  [/^restore\b/i, ArchiveRestore],
  [/^archive\b/i, Archive],
  [/^(delete|remove)\b/i, Trash2],
  [/^(unlink|detach)\b/i, Unlink],
  [/^(revoke|block)\b/i, Ban],
  [/^unblock\b/i, ShieldCheck],
  [/^rotate\b/i, RefreshCw],
  [/^(end session|sign out)\b/i, LogOut],
  [/^unpublish\b/i, Undo2],
  [/^publish\b/i, Upload],
  [/^make hero\b/i, Star],
  [/^make default\b/i, BadgeCheck],
  [/^approve\b/i, Check],
  [/^reject\b/i, X],
  [/^(resubmit|reopen)\b/i, RotateCcw],
  [/^(activate|reactivate|enable|unsuspend)\b/i, Power],
  [/^(deactivate|disable|suspend)\b/i, PowerOff],
  [/^terminate\b/i, CircleSlash],
  [/^unlock\b/i, LockOpen],
  [/^lock\b/i, Lock],
  [/^rename\b/i, TextCursorInput],
  [/^schedule\b/i, CalendarClock],
  [/^(clone|duplicate|copy)\b/i, Copy],
  [/^reset password\b/i, KeyRound],
  [/^require password change\b/i, ShieldAlert],
  [/^compare\b/i, Columns2],
  [/^mark\b/i, CheckCheck],
  [/^(details|view)\b/i, Eye],
  [/^cancel\b/i, CircleX],
  [/^resolve\b/i, CircleCheck],
  [/^retry\b/i, RotateCw],
  [/^pause\b/i, Pause],
  [/^resume\b/i, Play],
  [/^versions\b/i, Layers],
  [/^history\b/i, History],
  [/^move .* up$/i, ArrowUp],
  [/^move .* down$/i, ArrowDown],
];

export const rowActionIcon = (label: string): LucideIcon | undefined => ICONS.find(([pattern]) => pattern.test(label.trim()))?.[1];

const TONES: Record<RowActionTone, string> = {
  default: 'text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/50 hover:text-cyan-200',
  warning: 'text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 hover:text-amber-300',
  danger: 'text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 hover:text-rose-300',
};

const shape = (hasIcon: boolean, tone: RowActionTone, className?: string) =>
  cn(
    'inline-flex shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-900/80 disabled:hover:border-slate-700',
    hasIcon ? 'h-7 w-7' : 'h-7 px-2.5 text-[11px] font-semibold',
    TONES[tone],
    className,
  );

interface RowActionBase {
  /** What the action does, e.g. "Edit": the tooltip, and the accessible name unless `aria-label` says more. */
  label: string;
  /** Defaults to the icon for the label (`rowActionIcon`); with none, the label is shown as a pill. */
  icon?: LucideIcon;
  tone?: RowActionTone;
  'aria-label'?: string;
  className?: string;
}

const Face: React.FC<{ icon?: LucideIcon; label: string }> = ({ icon: Icon, label }) => (Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : label);

/** A table row's action as a round icon button; the label is its tooltip. */
export const RowActionButton: React.FC<RowActionBase & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>> = ({ label, icon, tone = 'default', className, type = 'button', title, ...props }) => {
  const Icon = icon ?? rowActionIcon(label);
  return (
    <button type={type} aria-label={props['aria-label'] ?? label} title={title ?? label} className={shape(Boolean(Icon), tone, className)} {...props}>
      <Face icon={Icon} label={label} />
    </button>
  );
};

/** A row action that goes to a page (e.g. the edit form), drawn like `RowActionButton`. */
export const RowActionLink: React.FC<RowActionBase & { to: string }> = ({ label, icon, tone = 'default', className, to, ...props }) => {
  const Icon = icon ?? rowActionIcon(label);
  return (
    <Link to={to} aria-label={props['aria-label'] ?? label} title={label} className={shape(Boolean(Icon), tone, className)}>
      <Face icon={Icon} label={label} />
    </Link>
  );
};

/** The row's actions side by side, right-aligned in their cell. */
export const RowActions: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => <div className={cn('inline-flex items-center justify-end gap-1.5', className)}>{children}</div>;
