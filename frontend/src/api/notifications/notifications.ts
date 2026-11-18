/**
 * In-app notifications (docs/review-pipeline RP-6, CONTRACTS.md C-RP-23; RP-11, C-RP-28 and C-RP-30; RP-13, C-RP-34 to
 * C-RP-36), pinned to the responses captured in docs/sync/samples/notifications/_notifications_flow.json,
 * _review_notifications_flow.json and _pipeline_notifications_flow.json (docs/sync/tools/test_capture_notifications.py,
 * test_capture_review_notifications.py, test_capture_pipeline_notifications.py).
 *
 * Every route answers the caller's own rows only, and only while the record a row is about is one they may open
 * now: another person's row, or one whose record they lost, is a 404. No permission code gates the inbox.
 */
import { apiClient } from '@/api/client/ApiClient';
import { createQueryKeys } from '@/shared/data/queryKeys';
import { listFetcher } from '@/shared/data/listing';

const BASE = '/api/v1/notifications';

/** What happened (C-RP-23). */
export const NOTIFICATION_KINDS = [
  'note_created',
  'note_mention',
  'note_reply',
  'note_status',
  'task_assigned',
  'task_status',
  'version_status',
  'review_media_ready',
  'review_media_failed',
  'review_decision',
  'review_invited',
  'review_verdict',
  'review_comment',
  // RP-13 (C-RP-35): deliveries, publishing, milestones
  'delivery_status',
  'delivery_client_answer',
  'publish_finished',
  'published_file_revoked',
  'milestone_due',
  'milestone_completed',
  // RP-19 (C-RP-50): to the reviewer of the version's task
  'review_media_to_review',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** The record a row opens: a note thread, a task, a version, a review, a delivery, a publish job, a published file or a milestone. */
export const NOTIFICATION_TARGET_TYPES = ['note', 'task', 'version', 'review', 'delivery', 'publish_job', 'published_file', 'milestone'] as const;
export type NotificationTargetType = (typeof NOTIFICATION_TARGET_TYPES)[number];

export interface NotificationActor {
  id: string;
  name: string;
}
export interface NotificationProject {
  id: string;
  code: string;
  name: string;
}
/**
 * Read from the live record when the inbox is answered: a note's `code` is "" and its `name` is its subject; a review's
 * `name` is its title; a published file's `code` is its version's code and its `name` the last part of its path; a
 * milestone's `code` is "" and its `name` its name (C-RP-34).
 */
export interface NotificationTarget {
  type: NotificationTargetType;
  id: string;
  code: string;
  name: string;
}
/** What the target is about (a note's first link, a task's or a version's shot or asset), or null. */
export interface NotificationRecord {
  type: string;
  id: string;
  code: string;
}
/**
 * `from_status`/`to_status` for the status kinds (and `delivery_status`), `error_code` for `review_media_failed`,
 * `to_status` for `review_decision`, `verdict` for `review_verdict`, `version_id` for `review_comment`, `client_status`
 * for `delivery_client_answer`, `status` for `publish_finished`, `stage` and `due_date` for `milestone_due`,
 * otherwise empty.
 */
export interface NotificationData {
  from_status?: string | null;
  to_status?: string | null;
  error_code?: string;
  verdict?: string | null;
  version_id?: string | null;
  client_status?: string | null;
  status?: string | null;
  stage?: 'due' | 'overdue' | null;
  /** An ISO date (`YYYY-MM-DD`), the milestone's due date when the reminder was written. */
  due_date?: string | null;
}
export interface Notification {
  id: string;
  kind: NotificationKind;
  created_at: string;
  /** null while unread. */
  read_at: string | null;
  /** null when the system did it (a review movie finished, a revoked file reopened a delivery, a milestone reminder). */
  actor: NotificationActor | null;
  project: NotificationProject;
  target: NotificationTarget;
  record: NotificationRecord | null;
  data: NotificationData;
}

export interface NotificationFilters {
  unread?: boolean;
  project_id?: string;
  kind?: NotificationKind;
  page?: number;
  page_size?: number;
}

/**
 * What the caller muted, and every kind that can be muted (C-RP-30): all kinds except `note_mention` and
 * `review_invited`, which ask the person to act. A muted kind is not written for them; unmuting brings nothing back.
 */
export interface NotificationPreferences {
  muted_kinds: NotificationKind[];
  mutable_kinds: NotificationKind[];
}

/** The browser checks the unread count this often while the tab is visible, and again on focus (Q-RP-36). */
export const UNREAD_POLL_MS = 60_000;

export const notificationsApi = {
  keys: { ...createQueryKeys('notifications'), unreadCount: () => ['notifications', 'unread-count'] as const, preferences: () => ['notifications', 'preferences'] as const },
  /** Newest first, paginated; an unknown filter value gives an empty page. */
  list: listFetcher<Notification>(`${BASE}/`),
  unreadCount: (signal?: AbortSignal) => apiClient.get<{ count: number }>(`${BASE}/unread-count/`, { signal }),
  read: (id: string) => apiClient.post<Notification>(`${BASE}/${id}/read/`, {}),
  unread: (id: string) => apiClient.post<Notification>(`${BASE}/${id}/unread/`, {}),
  /**
   * Marks the caller's unread rows created at or before `before` (default now) as read. Pass the newest
   * `created_at` the reader has seen, so a row that arrived since stays unread.
   */
  readAll: (before?: string) => apiClient.post<{ updated: number }>(`${BASE}/read-all/`, before ? { before } : {}),
  preferences: (signal?: AbortSignal) => apiClient.get<NotificationPreferences>(`${BASE}/preferences/`, { signal }),
  /** Replaces the muted kinds; an unknown kind or one that cannot be muted is a 400 on `muted_kinds`. */
  savePreferences: (mutedKinds: NotificationKind[]) => apiClient.put<NotificationPreferences>(`${BASE}/preferences/`, { muted_kinds: mutedKinds }),
};
