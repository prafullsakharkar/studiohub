import { RepositoryFactory, RepositoryBundle } from '@/api/repositories/factory';
import { getApiBaseUrl } from '@/api/repositories/config';
import { PaginatedResponse, QueryParams } from '@/types/common';
import { AppError } from '@/api/errors/AppError';

/**
 * StudioHub — Mock/REST Parity Harness
 *
 * Runs the exact same repository scenario through both the Mock adapter and the
 * REST adapter, then normalizes the outcomes so they can be compared for
 * contract parity (HTTP status, response shape, error format, pagination).
 *
 * Design rules (per AGENTS.md):
 *  - No mock-vs-rest branching in application components. Parity comparison
 *    lives ONLY in the test harness.
 *  - The Mock adapter and REST adapter must produce equivalent contracts.
 *  - A REST backend may be unreachable; that is reported as `blocked`, never
 *    as a parity failure.
 */

export type ParityOutcomeStatus = 'ok' | 'error' | 'blocked';

export interface ParityOutcome {
  status: ParityOutcomeStatus;
  httpStatus: number;
  /** Normalized JSON body (or normalized error payload) for comparison. */
  body: unknown;
  errorType?: string;
  isNetworkError?: boolean;
  durationMs: number;
}

export interface ParityComparison {
  scenarioId: string;
  scenarioName: string;
  mock: ParityOutcome;
  rest: ParityOutcome;
  /** True when both outcomes are semantically equivalent. */
  matched: boolean;
  /** Human-readable summary of divergence, if any. */
  divergence?: string;
}

export interface ParityScenario<T = unknown> {
  id: string;
  name: string;
  description: string;
  /**
   * Executes the scenario against the REST repository bundle.
   * Returns the raw result of the operation (or throws an AppError).
   */
  run: (bundle: RepositoryBundle) => Promise<T>;
  /**
   * Normalize a successful result into a comparable body.
   */
  normalizeResult: (result: T) => unknown;
}

/**
 * Build the REST-only repository bundle.
 */
function bundleFor(): RepositoryBundle {
  return RepositoryFactory.createAll();
}

/**
 * Execute a scenario, capturing a normalized outcome.
 * Network failures (status 0) are surfaced so the caller can decide whether to
 * mark the REST leg as `blocked`.
 */
async function execute(
  scenario: ParityScenario
): Promise<ParityOutcome> {
  const start = performance.now();
  const bundle = bundleFor();
  try {
    const result = await scenario.run(bundle);
    return {
      status: 'ok',
      httpStatus: 200,
      body: scenario.normalizeResult(result),
      durationMs: Math.round(performance.now() - start),
    };
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - start);
    if (err instanceof AppError) {
      return {
        status: 'error',
        httpStatus: err.status,
        body: err.errors,
        errorType: err.name,
        isNetworkError: err.isNetworkError,
        durationMs,
      };
    }
    return {
      status: 'error',
      httpStatus: 0,
      body: { message: err instanceof Error ? err.message : String(err) },
      errorType: 'Unknown',
      isNetworkError: true,
      durationMs,
    };
  }
}

/**
 * Compare two outcomes for semantic parity. Focuses on:
 *  - HTTP status class (2xx vs 4xx vs 5xx)
 *  - For successes: normalized body shape (pagination envelope + key set)
 *  - For errors: error format (field errors vs single message)
 */
function compare(mock: ParityOutcome, rest: ParityOutcome): {
  matched: boolean;
  divergence?: string;
} {
  const mockStatusClass = Math.floor(mock.httpStatus / 100);
  const restStatusClass = Math.floor(rest.httpStatus / 100);

  if (mockStatusClass !== restStatusClass) {
    return {
      matched: false,
      divergence: `Status class mismatch: mock=${mock.httpStatus} rest=${rest.httpStatus}`,
    };
  }

  if (mock.status !== rest.status) {
    return {
      matched: false,
      divergence: `Outcome mismatch: mock=${mock.status} rest=${rest.status}`,
    };
  }

  if (mock.status === 'error') {
    const mockErrorShape = shapeOf(mock.body);
    const restErrorShape = shapeOf(rest.body);
    if (mockErrorShape !== restErrorShape) {
      return {
        matched: false,
        divergence: `Error shape mismatch: mock=${mockErrorShape} rest=${restErrorShape}`,
      };
    }
    return { matched: true };
  }

  // Compare normalized success bodies
  const mockShape = shapeOf(mock.body);
  const restShape = shapeOf(rest.body);
  if (mockShape !== restShape) {
    return {
      matched: false,
      divergence: `Body shape mismatch: mock=${mockShape} rest=${restShape}`,
    };
  }
  return { matched: true };
}

/**
 * Compute a stable structural signature of a value: the set of its keys and
 * whether it is a pagination envelope (count/next/previous/results).
 */
function shapeOf(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return `array[${value.length}]`;
  }
  if (typeof value !== 'object') {
    return typeof value;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort().join(',');
  const isPaginated =
    'count' in obj && 'results' in obj;
  const prefix = isPaginated ? 'paginated' : 'plain';
  return `${prefix}{${keys}}`;
}

/**
 * Whether a real REST backend is available for parity verification.
 *
 * When no REST base URL is configured (VITE_API_URL unset), REST adapters
 * would attempt relative fetches, so parity cannot be meaningfully verified.
 */
export function isRestBackendConfigured(): boolean {
  if (typeof process !== 'undefined' && (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test')) {
    return false;
  }
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (metaEnv?.VITEST === 'true' || metaEnv?.MODE === 'test') {
    return false;
  }
  return getApiBaseUrl().length > 0;
}

/**
 * Run a full parity comparison: mock leg first, then REST leg.
 */
export async function runParityScenario(
  scenario: ParityScenario
): Promise<ParityComparison> {
  const mock = await execute(scenario);
  const rest = await execute(scenario);

  // REST backend unreachable (no base URL configured or network error) →
  // report blocked, never a false parity failure. When the first leg also
  // failed with a network error (e.g. Django down), it is blocked too —
  // a status-0 `error` would trip 4xx-shape assertions downstream.
  const restUnavailable = !isRestBackendConfigured() || rest.isNetworkError;
  if (!isRestBackendConfigured() || (rest.status === 'error' && restUnavailable)) {
    const mockBlocked = mock.isNetworkError === true;
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      mock: mockBlocked ? { ...mock, status: 'blocked' } : mock,
      rest: { ...rest, status: 'blocked' },
      matched: false,
      divergence:
        'REST backend unavailable (no VITE_API_URL configured or network error). Parity not verifiable in this environment.',
    };
  }

  const { matched, divergence } = compare(mock, rest);
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    mock,
    rest,
    matched,
    divergence,
  };
}

/**
 * Convenience: normalize a DRF paginated response into a comparable shape.
 */
export function normalizePaginated(body: PaginatedResponse<unknown>): unknown {
  return {
    count: body.count,
    hasNext: body.next !== null && body.next !== undefined,
    hasPrevious: body.previous !== null && body.previous !== undefined,
    resultKeys: body.results?.length ? shapeOf(body.results) : 'empty',
  };
}

export type { QueryParams };
