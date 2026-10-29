import { describe, expect, it } from 'vitest';
import { loadSample, type CapturedResponse } from '@/test/samples';
import { ApiError } from '../ApiError';
import { normalizeApiError, parseRetryAfter } from '../normalizeApiError';

// `page_out_of_range` is stored as a bare body; the other entries are {status, headers, body}.
const conflicts = loadSample<Record<string, CapturedResponse & Record<string, unknown>>>('_misc/conflicts_and_pagination.json');
const auth = loadSample('identity/_auth_flow.json');

const fromCapture = (c: CapturedResponse) => normalizeApiError(c.status, c.body, c.headers);

describe('normalizeApiError — real backend samples', () => {
  it('400 flat field errors keep the field map and take code/request id from the envelope', () => {
    const n = fromCapture(conflicts.project_create_duplicate_code);
    expect(n.status).toBe(400);
    expect(n.fieldErrors).toEqual({ code: ['project with this code already exists.'] });
    expect(n.nonFieldErrors).toEqual([]);
    expect(n.code).toBe('validation_error');
    expect(n.requestId).toBe('ab7683e0-b6ae-42e2-943e-0cb4196209ed');
    expect(n.message).toBe('The submitted data is invalid.');
  });

  it('400 missing required fields maps each field', () => {
    const n = fromCapture(auth.login_missing_fields);
    expect(Object.keys(n.fieldErrors).sort()).toEqual(['email', 'password']);
    expect(n.fieldErrors.email).toEqual(['This field is required.']);
  });

  it('401 detail error becomes the message with its code', () => {
    const n = fromCapture(auth.login_bad_password);
    expect(n.message).toBe('Invalid username or password.');
    expect(n.code).toBe('authentication_failed');
    expect(n.fieldErrors).toEqual({});
  });

  it('401 SimpleJWT body ignores `messages` and keeps token_not_valid', () => {
    const n = fromCapture(auth.me_bad_token);
    expect(n.code).toBe('token_not_valid');
    expect(n.message).toBe('Given token not valid for any token type');
    expect(n.fieldErrors).toEqual({});
  });

  it('401 session_expired is distinguishable by code', () => {
    const n = fromCapture(auth.me_after_logout);
    expect(n.code).toBe('session_expired');
    expect(ApiError.fromDrfResponse(401, auth.me_after_logout.body as never).type).toBe('SESSION_EXPIRED');
  });

  it('405 carries the detail text', () => {
    const n = fromCapture(conflicts.method_not_allowed);
    expect(n.status).toBe(405);
    expect(n.message).toBe('Method "PATCH" not allowed.');
    expect(n.code).toBe('method_not_allowed');
  });

  it('409 has_dependants exposes the dependants text and code', () => {
    const n = fromCapture(conflicts.department_delete_referenced);
    expect(n.status).toBe(409);
    expect(n.code).toBe('has_dependants');
    expect(n.message).toContain('masterdata.Position.department (2)');
  });

  it('404 invalid page keeps detail + not_found code', () => {
    const n = normalizeApiError(404, conflicts.page_out_of_range);
    expect(n.message).toBe('Invalid page.');
    expect(n.code).toBe('not_found');
  });
});

describe('normalizeApiError — shapes not in the captures', () => {
  it('flattens nested and many=True serializer errors into dotted paths', () => {
    const n = normalizeApiError(400, {
      name: ['Required.'],
      items: [{}, { qty: ['Must be positive.'], meta: { sku: ['Unknown.'] } }],
      address: { non_field_errors: ['Incomplete.'] },
    });
    expect(n.fieldErrors).toEqual({
      name: ['Required.'],
      'items.1.qty': ['Must be positive.'],
      'items.1.meta.sku': ['Unknown.'],
      address: ['Incomplete.'],
    });
  });

  it('collects non_field_errors and uses them as the message', () => {
    const n = normalizeApiError(400, { non_field_errors: ['Passwords do not match.'], password: ['Too short.'] });
    expect(n.nonFieldErrors).toEqual(['Passwords do not match.']);
    expect(n.fieldErrors).toEqual({ password: ['Too short.'] });
    expect(n.message).toBe('Passwords do not match.');
  });

  it('treats a bare array body as non-field errors', () => {
    expect(normalizeApiError(400, ['Bad thing.']).nonFieldErrors).toEqual(['Bad thing.']);
  });

  it('does not use proxy HTML as a message (413 / 502)', () => {
    const n = normalizeApiError(413, '<html><body>413 Request Entity Too Large</body></html>');
    expect(n.message).toBe('The upload is too large.');
    expect(normalizeApiError(502, '<!DOCTYPE html><html></html>').message).toBe('The server failed to handle the request.');
  });

  it('429 reads Retry-After seconds from the header', () => {
    const n = normalizeApiError(429, { detail: 'Request was throttled.' }, { 'Retry-After': '30' });
    expect(n.retryAfter).toBe(30);
  });

  it('429 falls back to the DRF throttle text when the header is absent', () => {
    const n = normalizeApiError(429, { detail: 'Request was throttled. Expected available in 12 seconds.' });
    expect(n.retryAfter).toBe(12);
  });

  it('reads headers from a Headers instance', () => {
    const n = normalizeApiError(503, null, new Headers({ 'X-Request-ID': 'abc', 'Retry-After': '5' }));
    expect(n.requestId).toBe('abc');
    expect(n.retryAfter).toBe(5);
  });

  it('empty 5xx body gets a generic message', () => {
    expect(normalizeApiError(500, null).message).toBe('The server failed to handle the request.');
  });
});

describe('parseRetryAfter', () => {
  it('parses seconds and HTTP dates, rejects junk', () => {
    expect(parseRetryAfter('120')).toBe(120);
    const now = Date.parse('2026-10-29T10:00:00Z');
    expect(parseRetryAfter('Thu, 29 Oct 2026 10:01:30 GMT', now)).toBe(90);
    expect(parseRetryAfter('Thu, 29 Oct 2026 09:00:00 GMT', now)).toBe(0);
    expect(parseRetryAfter('soon')).toBeUndefined();
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});

describe('ApiError.fromDrfResponse', () => {
  it('maps status classes to types and carries the normalized fields', () => {
    const cases: Array<[number, string]> = [
      [400, 'VALIDATION'], [401, 'AUTHENTICATION'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'],
      [409, 'CONFLICT'], [413, 'PAYLOAD_TOO_LARGE'], [429, 'RATE_LIMIT'], [500, 'SERVER'],
      [502, 'BAD_GATEWAY'], [503, 'SERVICE_UNAVAILABLE'],
    ];
    for (const [status, type] of cases) {
      expect(ApiError.fromDrfResponse(status, { detail: 'x' }).type).toBe(type);
    }
    const err = ApiError.fromDrfResponse(429, { detail: 'slow down' }, { 'retry-after': '7' });
    expect(err.retryAfterMs).toBe(7000);
    expect(err.retryable).toBe(true);
    const v = ApiError.fromDrfResponse(400, { non_field_errors: ['no'], a: ['b'] });
    expect(v.nonFieldErrors).toEqual(['no']);
    expect(v.getFieldErrors('a')).toEqual(['b']);
  });
});
