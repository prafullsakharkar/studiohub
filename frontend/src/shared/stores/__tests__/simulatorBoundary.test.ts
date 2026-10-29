import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';

const ALLOWLIST = new Set([
  'src/shared/components/PermissionsSimulatorModal.tsx',
  'src/core/permissions/index.ts',
]);

describe('simulator store boundary', () => {
  it('only simulator UI and barrels import the simulation stores', () => {
    const out = execSync(
      "grep -rln 'usePermissionStore\\|useRoleStore' src --include='*.ts' --include='*.tsx' | grep -v __tests__",
      { encoding: 'utf-8' },
    );
    const importers = out.trim().split('\n').map((s) => s.trim()).filter(Boolean);
    const violations = importers.filter(
      (f) =>
        !ALLOWLIST.has(f) &&
        !f.endsWith('usePermissionStore.ts') &&
        !f.endsWith('roleStore.ts'),
    );
    expect(violations).toEqual([]);
  });

  it('simulation defaults to OFF', async () => {
    const { usePermissionStore } = await import('@/shared/stores/usePermissionStore');
    expect(usePermissionStore.getState().isSimulating).toBe(false);
  });
});
