import type { Notification } from '@/api/notifications/notifications';

/** The words for a review movie's failure codes (C-RP-20); the server's own message is on the version's Media tab. */
const MEDIA_FAILURES: Record<string, string> = {
  probe_failed: 'the file could not be read',
  unsupported_stream: 'its picture is not supported',
  transcode_failed: 'the proxy could not be made',
  timeout: 'it took too long',
  source_missing: 'the upload is missing',
};

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
    default:
      return `${who} changed ${target}`;
  }
}

/**
 * Where a row leads. A note opens the Notes tab of the record it is about (its first link), or the project's;
 * a task its page; a version its page (the Media tab for a review movie).
 */
export function notificationPath(n: Notification): string {
  const { target, record, project } = n;
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
