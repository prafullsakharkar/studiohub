#!/usr/bin/env node
/**
 * StudioHub — API Contract Code Generation Script
 *
 * Generates canonical TypeScript types from the Django REST Framework
 * OpenAPI schema (drf-spectacular). The Django OpenAPI schema is the
 * single source of truth for the API contract shared by the Mock (MSW)
 * and Real REST modes.
 *
 * Usage:
 *   pnpm api:generate            # Regenerate types from committed schema
 *   pnpm api:generate --fetch    # Fetch schema from a running backend first
 *
 * Output:
 *   src/core/api/generated/openapi.ts
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const SCHEMA_DIR = resolve(repoRoot, 'src/core/api/generated/schema');
const SCHEMA_FILE = resolve(SCHEMA_DIR, 'django-openapi.yml');
const OUT_FILE = resolve(repoRoot, 'src/core/api/generated/openapi.ts');

// Optional backend schema URL (Django drf-spectacular default route).
const SCHEMA_URL = process.env.DJANGO_SCHEMA_URL || 'http://localhost:8000/api/schema/';

function log(msg) {
  process.stdout.write(`[api:generate] ${msg}\n`);
}

async function fetchSchema() {
  log(`Fetching schema from ${SCHEMA_URL} ...`);
  const res = await fetch(SCHEMA_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch schema: ${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get('content-type') || '';
  const isYaml = contentType.includes('yaml') || contentType.includes('yml');
  const body = await res.text();
  mkdirSync(SCHEMA_DIR, { recursive: true });
  const target = isYaml ? SCHEMA_FILE : SCHEMA_FILE.replace(/\.yml$/, '.json');
  writeFileSync(target, body);
  log(`Schema saved to ${target}`);
  return target;
}

function main() {
  const args = process.argv.slice(2);
  let schemaFile = SCHEMA_FILE;

  if (args.includes('--fetch')) {
    schemaFile = fetchSchema();
    schemaFile.then(runGenerate).catch((err) => {
      console.error('[api:generate] ERROR:', err.message);
      process.exit(1);
    });
    return;
  }

  runGenerate(schemaFile);
}

function runGenerate(schemaFile) {
  if (!existsSync(schemaFile)) {
    console.error(`[api:generate] ERROR: schema not found at ${schemaFile}`);
    console.error('Run with --fetch to fetch from a running backend first.');
    process.exit(1);
  }

  log(`Generating types from ${schemaFile} -> ${OUT_FILE}`);
  try {
    execFileSync(
      resolve(repoRoot, 'node_modules/.bin/openapi-typescript'),
      [schemaFile, '-o', OUT_FILE],
      { stdio: 'inherit' }
    );
    log('Done. Types written to src/core/api/generated/openapi.ts');
  } catch (err) {
    console.error('[api:generate] ERROR:', err.message);
    process.exit(1);
  }
}

main();
