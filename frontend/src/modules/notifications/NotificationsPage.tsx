import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { NOTIFICATION_KINDS, notificationsApi } from '@/api/notifications/notifications';
import type { Notification, NotificationKind } from '@/api/notifications/notifications';
import { Pagination } from '@/shared/components/Pagination';
import { usePaginatedList } from '@/shared/data/usePaginatedList';
import { describeNotification, notificationPath } from './describe';
import { newestSeen, useNotificationActions, useUnreadCount } from './hooks';
import { NotificationRow } from './NotificationBell';

const KIND_LABELS: Record<NotificationKind, string> = {
  note_created: 'Notes on my work',
  note_mention: 'Mentions',
  note_reply: 'Replies',
  note_status: 'Note status',
  task_assigned: 'Tasks assigned',
  task_status: 'Task status',
  version_status: 'Version status',
  review_media_ready: 'Review movie ready',
  review_media_failed: 'Review movie failed',
};

/**
 * Every notification of the signed-in person (review pipeline RP-6, C-RP-23), newest first, with the unread and kind
 * filters. Rows the server no longer shows (the record was deleted, or the person lost access to it) are simply
 * not in the list. Kept 90 days.
 */
export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const list = usePaginatedList<Notification>({
    queryKey: [...notificationsApi.keys.lists()],
    fetchPage: notificationsApi.list,
    pageSize: 25,
    staleTime: 0,
  });
  const count = useUnreadCount().data?.count ?? 0;
  const { read, unread, readAll } = useNotificationActions();

  const openRow = (n: Notification) => {
    if (!n.read_at) read.mutate(n);
    navigate(notificationPath(n));
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Notifications</h1>
          <p className="text-xs text-slate-400">{count > 0 ? `${count} unread` : 'Nothing unread'} · kept 90 days</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="notifications-unread" className="sr-only">
            Show
          </label>
          <select
            id="notifications-unread"
            value={String(list.filters.unread ?? '')}
            onChange={(e) => list.setFilter('unread', e.target.value || undefined)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">All</option>
            <option value="true">Unread</option>
            <option value="false">Read</option>
          </select>
          <label htmlFor="notifications-kind" className="sr-only">
            Kind
          </label>
          <select
            id="notifications-kind"
            value={String(list.filters.kind ?? '')}
            onChange={(e) => list.setFilter('kind', e.target.value || undefined)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">Every kind</option>
            {NOTIFICATION_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={count === 0 || readAll.isPending}
            // On the first page the newest row shown is the cutoff, so one that arrived since stays unread.
            onClick={() => readAll.mutate(list.page === 1 ? newestSeen(list.rows) : undefined)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-40 cursor-pointer"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 divide-y divide-slate-800/60 overflow-hidden">
        {list.isLoading ? (
          <div className="p-6 text-center text-xs text-slate-400">Loading…</div>
        ) : list.error ? (
          <div className="p-6 text-center text-xs text-rose-400">The notifications could not be loaded.</div>
        ) : list.rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">No notifications</div>
        ) : (
          list.rows.map((n) => (
            <div key={n.id} className="flex items-stretch">
              <div className="flex-1 min-w-0">
                <NotificationRow n={n} onOpen={openRow} />
              </div>
              <button
                type="button"
                onClick={() => (n.read_at ? unread : read).mutate(n)}
                className="px-3 text-[11px] text-slate-400 hover:text-cyan-300 cursor-pointer shrink-0"
                aria-label={`${n.read_at ? 'Mark unread' : 'Mark read'}: ${describeNotification(n)}`}
              >
                {n.read_at ? 'Mark unread' : 'Mark read'}
              </button>
            </div>
          ))
        )}
      </div>

      <Pagination currentPage={list.page} totalCount={list.count} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="notifications" />
    </div>
  );
};
