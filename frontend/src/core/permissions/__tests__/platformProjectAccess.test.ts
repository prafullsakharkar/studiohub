import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const files = ['src/core/permissions/rbac.ts', 'src/core/permissions/scopeEngine.ts', 'src/core/permissions/accessControl.ts'];

describe('platform+project access', () => {
  it('permission core has no org dimension', () => {
    for (const f of files) {
      const src = fs.readFileSync(path.resolve(f), 'utf8');
      expect(src.toLowerCase()).not.toContain('hasorgaccess');
    }
  });
});
