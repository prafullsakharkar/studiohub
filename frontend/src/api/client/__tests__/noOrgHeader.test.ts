import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('no org header', () => {
  it('ApiClient never references the org header or storage key', () => {
    const src = fs.readFileSync('src/api/client/ApiClient.ts', 'utf8');
    expect(src).not.toContain('X-Organization');
    expect(src).not.toContain('studiohub_active_org_id');
  });
});
