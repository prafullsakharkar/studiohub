import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { BACKEND_PERMISSION_CODES, isBackendPermissionCode } from '../backendCodes';
import { PERMISSION_MAP } from '../permissionMap';
import { resolveRule } from '../access';

const snapshot = loadSample<{ catalog: string[]; enforced_by_views: string[] }>('_misc/permissions.json');

describe('backend permission codes', () => {
  it('match the captured catalog snapshot exactly (regenerate both together)', () => {
    const expected = [...new Set([...snapshot.catalog, ...snapshot.enforced_by_views])].sort();
    expect([...BACKEND_PERMISSION_CODES]).toEqual(expected);
  });
});

describe('PERMISSION_MAP', () => {
  it('every target of a `codes` rule is a real backend code', () => {
    const bad: string[] = [];
    for (const [legacy, rule] of Object.entries(PERMISSION_MAP)) {
      if (rule.kind !== 'codes') continue;
      for (const target of [...(rule.all ?? []), ...(rule.any ?? [])]) {
        if (!isBackendPermissionCode(target)) bad.push(`${legacy} -> ${target}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every rule says why', () => {
    expect(Object.entries(PERMISSION_MAP).filter(([, r]) => !r.why.trim()).map(([k]) => k)).toEqual([]);
  });

  it('a legacy key never shadows a real backend code, except on purpose', () => {
    // settings.update is seeded but enforced by no view (writes need settings.manage), so granting
    // it must not light up write controls. Any new shadow must be justified here.
    const ALLOWED_SHADOWS = ['settings.update'];
    expect(Object.keys(PERMISSION_MAP).filter(isBackendPermissionCode)).toEqual(ALLOWED_SHADOWS);
  });
});

// ---------------------------------------------------------------------------------------------
// Source scan: any permission-looking string used as a gate must resolve (map or backend code).
// A new invented code in a component fails here instead of silently denying in production.
// ---------------------------------------------------------------------------------------------
const SRC = path.resolve(process.cwd(), 'src');
const SKIP_DIRS = new Set(['__tests__', 'generated', 'node_modules']);
// Files that DEFINE vocabularies (not gates) or are scheduled for removal in this phase.
const DEFINITION_FILES = [
  'core/permissions/permissionCatalog.ts',
  'core/permissions/systemRoles.ts',
  'core/permissions/permissionMap.ts',
  'core/permissions/backendCodes.ts',
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) sourceFiles(path.join(dir, entry.name), out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const CODE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
/** The call shapes that make a string a gate. */
const GATE_PATTERNS = [
  /\b(?:can|hasPermission|hasAnyPermission|hasAllPermissions|canAny|canAll|useCan|hasPagePermission)\(\s*\[?\s*((?:'[^']+'\s*,?\s*)+)/g,
  /\b(?:pagePermission|permission|requiredPermission)\s*:\s*['"]([^'"]+)['"]/g,
  /\bpermissions\s*:\s*\[((?:\s*['"][^'"]+['"]\s*,?)+)\s*\]/g,
];

describe('gate codes used in the app', () => {
  it('every permission string used as a gate resolves to a rule', () => {
    const unresolved = new Map<string, string[]>();
    for (const file of sourceFiles(SRC)) {
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      if (DEFINITION_FILES.includes(rel)) continue;
      const text = fs.readFileSync(file, 'utf8');
      for (const pattern of GATE_PATTERNS) {
        for (const match of text.matchAll(pattern)) {
          for (const literal of match[1].match(/['"]([^'"]+)['"]/g) ?? [match[1]]) {
            const code = literal.replace(/['"]/g, '').trim();
            if (CODE.test(code) && !resolveRule(code)) {
              unresolved.set(code, [...(unresolved.get(code) ?? []), rel]);
            }
          }
        }
      }
    }
    expect(Object.fromEntries(unresolved)).toEqual({});
  });
});
