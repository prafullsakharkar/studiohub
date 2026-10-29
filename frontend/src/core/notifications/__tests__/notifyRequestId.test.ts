import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '@/api/errors/ApiError';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { notify } from '../notify';

const last = () => {
  const state = useNotificationStore.getState() as unknown as { notifications: Array<{ message: string }> };
  return state.notifications[0];
};

beforeEach(() => useNotificationStore.setState({ notifications: [] } as never));

describe('notify.fromError', () => {
  it('adds the request id to server failures so support can find the log line', () => {
    notify.fromError(ApiError.fromDrfResponse(500, { detail: 'boom', error: { code: 'server_error', request_id: 'req-9' } }));
    expect(last().message).toContain('(Ref: req-9)');
  });

  it('does not add it to errors the user can fix themselves', () => {
    notify.fromError(ApiError.fromDrfResponse(400, { name: ['Required.'], error: { code: 'validation_error', request_id: 'req-8' } }));
    expect(last().message).not.toContain('req-8');
  });
});
