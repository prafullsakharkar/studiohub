import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'auth' | 'forbidden';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  category?: string;
  link?: string;
  action?: ToastAction;
}

export interface ToastItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  category?: string;
  link?: string;
  dedupKey?: string;
  action?: ToastAction;
}

export interface AddNotificationOptions extends Omit<AppNotification, 'id' | 'timestamp' | 'read'> {
  duration?: number;
  showToast?: boolean;
  dedupKey?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  toasts: ToastItem[];
  recentDedupKeys: Map<string, number>;
  addNotification: (notification: AddNotificationOptions) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
}

const DEDUP_WINDOW_MS = 3000;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  toasts: [],
  recentDedupKeys: new Map(),

  addNotification: (notification) => {
    const now = Date.now();
    const dedupKey = notification.dedupKey || `${notification.type}:${notification.title}:${notification.message}`;
    const recentKeys = get().recentDedupKeys;

    // Check deduplication
    const lastTimestamp = recentKeys.get(dedupKey);
    if (lastTimestamp && now - lastTimestamp < DEDUP_WINDOW_MS) {
      // Deduplicated: do not spawn redundant toast
      return;
    }

    // Record key timestamp and prune old keys
    recentKeys.set(dedupKey, now);
    if (recentKeys.size > 50) {
      for (const [key, ts] of recentKeys.entries()) {
        if (now - ts > DEDUP_WINDOW_MS * 2) {
          recentKeys.delete(key);
        }
      }
    }

    const id = `notif-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const shouldShowToast = notification.showToast !== false;

    set((state) => ({
      notifications: [
        {
          id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          timestamp: 'Just now',
          read: false,
          category: notification.category,
          link: notification.link,
          action: notification.action,
        },
        ...state.notifications.slice(0, 49), // Keep maximum 50 in history
      ],
      toasts: shouldShowToast
        ? [
            ...state.toasts.filter((t) => t.id !== id),
            {
              id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              duration: notification.duration ?? (notification.type === 'error' || notification.type === 'auth' ? 6000 : 4500),
              category: notification.category,
              link: notification.link,
              dedupKey,
              action: notification.action,
            },
          ]
        : state.toasts,
    }));
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearAllToasts: () =>
    set(() => ({
      toasts: [],
    })),

  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  clearNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
