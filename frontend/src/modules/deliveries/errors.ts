import { mapHttpError } from '@/api/errors/errorMapper';
import { serverMessage } from '@/api/errors/serverMessage';

/** The quality checks by name, as a person would say them. */
export const CHECK_LABELS: Record<string, string> = {
  has_items: 'The delivery has items',
  same_project: 'The version belongs to this project',
  version_published: 'The version is published',
  files_present: 'The version has registered files',
  checksum_ok: 'The files match their checksums',
  snapshot_current: 'The snapshot is up to date',
  not_revoked: 'No file was revoked',
};
export const checkLabel = (name: string) => CHECK_LABELS[name] ?? name.replace(/_/g, ' ');

/** Why a version cannot be added (the `reason` code next to the generic sentence). */
const UNDELIVERABLE: Record<string, string> = {
  not_published: 'That version is not published. Publish it first.',
  no_registered_files: 'That version has no registered files to deliver.',
  checksum_problem: 'A file of that version is missing or does not match its checksum.',
  unknown_version: 'That is not a version of this delivery’s project.',
};

/**
 * The most specific sentence for a failed delivery call: a failed quality check lists what failed, a refused
 * version says why, a move the status does not allow says from where to where. Anything else is the server’s
 * own sentence.
 */
export function deliveryErrorMessage(error: unknown): string {
  const e = mapHttpError(error);
  const body = (e.details ?? {}) as { code?: string; checks?: Array<{ check: string; detail: string }>; from?: string; to?: string };
  if (body.code === 'qc_failed' && Array.isArray(body.checks) && body.checks.length > 0) {
    return `The quality checks failed: ${body.checks.map((c) => `${checkLabel(c.check)}${c.detail ? ` (${c.detail})` : ''}`).join('; ')}.`;
  }
  const reason = e.fieldErrors.reason?.[0];
  if (reason && UNDELIVERABLE[reason]) return UNDELIVERABLE[reason];
  if (e.code === 'invalid_transition' && body.from && body.to) return `A delivery cannot go from ${body.from} to ${body.to}. Reload to see where it is now.`;
  return serverMessage(error);
}

/** Removing an item that quality checks already ran on is a generic 409 `conflict` (CR-20). */
export function removeItemMessage(error: unknown): string {
  return mapHttpError(error).code === 'conflict' ? 'This item has been checked, so it can no longer be removed. Cancel the delivery and start a new one.' : deliveryErrorMessage(error);
}
