/**
 * Compile-time key lists for the notification shapes (C-RP-23), checked against the captured responses in
 * `__tests__/notificationsContracts.test.ts`: a key added on either side fails the build or the test.
 */
import type { Notification, NotificationActor, NotificationProject, NotificationRecord, NotificationTarget } from './notifications';

export const NOTIFICATION_KEYS: Record<keyof Notification, true> = { id: true, kind: true, created_at: true, read_at: true, actor: true, project: true, target: true, record: true, data: true };
export const NOTIFICATIONACTOR_KEYS: Record<keyof NotificationActor, true> = { id: true, name: true };
export const NOTIFICATIONPROJECT_KEYS: Record<keyof NotificationProject, true> = { id: true, code: true, name: true };
export const NOTIFICATIONTARGET_KEYS: Record<keyof NotificationTarget, true> = { type: true, id: true, code: true, name: true };
export const NOTIFICATIONRECORD_KEYS: Record<keyof NotificationRecord, true> = { type: true, id: true, code: true };
