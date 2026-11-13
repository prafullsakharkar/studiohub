import { Bell, Check } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Notification } from '@/api/notifications/notifications';
import { formatDateTime } from '@/core/locale/studioLocale';
import { describeNotification, notificationPath } from './describe';
import { newestSeen, useLatestNotifications, useNotificationActions, useUnreadCount } from './hooks';

/** One row: what happened, the project and when; unread rows are tinted. */
export const NotificationRow: React.FC<{ n: Notification; onOpen: (n: Notification) => void }> = ({ n, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(n)}
    className={`w-full p-3 text-left transition-colors cursor-pointer hover:bg-slate-800/50 ${n.read_at ? '' : 'bg-cyan-950/20'}`}
    data-unread={n.read_at ? undefined : 'true'}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs text-white leading-relaxed">
        {!n.read_at && (
          <>
            <span className="inline-block w-1.5 h-1.5 mr-1.5 mb-0.5 rounded-full bg-cyan-400" aria-hidden="true" />
            <span className="sr-only">Unread: </span>
          </>
        )}
        {describeNotification(n)}
      </p>
    </div>
    <p className="text-[10px] text-slate-500 mt-1">
      {n.project.code} · {formatDateTime(n.created_at)}
    </p>
  </button>
);

/**
 * The bell in the header (review pipeline RP-6, Q-RP-39 = A): the server's inbox, not this tab's toasts. The count
 * is polled every minute while the tab is visible; the panel loads the newest rows when it opens. A row opens its
 * record and is marked read.
 */
export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const count = useUnreadCount().data?.count ?? 0;
  const latest = useLatestNotifications(open);
  const { read, readAll } = useNotificationActions();
  const rows = latest.data?.results ?? [];

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openRow = (n: Notification) => {
    if (!n.read_at) read.mutate(n);
    setOpen(false);
    navigate(notificationPath(n));
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        id="notifications-btn"
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-cyan-500 text-[9px] font-bold leading-4 text-slate-950 text-center ring-2 ring-slate-900">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-1.5 w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95"
        >
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
              {count > 0 && <span className="px-1.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">{count} new</span>}
            </div>
            {count > 0 && rows.length > 0 && (
              <button
                type="button"
                onClick={() => readAll.mutate(newestSeen(rows))}
                className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
            {latest.isLoading ? (
              <div className="p-4 text-center text-xs text-slate-400">Loading…</div>
            ) : latest.isError ? (
              <div className="p-4 text-center text-xs text-rose-400">The notifications could not be loaded.</div>
            ) : rows.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">No notifications</div>
            ) : (
              rows.map((n) => <NotificationRow key={n.id} n={n} onOpen={openRow} />)
            )}
          </div>
          <div className="p-2 border-t border-slate-800 text-center">
            <Link to="/notifications" onClick={() => setOpen(false)} className="text-[11px] text-cyan-400 hover:text-cyan-300">
              See all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
