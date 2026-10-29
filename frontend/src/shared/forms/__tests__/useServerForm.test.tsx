import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/errors/ApiError';
import { loadSample } from '@/test/samples';
import { useServerForm } from '../useServerForm';

const reset = loadSample('identity/_auth_password_reset_flow.json');
const failWith = (key: keyof typeof reset) => () => {
  throw ApiError.fromDrfResponse(reset[key].status, reset[key].body as never, reset[key].headers);
};

const setup = () =>
  renderHook(() => {
    const form = useServerForm<{ token: string; new_password: string; confirm_password: string }>({
      defaultValues: { token: 't', new_password: 'a', confirm_password: 'b' },
    });
    // formState is a subscription proxy: errors must be read during render to be tracked.
    return { ...form, errors: form.formState.errors };
  });

describe('useServerForm', () => {
  it('maps a field error inline and leaves serverError empty', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.submit(failWith('reset_mismatch'))();
    });
    expect(result.current.errors.confirm_password?.message).toBe('Passwords do not match.');
    expect(result.current.serverError).toBeNull();
  });

  it('surfaces non-field errors as serverError details', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.submit(failWith('reset_invalid_token'))();
    });
    expect(result.current.serverError?.details).toEqual(['Invalid or expired password reset token.']);
  });

  it('clears the previous server error on the next successful submit and calls onError otherwise', async () => {
    const { result } = setup();
    const seen: unknown[] = [];
    await act(async () => {
      await result.current.submit(failWith('reset_invalid_token'), (e) => seen.push(e))();
    });
    expect(seen).toHaveLength(1);
    await act(async () => {
      await result.current.submit(async () => {})();
    });
    expect(result.current.serverError).toBeNull();
  });
});
