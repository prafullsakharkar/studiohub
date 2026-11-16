import { formatDate } from '@/core/locale/studioLocale';
import type { Notification } from '@/api/notifications/notifications';

/** The words for a review movie's failure codes (C-RP-20); the server's own message is on the version's Media tab. */
const MEDIA_FAILURES: Record<string, string> = {
  probe_failed: 'the file could not be read',
  unsupported_stream: 'its picture is not supported',
  transcode_failed: 'the proxy could not be made',
  timeout: 'it took too long',
  source_missing: 'the upload is missing',
};

/** A calendar day (`YYYY-MM-DD`) in the studio's date format, read as that day wherever the browser is (not UTC midnight). */
function day(iso: string | null | undefined): string {
  const [y, m, d] = (iso ?? '').slice(0, 10).split('-').map(Number);
  return y && m && d ? formatDate(new Date(y, m - 1, d)) : '—';
}

/** What a row says, in one line: who did what to which record. */
export function describeNotification(n: Notification): string {
  const who = n.actor?.name || 'Someone';
  const target = n.target.code || n.target.name || 'a record';
  const subject = n.target.name ? `“${n.target.name}”` : 'a note';
  const moved = `${n.data.from_status ?? '—'} → ${n.data.to_status ?? '—'}`;
  switch (n.kind) {
    case 'note_created':
      return `${who} wrote a note on your work: ${subject}`;
    case 'note_mention':
      return `${who} mentioned you in ${subject}`;
    case 'note_reply':
      return `${who} replied in ${subject}`;
    case 'note_status':
      return `${who} moved ${subject} ${moved}`;
    case 'task_assigned':
      return `${who} assigned you ${target}`;
    case 'task_status':
      return `${who} moved your task ${target} ${moved}`;
    case 'version_status':
      return `${who} moved your version ${target} ${moved}`;
    case 'review_media_ready':
      return `The review movie of ${target} is ready`;
    case 'review_media_failed':
      return `The review movie of ${target} failed: ${MEDIA_FAILURES[n.data.error_code ?? ''] ?? 'it could not be processed'}`;
    case 'review_decision':
      return `${who} decided ${target}: ${n.data.to_status ?? '—'}`;
    case 'review_invited':
      return `${who} asked for your verdict on ${target}`;
    case 'review_verdict':
      return `${who} gave a verdict on ${target}: ${n.data.verdict ?? '—'}`;
    case 'review_comment':
      return `${who} commented on your work in ${target}`;
    case 'delivery_status':
      return n.actor ? `${who} moved the delivery ${target} ${moved}` : `The delivery ${target} moved ${moved}: a file in it was revoked`;
    case 'delivery_client_answer':
      return `The client's answer on ${target} was recorded: ${n.data.client_status ?? '—'}`;
    case 'publish_finished':
      return n.data.status === 'Failed' ? `The publish job ${target} failed` : `The publish job ${target} was exported`;
    case 'published_file_revoked':
      return `${who} revoked ${n.target.name || 'a file'}${n.target.code ? ` of ${n.target.code}` : ''}`;
    case 'milestone_due':
      return n.data.stage === 'overdue'
        ? `The milestone “${n.target.name}” is overdue (due ${day(n.data.due_date)})`
        : `The milestone “${n.target.name}” is due ${day(n.data.due_date)}`;
    case 'milestone_completed':
      return `${who} completed the milestone “${n.target.name}”`;
    default:
      return `${who} changed ${target}`;
  }
}

/**
 * Where a row leads. A note opens the Notes tab of the record it is about (its first link), or the project's;
 * a task its page; a version its page (the Media tab for a review movie); a review its page (RP-11, C-RP-28);
 * a delivery, a publish job and a published file their pages, a milestone its project's Schedule tab (RP-13, C-RP-34).
 */
export function notificationPath(n: Notification): string {
  const { target, record, project } = n;
  if (target.type === 'review') return `/reviews/${target.id}`;
  if (target.type === 'delivery') return `/deliveries/${target.id}`;
  if (target.type === 'publish_job') return `/publishing/${target.id}`;
  if (target.type === 'published_file') return `/publishing/files/${target.id}`;
  if (target.type === 'milestone') return `/projects/${project.id}/schedule`;
  if (target.type === 'task') return `/tasks/${target.id}`;
  if (target.type === 'version') {
    return n.kind === 'review_media_ready' || n.kind === 'review_media_failed' ? `/versions/${target.id}?tab=media` : `/versions/${target.id}`;
  }
  switch (record?.type) {
    case 'Shot':
      return `/projects/${project.id}/shots/${record.id}/notes`;
    case 'Asset':
      return `/projects/${project.id}/assets/${record.id}/notes`;
    case 'Version':
      return `/versions/${record.id}?tab=notes`;
    default:
      return `/projects/${project.id}/notes`;
  }
}
