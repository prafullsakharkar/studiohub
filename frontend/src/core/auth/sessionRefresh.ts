import { ApiError } from '@/api/errors/ApiError';
import { getApiBaseUrl } from '@/api/client/config';
import { logger } from '@/core/logging/logger';
import { tokenStorage } from './tokenStorage';
import { withRefreshLock } from './refreshLock';

const REFRESH_PATH = '/api/v1/auth/refresh/';

/** Statuses that mean the refresh token itself is no good (revoked, reused, expired, garbage). */
const DEFINITIVE_FAILURES = new Set([400, 401, 403]);

let inFlight: Promise<string> | null = null;

async function callRefreshEndpoint(refresh: string): Promise<{ access: string; refresh?: string }> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${REFRESH_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh }),
    });
  } catch (cause) {
    throw new ApiError('Network connection failure. Unable to reach StudioHub server.', 0, {}, {
      type: 'NETWORK',
      originalError: cause,
    });
  }

  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    throw ApiError.fromDrfResponse(response.status, body, response.headers);
  }
  return body as { access: string; refresh?: string };
}

async function refreshUnderLock(staleAccessToken: string | null): Promise<string> {
  return withRefreshLock(async () => {
    // Another request in this tab, or another tab (via the broadcast), may already have
    // refreshed while we waited for the lock.
    const current = tokenStorage.getAccessToken();
    if (current && current !== staleAccessToken) return current;

    // Read inside the lock: this is the latest rotated token, shared through localStorage.
    const refresh = tokenStorage.getRefreshToken();
    if (!refresh) {
      throw new ApiError('No refresh token available.', 401, {}, { type: 'SESSION_EXPIRED' });
    }

    try {
      const tokens = await callRefreshEndpoint(refresh);
      // The backend rotates on every refresh: persist the new one before releasing the lock.
      if (tokens.refresh) tokenStorage.setRefreshToken(tokens.refresh);
      tokenStorage.setAccessToken(tokens.access);
      logger.info('SessionRefresh', 'Access token refreshed');
      return tokens.access;
    } catch (error) {
      if (error instanceof ApiError && DEFINITIVE_FAILURES.has(error.status)) {
        logger.warn('SessionRefresh', `Refresh rejected (${error.status}); ending session`);
        tokenStorage.clearTokens();
      }
      // Network errors, 429 and 5xx keep the session: the refresh token is still valid.
      throw error;
    }
  });
}

/**
 * Exchange the refresh token for a new access token.
 *
 * Single flight per tab (every waiter shares one promise, and all of them reject if it
 * fails) and mutually exclusive across tabs. `staleAccessToken` is the token the failed
 * request carried; if a newer one is already available it is returned without a network call.
 */
export function refreshAccessToken(staleAccessToken: string | null = tokenStorage.getAccessToken()): Promise<string> {
  if (!inFlight) {
    inFlight = refreshUnderLock(staleAccessToken).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Test seam. */
export function __resetSessionRefreshForTests(): void {
  inFlight = null;
}
