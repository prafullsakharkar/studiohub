import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads a real captured backend response from docs/sync/samples/.
 * Frontend tests build their mocks from these files instead of hand-written shapes.
 * Vitest runs from `frontend/`, so the repo-level docs directory is one level up.
 */
const SAMPLES_DIR = path.resolve(process.cwd(), '../docs/sync/samples');

export interface CapturedResponse {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}

export function loadSample<T = Record<string, CapturedResponse>>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, relativePath), 'utf8')) as T;
}
