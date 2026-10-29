import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('org-free routing', () => {
  it('AppRoutes has no organization gate or deep links', () => {
    const src = fs.readFileSync('src/routes/AppRoutes.tsx', 'utf8');
    expect(src).not.toContain('OrganizationRoute');
    expect(src).not.toContain('/organizations/:');
    expect(src).not.toContain('OrgWorkspaceRedirect');
  });
});
