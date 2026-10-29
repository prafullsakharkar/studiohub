import { AuthTokens } from '@/types/identity';

/**
 * Token storage (docs/sync decision Q6).
 *
 * - Access token: memory only. Never persisted, so an XSS read of storage does not yield a
 *   usable bearer token. A new tab starts without one and obtains it through a refresh.
 * - Refresh token: `localStorage`, which is what lets tabs share one session and lets the
 *   cross-tab refresh lock always rotate from the *latest* token (the backend revokes the
 *   whole session if an already-rotated refresh token is presented again).
 * - A BroadcastChannel tells other tabs about rotated access tokens and logouts.
 */

const REFRESH_TOKEN_KEY = 'studiohub_refresh_token';
/** Legacy key from before Q6; removed on load so old installs stop persisting access tokens. */
const LEGACY_ACCESS_TOKEN_KEY = 'studiohub_access_token';
const CHANNEL_NAME = 'studiohub-auth';

export type TokenEvent =
  | { type: 'access'; token: string }
  /** Tokens were cleared (logout or session loss), possibly in another tab. */
  | { type: 'cleared'; remote: boolean };

type Listener = (event: TokenEvent) => void;
type ChannelMessage = { type: 'access'; token: string } | { type: 'logout' };

let accessToken: string | null = null;
const listeners = new Set<Listener>();

function emit(event: TokenEvent): void {
  listeners.forEach((listener) => listener(event));
}

function readRefresh(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeRefresh(token: string | null): void {
  try {
    if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode / non-browser): the session lives for this tab only.
  }
}

let channel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (message: MessageEvent<ChannelMessage>) => {
      const data = message.data;
      if (data?.type === 'access' && typeof data.token === 'string') {
        accessToken = data.token;
        emit({ type: 'access', token: data.token });
      } else if (data?.type === 'logout') {
        accessToken = null;
        emit({ type: 'cleared', remote: true });
      }
    };
  }
} catch {
  channel = null;
}

try {
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
} catch {
  // ignore
}

// A logout in another tab removes the refresh token; `storage` fires in every other tab.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === REFRESH_TOKEN_KEY && event.newValue === null && (accessToken || event.oldValue)) {
      accessToken = null;
      emit({ type: 'cleared', remote: true });
    }
  });
}

function post(message: ChannelMessage): void {
  try {
    channel?.postMessage(message);
  } catch {
    // Channel closed: other tabs will refresh on their own.
  }
}

export const tokenStorage = {
  getAccessToken(): string | null {
    return accessToken;
  },

  /** Always read from storage: another tab may have rotated it. */
  getRefreshToken(): string | null {
    return readRefresh();
  },

  setTokens(tokens: AuthTokens): void {
    accessToken = tokens.access ?? null;
    writeRefresh(tokens.refresh ?? null);
    if (tokens.access) {
      emit({ type: 'access', token: tokens.access });
      post({ type: 'access', token: tokens.access });
    }
  },

  setAccessToken(token: string): void {
    accessToken = token;
    emit({ type: 'access', token });
    post({ type: 'access', token });
  },

  setRefreshToken(token: string): void {
    writeRefresh(token);
  },

  clearTokens(): void {
    const hadSession = accessToken !== null || readRefresh() !== null;
    accessToken = null;
    writeRefresh(null);
    if (hadSession) {
      post({ type: 'logout' });
      emit({ type: 'cleared', remote: false });
    }
  },

  /**
   * A session exists if there is something to authenticate with. After a reload (or in a new
   * tab) only the refresh token is present, and the API client exchanges it on first use.
   */
  hasValidSession(): boolean {
    return accessToken !== null || readRefresh() !== null;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
