/**
 * Cross-tab mutual exclusion for the token refresh.
 *
 * The backend rotates refresh tokens and revokes the whole session when a rotated token is
 * presented again, so two tabs must never refresh with the same token at the same time.
 *
 * `navigator.locks` is used where available. It only exists in secure contexts (https or
 * localhost), so plain-http deployments fall back to a localStorage lease.
 */

const LOCK_NAME = 'studiohub-token-refresh';
const LEASE_KEY = 'studiohub_refresh_lease';
const LEASE_TTL_MS = 15_000;
const LEASE_POLL_MS = 50;
const LEASE_MAX_WAIT_MS = 20_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function readLease(): { owner: string; expires: number } | null {
  try {
    const raw = localStorage.getItem(LEASE_KEY);
    return raw ? (JSON.parse(raw) as { owner: string; expires: number }) : null;
  } catch {
    return null;
  }
}

async function withLeaseLock<T>(fn: () => Promise<T>): Promise<T> {
  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + LEASE_MAX_WAIT_MS;

  for (;;) {
    const lease = readLease();
    if (!lease || lease.expires < Date.now()) {
      try {
        localStorage.setItem(LEASE_KEY, JSON.stringify({ owner, expires: Date.now() + LEASE_TTL_MS }));
      } catch {
        return fn(); // Storage unavailable: nothing to coordinate through.
      }
      // Read back after a beat: if two tabs wrote at once, only the last writer still owns it.
      await sleep(LEASE_POLL_MS);
      if (readLease()?.owner === owner) break;
    }
    if (Date.now() > deadline) break; // A stuck lease must not block the app forever.
    await sleep(LEASE_POLL_MS);
  }

  try {
    return await fn();
  } finally {
    if (readLease()?.owner === owner) {
      try {
        localStorage.removeItem(LEASE_KEY);
      } catch {
        // ignore
      }
    }
  }
}

export function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks?.request) {
    return locks.request(LOCK_NAME, fn) as Promise<T>;
  }
  return withLeaseLock(fn);
}
