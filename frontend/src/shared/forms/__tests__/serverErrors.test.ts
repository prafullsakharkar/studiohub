import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/errors/ApiError';
import { loadSample, type CapturedResponse } from '@/test/samples';
import { applyServerErrors, knownFieldPaths } from '../serverErrors';

const reset = loadSample('identity/_auth_password_reset_flow.json');
const mfa = loadSample('identity/_auth_mfa_flow.json');
const auth = loadSample('identity/_auth_flow.json');

const fromCapture = (c: CapturedResponse) => ApiError.fromDrfResponse(c.status, c.body as never, c.headers);

describe('knownFieldPaths', () => {
  it('lists nested paths', () => {
    expect(knownFieldPaths({ a: 1, b: { c: 2, d: { e: 3 } } })).toEqual(['a', 'b', 'b.c', 'b.d', 'b.d.e']);
  });
});

describe('applyServerErrors (real samples)', () => {
  it('maps field errors inline and leaves no banner', () => {
    const setError = vi.fn();
    const result = applyServerErrors(fromCapture(reset.reset_mismatch), setError, ['token', 'new_password', 'confirm_password']);
    expect(setError).toHaveBeenCalledWith('confirm_password', { type: 'server', message: 'Passwords do not match.' }, { shouldFocus: true });
    expect(result.banner).toBeUndefined();
    expect(result.details).toEqual([]);
    expect(result.status).toBe(400);
  });

  it('puts non-field errors in the details and keeps the request id', () => {
    const result = applyServerErrors(fromCapture(reset.reset_invalid_token), vi.fn(), ['token']);
    expect(result.details).toEqual(['Invalid or expired password reset token.']);
    expect(result.requestId).toBe('6a5958f3-1d5a-491b-909c-367c8ea04b8b');
  });

  it('never loses errors for fields the form does not have', () => {
    const setError = vi.fn();
    const result = applyServerErrors(fromCapture(reset.reset_missing_fields), setError, ['token']);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(result.details).toEqual(['new password: This field is required.', 'confirm password: This field is required.']);
  });

  it('honours a field map (backend name -> form name)', () => {
    const setError = vi.fn();
    applyServerErrors(fromCapture(reset.reset_mismatch), setError, ['password', 'confirm'], {
      fieldMap: { confirm_password: 'confirm' },
    });
    expect(setError).toHaveBeenCalledWith('confirm', expect.anything(), expect.anything());
  });

  it('401 wrong credentials: banner carries the backend text, not the generic one', () => {
    const result = applyServerErrors(fromCapture(auth.login_bad_password), vi.fn(), ['email', 'password']);
    expect(result.banner).toBe('Invalid username or password.');
  });

  it('401 wrong MFA code: banner is the backend text', () => {
    const result = applyServerErrors(fromCapture(mfa.challenge_wrong_code), vi.fn(), ['code']);
    expect(result.banner).toBe('Invalid verification code.');
  });

  it('5xx and network failures use the friendly message', () => {
    const server = applyServerErrors(ApiError.fromDrfResponse(500, { detail: 'Traceback…' }), vi.fn(), []);
    expect(server.banner).toBe('Something went wrong on the server. Please try again.');
    const network = applyServerErrors(new ApiError('x', 0, {}, { type: 'NETWORK' }), vi.fn(), []);
    expect(network.banner).toMatch(/Unable to connect/);
  });

  it('429 exposes retry-after seconds', () => {
    const result = applyServerErrors(ApiError.fromDrfResponse(429, { detail: 'Slow down.' }, { 'retry-after': '30' }), vi.fn(), []);
    expect(result.retryAfterSeconds).toBe(30);
    expect(result.banner).toBe('Slow down.');
  });

  it('unknown thrown values become a generic banner', () => {
    const result = applyServerErrors(new Error('boom'), vi.fn(), []);
    expect(result.banner).toBeTruthy();
  });
});
