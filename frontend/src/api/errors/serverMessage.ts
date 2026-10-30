import { mapHttpError } from './errorMapper';

/** A refusal made in the browser before any request (a missing reason, an unchosen date); its text is shown as written. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

/**
 * The most specific sentence for a failed action: the server's own validation message when it sent one
 * ("A task cannot move from 'In Progress' to 'Approved'."), else the general description of the failure.
 */
export function serverMessage(error: unknown): string {
  if (error instanceof InputError) return error.message;
  const e = mapHttpError(error);
  // The first field that has a message, with all of its messages (a field can have several).
  const specific = e.nonFieldErrors.join(' ') || Object.entries(e.fieldErrors).filter(([field]) => field !== 'error').map(([, messages]) => messages.join(' ')).find(Boolean);
  if (specific) return specific;
  // A refusal that is a business rule carries its sentence in `detail` ("You cannot approve a review you produced.");
  // the generic user message for a 403 would hide why. Deletes blocked by references keep their own lead-in.
  const body = e.details as { detail?: unknown } | undefined;
  const detail = body && typeof body === 'object' && body.detail !== undefined ? (Array.isArray(body.detail) ? body.detail.join(' ') : String(body.detail)) : '';
  if (detail && e.code !== 'has_dependants') return detail;
  return e.userMessage || e.message;
}
