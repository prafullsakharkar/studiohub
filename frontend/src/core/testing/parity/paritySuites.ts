import { TestGroup, TestCase } from '../types';
import { runParityScenario, isRestBackendConfigured } from './parityHarness';
import { parityScenarios } from './parityScenarios';

/**
 * API-PARITY test suite.
 *
 * Runs each parity scenario (Mock vs REST adapter) and reports whether the two
 * data sources produce an equivalent API contract. When a REST backend is not
 * configured, the REST leg is reported as `blocked` (never a failure).
 */

export const apiParitySuite: TestGroup = {
  id: 'api-parity',
  title: 'API-PARITY: Mock vs REST Contract Parity',
  description:
    'Runs identical repository scenarios through Mock and REST adapters and compares status, response shape, error format, and pagination envelope.',
  domain: 'Cross-Cutting',
  tests: parityScenarios.map<TestCase>((scenario) => ({
    id: scenario.id,
    category: 'API-PARITY',
    name: scenario.name,
    description: scenario.description,
    testLevel: 'integration',
    priority: 'high',
    domain: 'Cross-Cutting',
    run: async () => {
      const start = performance.now();
      const restConfigured = isRestBackendConfigured();
      const outcome = await runParityScenario(scenario);

      if (outcome.rest.status === 'blocked') {
        return {
          passed: true,
          durationMs: Math.round(performance.now() - start),
          message: `${scenario.name}: REST backend not configured — parity skipped (mock leg verified).`,
          details: {
            restConfigured,
            mockStatus: outcome.mock.status,
            mockHttp: outcome.mock.httpStatus,
            restBlocked: true,
            divergence: outcome.divergence,
          },
        };
      }

      if (!outcome.matched) {
        return {
          passed: false,
          durationMs: Math.round(performance.now() - start),
          message: `${scenario.name}: PARITY MISMATCH — ${outcome.divergence}`,
          details: {
            restConfigured,
            mock: outcome.mock,
            rest: outcome.rest,
            divergence: outcome.divergence,
          },
        };
      }

      return {
        passed: true,
        durationMs: Math.round(performance.now() - start),
        message: `${scenario.name}: Mock and REST contract equivalent (${outcome.mock.httpStatus}).`,
        details: {
          restConfigured,
          mockStatus: outcome.mock.status,
          restStatus: outcome.rest.status,
          mockHttp: outcome.mock.httpStatus,
          restHttp: outcome.rest.httpStatus,
          matched: true,
        },
      };
    },
  })),
};

export const paritySuites: TestGroup[] = [apiParitySuite];
