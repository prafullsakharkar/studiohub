import { create } from 'zustand';

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  category?: string;
  link?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [
    {
      id: 'notif-1',
      type: 'success',
      title: 'Shot Approved',
      message: 'NK_010_020 has been marked Approved by Alex Chen.',
      timestamp: '10 minutes ago',
      read: false,
    },
    {
      id: 'notif-2',
      type: 'info',
      title: 'New Review Ready',
      message: 'Version v003 published for NK_010_030.',
      timestamp: '1 hour ago',
      read: false,
    },
    {
      id: 'notif-3',
      type: 'warning',
      title: 'Render Farm Load',
      message: 'Deadline farm running at 74% capacity with 94 active blades.',
      timestamp: '2 hours ago',
      read: true,
    },
  ],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: `notif-${Date.now()}`,
          timestamp: 'Just now',
          read: false,
        },
        ...state.notifications,
      ],
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
    })),
}));
