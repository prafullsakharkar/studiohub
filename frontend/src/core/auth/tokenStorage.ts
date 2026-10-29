import { AuthTokens } from '@/types/identity';

const ACCESS_TOKEN_KEY = 'studiohub_access_token';
const REFRESH_TOKEN_KEY = 'studiohub_refresh_token';

let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

// Initialize from storage safely
try {
  inMemoryAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  inMemoryRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
} catch {
  // Graceful fallback if storage unavailable
}

export const tokenStorage = {
  getAccessToken(): string | null {
    if (!inMemoryAccessToken && typeof window !== 'undefined') {
      try {
        inMemoryAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      } catch {
        // storage error
      }
    }
    return inMemoryAccessToken;
  },

  getRefreshToken(): string | null {
    return inMemoryRefreshToken;
  },

  setTokens(tokens: AuthTokens): void {
    inMemoryAccessToken = tokens.access ?? null;
    inMemoryRefreshToken = tokens.refresh ?? null;
    try {
      if (tokens.access) localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
      if (tokens.refresh) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
    } catch {
      // Ignored in non-browser environments
    }
  },

  setAccessToken(accessToken: string): void {
    inMemoryAccessToken = accessToken;
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    } catch {
      // Ignored
    }
  },

  setRefreshToken(refreshToken: string): void {
    inMemoryRefreshToken = refreshToken;
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch {
      // Ignored
    }
  },

  clearTokens(): void {
    inMemoryAccessToken = null;
    inMemoryRefreshToken = null;
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Ignored
    }
  },

  hasValidSession(): boolean {
    return !!this.getAccessToken();
  },
};
