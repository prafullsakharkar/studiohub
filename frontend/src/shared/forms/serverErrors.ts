import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { mapHttpError } from '@/api/errors/errorMapper';

export interface ServerFormError {
  /** Message for the form-level banner; undefined when everything landed on a field. */
  banner?: string;
  /** Extra detail lines (non-field errors, and field errors for fields not on this form). */
  details: string[];
  requestId?: string;
  retryAfterSeconds?: number;
  status: number;
}

export interface ApplyServerErrorsOptions {
  /** Backend field name -> form field name, for forms whose inputs are named differently. */
  fieldMap?: Record<string, string>;
}

/** All dotted paths present in a values object, e.g. `{a: {b: 1}}` -> `['a', 'a.b']`. */
export function knownFieldPaths(values: unknown, prefix = ''): string[] {
  if (values === null || typeof values !== 'object' || values instanceof Date || values instanceof File) return [];
  const paths: string[] = [];
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path, ...knownFieldPaths(value, path));
  }
  return paths;
}

const humanize = (field: string) => field.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Put a failed request's errors onto the form.
 *
 * - field errors on a field this form has -> `setError` (shown inline, focus moves to the first one)
 * - field errors for fields the form does not have -> listed in the banner details, never lost
 * - non-field errors / `detail` -> banner
 * - 5xx, network and timeout -> the friendly message (the raw server text is not useful to the user)
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
  options: ApplyServerErrorsOptions = {}
): ServerFormError {
  const apiError = mapHttpError(error);
  const known = new Set(knownFields);
  const details: string[] = [...apiError.nonFieldErrors];
  let focused = false;

  for (const [backendField, messages] of Object.entries(apiError.fieldErrors)) {
    const field = options.fieldMap?.[backendField] ?? backendField;
    if (known.has(field)) {
      setError(field as Path<T>, { type: 'server', message: messages.join(' ') }, { shouldFocus: !focused });
      focused = true;
    } else {
      details.push(`${humanize(backendField)}: ${messages.join(' ')}`);
    }
  }

  const transient = apiError.status === 0 || apiError.status >= 500 || apiError.type === 'TIMEOUT';
  let banner: string | undefined;
  if (transient) {
    banner = apiError.userMessage;
  } else if (apiError.isValidationError) {
    // Inline errors say it all; only surface a banner when something is not on a field.
    banner = details.length === 0 && !focused ? apiError.message : undefined;
  } else {
    banner = apiError.message;
  }

  return {
    banner,
    details: apiError.isValidationError && !transient ? details : [],
    requestId: apiError.requestId,
    retryAfterSeconds: apiError.retryAfterMs !== undefined ? Math.ceil(apiError.retryAfterMs / 1000) : undefined,
    status: apiError.status,
  };
}
