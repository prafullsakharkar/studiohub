import { mapHttpError } from '@/api/errors/errorMapper';
import { serverMessage } from '@/api/errors/serverMessage';

/**
 * The most specific sentence for a failed publishing call: a move the status does not allow says from where to
 * where, a path that is already registered with other content says so, an edit after the export ran says why.
 * Anything else is the server’s own sentence (a refused path names the rule it broke).
 */
export function publishErrorMessage(error: unknown): string {
  const e = mapHttpError(error);
  const body = (e.details ?? {}) as { from?: string; to?: string };
  if (e.code === 'invalid_transition' && body.from && body.to) return `That cannot be done from ${body.from} to ${body.to}. Reload to see where it is now.`;
  if (e.code === 'path_already_registered') return 'That path is already registered with different content. A path names its content for good: register the new file under a new path.';
  return serverMessage(error);
}
