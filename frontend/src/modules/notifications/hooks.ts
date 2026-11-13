import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, UNREAD_POLL_MS } from '@/api/notifications/notifications';
import type { Notification } from '@/api/notifications/notifications';

/** How many rows the bell's panel shows; the page has the rest. */
export const BELL_ROWS = 20;

/**
 * The unread count behind the bell: checked every minute while the tab is visible (React Query pauses the interval
 * in a hidden tab) and again whenever the window regains focus (Q-RP-36).
 */
export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: notificationsApi.keys.unreadCount(),
    queryFn: ({ signal }) => notificationsApi.unreadCount(signal),
    enabled,
    refetchInterval: UNREAD_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

/** The newest rows, for the bell's panel (fetched when it opens). */
export function useLatestNotifications(enabled: boolean) {
  const params = { page: 1, page_size: BELL_ROWS };
  return useQuery({
    queryKey: notificationsApi.keys.list(params),
    queryFn: ({ signal }) => notificationsApi.list(params, signal),
    enabled,
    staleTime: 0,
  });
}

/** Read, unread and read-all; each refreshes the count and every list. */
export function useNotificationActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: notificationsApi.keys.all });
  const read = useMutation({ mutationFn: (n: Notification) => notificationsApi.read(n.id), onSettled: refresh });
  const unread = useMutation({ mutationFn: (n: Notification) => notificationsApi.unread(n.id), onSettled: refresh });
  const readAll = useMutation({ mutationFn: (before?: string) => notificationsApi.readAll(before), onSettled: refresh });
  return { read, unread, readAll };
}

/** The newest `created_at` among rows the reader has seen: read-all stops there, so a row that came since stays unread. */
export function newestSeen(rows: Notification[]): string | undefined {
  return rows.reduce<string | undefined>((best, n) => (best === undefined || Date.parse(n.created_at) > Date.parse(best) ? n.created_at : best), undefined);
}
