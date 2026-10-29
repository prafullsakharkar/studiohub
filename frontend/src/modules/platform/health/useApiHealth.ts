import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '@/api/repositories/config';
import { tokenStorage } from '@/core/auth/tokenStorage';

/**
 * Honest API health: every number here was measured by a request this page just made.
 * Nothing is faked, randomized or smoothed; an unreachable backend is reported as down.
 */

export interface HealthProbe {
  id: string;
  label: string;
  /** Path under the API origin. List routes ask for one row only. */
  path: string;
  /** Sends the access token (the route needs a signed-in user). */
  authenticated: boolean;
}

export type ProbeState = 'operational' | 'slow' | 'restricted' | 'down' | 'pending';

export interface ProbeResult {
  state: ProbeState;
  /** HTTP status, or null when the request never completed (network error / timeout). */
  status: number | null;
  latencyMs: number | null;
  checkedAt: Date | null;
  error?: string;
}

export const HEALTH_PROBES: readonly HealthProbe[] = [
  { id: 'version', label: 'API reachable (version info)', path: '/api/v1/info/version/', authenticated: false },
  { id: 'me', label: 'Authentication (current user)', path: '/api/v1/auth/me/', authenticated: true },
  { id: 'departments', label: 'Departments', path: '/api/v1/departments/?page_size=1', authenticated: true },
  { id: 'projects', label: 'Projects', path: '/api/v1/projects/?page_size=1', authenticated: true },
  { id: 'tasks', label: 'Tasks', path: '/api/v1/tasks/?page_size=1', authenticated: true },
  { id: 'shots', label: 'Shots', path: '/api/v1/shots/?page_size=1', authenticated: true },
  { id: 'assets', label: 'Assets', path: '/api/v1/assets/?page_size=1', authenticated: true },
  { id: 'versions', label: 'Versions', path: '/api/v1/versions/?page_size=1', authenticated: true },
  { id: 'reviews', label: 'Reviews', path: '/api/v1/reviews/?page_size=1', authenticated: true },
  { id: 'deliveries', label: 'Deliveries', path: '/api/v1/deliveries/?page_size=1', authenticated: true },
];

export const PROBE_TIMEOUT_MS = 5000;
export const DEFAULT_SLOW_MS = 1000;

/** 2xx fast = operational, 2xx slow = slow, 401/403 = the API answered but not for this user, else down. */
export function classify(status: number | null, latencyMs: number | null, slowMs: number): ProbeState {
  if (status === null) return 'down';
  if (status >= 200 && status < 300) return latencyMs !== null && latencyMs > slowMs ? 'slow' : 'operational';
  if (status === 401 || status === 403) return 'restricted';
  return 'down';
}

export async function runProbe(probe: HealthProbe, slowMs = DEFAULT_SLOW_MS): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tokenStorage.getAccessToken();
  if (probe.authenticated && token) headers.Authorization = `Bearer ${token}`;

  const started = performance.now();
  try {
    const response = await fetch(`${getApiBaseUrl()}${probe.path}`, { method: 'GET', headers, cache: 'no-store', signal: controller.signal });
    const latencyMs = Math.round(performance.now() - started);
    return { state: classify(response.status, latencyMs, slowMs), status: response.status, latencyMs, checkedAt: new Date() };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    return {
      state: 'down',
      status: null,
      latencyMs: null,
      checkedAt: new Date(),
      error: timedOut ? `No answer within ${PROBE_TIMEOUT_MS / 1000}s` : 'Network error',
    };
  } finally {
    clearTimeout(timer);
  }
}

const PENDING: ProbeResult = { state: 'pending', status: null, latencyMs: null, checkedAt: null };

export function useApiHealth({ intervalMs = 30_000, slowMs = DEFAULT_SLOW_MS }: { intervalMs?: number; slowMs?: number } = {}) {
  const [results, setResults] = useState<Record<string, ProbeResult>>(() => Object.fromEntries(HEALTH_PROBES.map((p) => [p.id, PENDING])));
  const [isChecking, setIsChecking] = useState(false);
  const running = useRef(false);

  const checkNow = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setIsChecking(true);
    try {
      const entries = await Promise.all(HEALTH_PROBES.map(async (probe) => [probe.id, await runProbe(probe, slowMs)] as const));
      setResults(Object.fromEntries(entries));
    } finally {
      running.current = false;
      setIsChecking(false);
    }
  }, [slowMs]);

  useEffect(() => {
    void checkNow();
    if (intervalMs <= 0) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') void checkNow();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [checkNow, intervalMs]);

  return { results, isChecking, checkNow };
}
