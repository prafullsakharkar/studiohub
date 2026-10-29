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
  const specific = [...e.nonFieldErrors, ...Object.entries(e.fieldErrors).filter(([field]) => field !== 'error').flatMap(([, messages]) => messages)].find(Boolean);
  return specific || e.userMessage || e.message;
}
