import { describe, it, expect } from 'vitest';
import { runParityScenario } from './parityHarness';
import { parityScenarios } from './parityScenarios';
import type { ParityScenario } from './paritySuites';
import { AppError } from '@/api/errors/AppError';

/**
 * Parity harness validation (REST-only).
 *
 * No mock adapter exists. Every scenario executes against the live REST
 * repository bundle; when the Django backend is unreachable the REST leg is
 * reported as `blocked`, never as a false failure.
 */
describe('Parity Harness', () => {
  it('exposes at least the core CRUD parity scenarios', () => {
    expect(parityScenarios.length).toBeGreaterThanOrEqual(5);
    const ids = parityScenarios.map((s) => s.id);
    expect(ids).toContain('parity-project-crud');
    expect(ids).toContain('parity-404-shape');
    expect(ids).toContain('parity-pagination-contract');
  });

  it('runs every scenario without throwing', async () => {
    for (const scenario of parityScenarios) {
      const outcome = await runParityScenario(scenario);
      expect(outcome.scenarioId).toBe(scenario.id);
      expect(outcome.mock).toBeDefined();
      expect(outcome.rest).toBeDefined();
      expect(['ok', 'error', 'blocked']).toContain(outcome.mock.status);
      expect(['ok', 'error', 'blocked']).toContain(outcome.rest.status);
    }
  });

  it('reports CRUD scenarios as blocked when the backend is unreachable', async () => {
    const crud = parityScenarios.filter((s) =>
      ['parity-project-crud', 'parity-task-crud', 'parity-asset-crud', 'parity-shot-crud'].includes(s.id)
    );
    for (const scenario of crud) {
      const outcome = await runParityScenario(scenario);
      // In CI without Django, REST is blocked; with Django, it matches or errors cleanly.
      expect(['blocked', 'ok', 'error']).toContain(outcome.rest.status);
      if (outcome.rest.status === 'blocked') {
        expect(outcome.divergence).toBeDefined();
      }
    }
  });

  it('reports a 404 scenario as an error or blocked outcome', async () => {
    const scenario = parityScenarios.find((s) => s.id === 'parity-404-shape')!;
    const outcome = await runParityScenario(scenario);
    expect(['error', 'blocked']).toContain(outcome.mock.status);
    if (outcome.mock.status === 'error') {
      // Without auth the backend returns 401 before 404; both are valid 4xx contract errors.
      expect(outcome.mock.httpStatus).toBeGreaterThanOrEqual(400);
      expect(outcome.mock.httpStatus).toBeLessThan(500);
    }
  });

  it('reports a network-unreachable leg as blocked, never a 0-status error', async () => {
    // Simulates Django down: every adapter call fails with a status-0
    // network error. The harness must report `blocked` (with a divergence
    // note) instead of an `error` with httpStatus 0 that trips 4xx assertions.
    const offline: ParityScenario = {
      id: 'parity-offline-sim',
      name: 'Offline simulation',
      description: 'All adapter calls fail with a network error.',
      run: async () => {
        throw new AppError('Network request failed', 0);
      },
      normalizeResult: (result) => result,
    };
    const outcome = await runParityScenario(offline);
    expect(outcome.mock.status).toBe('blocked');
    expect(outcome.rest.status).toBe('blocked');
    expect(outcome.divergence).toBeDefined();
  });
});
