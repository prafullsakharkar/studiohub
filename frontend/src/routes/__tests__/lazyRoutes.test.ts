import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(path.resolve(__dirname, '..', file), 'utf8');
/** Modules the sign-in screens and the shell need before anything else; every other module's pages load on first use. */
const EAGER_MODULES = ['@/modules/auth', '@/modules/platform', '@/modules/audit'];

describe('route-level code splitting', () => {
  it('AppRoutes imports no page module statically: each loads on first use (one chunk per module)', () => {
    const staticModuleImports = [...read('AppRoutes.tsx').matchAll(/^import [^;]*from '(@\/modules\/[^']+)';/gm)].map((m) => m[1]);
    expect(staticModuleImports.filter((module) => !EAGER_MODULES.includes(module))).toEqual([]);
  });

  it('the platform and audit route modules load their pages on first use too', () => {
    for (const file of ['../modules/platform/routes/platformRoutes.tsx', '../modules/audit/routes/auditRoutes.tsx']) {
      const staticPageImports = [...read(file).matchAll(/^import \{[^}]*Page[^}]*\} from '(@\/modules\/[^']+)';/gm)].map((m) => m[1]);
      expect(staticPageImports, file).toEqual([]);
    }
  });
});
