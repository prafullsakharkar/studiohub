/**
 * Pure parser for the backend's error bodies.
 *
 * Shapes handled (all verified against docs/sync/samples/):
 *   - flat DRF field errors      {"code": ["..."], "error": {"code", "request_id"}}
 *   - detail errors              {"detail": "...", "error": {"code", "request_id"}}
 *   - SimpleJWT                  {"detail", "code", "messages": [...], "error": {...}}
 *   - nested / many=True errors  {"items": [{}, {"qty": ["..."]}]}
 *   - non_field_errors and bare-array bodies
 *   - non-JSON bodies (proxy HTML pages for 413/502/503)
 */

export interface NormalizedError {
  status: number;
  message: string;
  /** Dotted field path → messages, e.g. `{ "items.1.qty": ["..."] }`. */
  fieldErrors: Record<string, string[]>;
  nonFieldErrors: string[];
  code?: string;
  requestId?: string;
  /** Seconds the client should wait (429 / 503). */
  retryAfter?: number;
}

type HeaderSource = Headers | Record<string, string | null | undefined> | undefined;

/**
 * Keys that are envelope metadata *only when they hold a scalar/envelope value*.
 * A model field can legitimately be called `code` or `message`; DRF then reports it as
 * `{"code": ["..."]}` (verified: project duplicate-code sample), which is a field error.
 */
function isEnvelopeKey(key: string, value: unknown, body: Record<string, unknown>): boolean {
  switch (key) {
    case 'non_field_errors':
      return true;
    case 'detail':
    case 'code':
    case 'error_code':
    case 'message':
      return typeof value === 'string';
    case 'error':
      return isPlainObject(value) && (typeof value.code === 'string' || typeof value.request_id === 'string');
    case 'messages':
      // SimpleJWT: {"detail", "code": "token_not_valid", "messages": [{token_class, ...}]}
      return typeof body.code === 'string' && Array.isArray(value);
    default:
      return false;
  }
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'The submitted data is invalid.',
  401: 'Authentication required.',
  403: "You don't have permission to perform this action.",
  404: 'The requested resource was not found.',
  405: 'This action is not allowed.',
  409: 'The request conflicts with the current state of the record.',
  413: 'The upload is too large.',
  423: 'The account is locked.',
  429: 'Too many requests.',
};

function readHeader(headers: HeaderSource, name: string): string | undefined {
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? undefined;
  }
  const record = headers as Record<string, string | null | undefined>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? (record[key] ?? undefined) : undefined;
}

/** `Retry-After` is either delta-seconds or an HTTP date (RFC 9110 §10.2.3). */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

function toMessages(value: unknown): string[] {
  if (typeof value === 'string') return value ? [value] : [];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(toMessages);
  return [];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Flatten DRF's nested error structure into dotted paths. */
function collectFieldErrors(path: string, value: unknown, out: Record<string, string[]>): void {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const msgs = toMessages(value);
    if (msgs.length) out[path] = [...(out[path] ?? []), ...msgs];
    return;
  }
  if (Array.isArray(value)) {
    // A list of strings is a field's messages; a list of objects is a many=True serializer
    // (entries for valid rows are `{}`), keyed by index.
    if (value.every((v) => !isPlainObject(v) && !Array.isArray(v))) {
      const msgs = toMessages(value);
      if (msgs.length) out[path] = [...(out[path] ?? []), ...msgs];
      return;
    }
    value.forEach((item, index) => collectFieldErrors(`${path}.${index}`, item, out));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'non_field_errors') {
        const msgs = toMessages(child);
        if (msgs.length) out[path] = [...(out[path] ?? []), ...msgs];
      } else {
        collectFieldErrors(`${path}.${key}`, child, out);
      }
    }
  }
}

function looksLikeHtml(text: string): boolean {
  return /^\s*<(!doctype|html|head|body)/i.test(text);
}

/** DRF throttling: "Request was throttled. Expected available in 12 seconds." */
function retryAfterFromDetail(detail: string): number | undefined {
  const match = /available in (\d+) second/i.exec(detail);
  return match ? Number(match[1]) : undefined;
}

export function normalizeApiError(status: number, body: unknown, headers?: HeaderSource): NormalizedError {
  const result: NormalizedError = {
    status,
    message: '',
    fieldErrors: {},
    nonFieldErrors: [],
    requestId: readHeader(headers, 'x-request-id') ?? readHeader(headers, 'x-correlation-id') ?? undefined,
    retryAfter: parseRetryAfter(readHeader(headers, 'retry-after')),
  };

  let detail: string | undefined;

  if (typeof body === 'string') {
    if (body.trim() && !looksLikeHtml(body)) detail = body.trim();
  } else if (Array.isArray(body)) {
    result.nonFieldErrors.push(...toMessages(body));
  } else if (isPlainObject(body)) {
    const envelope = isEnvelopeKey('error', body.error, body) && isPlainObject(body.error) ? body.error : undefined;
    const rawCode = envelope?.code ?? (typeof body.code === 'string' ? body.code : body.error_code);
    if (typeof rawCode === 'string' && rawCode) result.code = rawCode;
    if (typeof envelope?.request_id === 'string' && envelope.request_id) {
      result.requestId = envelope.request_id;
    }

    if (typeof body.detail === 'string') detail = body.detail;
    else if (body.detail !== undefined) detail = toMessages(body.detail).join(' ') || undefined;
    else if (typeof body.message === 'string') detail = body.message;

    result.nonFieldErrors.push(...toMessages(body.non_field_errors));

    for (const [key, value] of Object.entries(body)) {
      if (isEnvelopeKey(key, value, body)) continue;
      collectFieldErrors(key, value, result.fieldErrors);
    }
  }

  if (result.retryAfter === undefined && status === 429 && detail) {
    result.retryAfter = retryAfterFromDetail(detail);
  }

  result.message =
    detail ??
    (result.nonFieldErrors.length ? result.nonFieldErrors.join(' ') : undefined) ??
    DEFAULT_MESSAGES[status] ??
    (status >= 500 ? 'The server failed to handle the request.' : 'The request failed.');

  return result;
}
