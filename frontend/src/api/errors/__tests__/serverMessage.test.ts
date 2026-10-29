import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import { InputError, serverMessage } from '../serverMessage';

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

const fail = async (status: number, body: unknown) => {
  mockFetch(() => ({ status, body }));
  return apiClient.post('/api/v1/anything/', {}).catch((e) => e);
};

describe('serverMessage: the most specific sentence for a failed action', () => {
  it('a business-rule refusal shows its own sentence, not the generic permission text', async () => {
    expect(serverMessage(await fail(403, { detail: 'You cannot approve a review you produced.', error: { code: 'separation_of_duties' } }))).toBe('You cannot approve a review you produced.');
  });

  it('a validation message on a field is shown as the server wrote it', async () => {
    expect(serverMessage(await fail(400, { status: ["A task cannot move from 'In Progress' to 'Approved'."], error: { code: 'invalid_transition' } }))).toBe("A task cannot move from 'In Progress' to 'Approved'.");
  });

  it('a detail given as a list is joined', async () => {
    expect(serverMessage(await fail(400, { detail: ['A published version cannot be archived or deleted.', 'Unpublish it first.'], error: { code: 'validation_error' } }))).toBe('A published version cannot be archived or deleted. Unpublish it first.');
  });

  it('a delete blocked by references keeps its own lead-in', async () => {
    const message = serverMessage(await fail(409, { detail: '2 contracts still use it.', error: { code: 'has_dependants' } }));
    expect(message).toMatch(/still in use and cannot be deleted/);
    expect(message).toMatch(/2 contracts still use it/);
  });

  it('a refusal made in the browser is shown as written; anything else falls back to the general description', async () => {
    expect(serverMessage(new InputError('Enter a reason.'))).toBe('Enter a reason.');
    expect(serverMessage(await fail(500, {}))).not.toBe('');
  });
});
