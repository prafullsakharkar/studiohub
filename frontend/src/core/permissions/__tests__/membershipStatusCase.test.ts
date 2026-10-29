import { describe, expect, it } from 'vitest';
import { getUserVendorIds, getUserClientIds } from '@/core/permissions/externalAccessEngine';

describe('external membership id extraction (status case)', () => {
  it('accepts canonical lowercase statuses from the backend', () => {
    const user = {
      vendor_memberships: [{ vendor_id: 'v1', status: 'active' }],
      project_memberships: [{ vendor_id: 'v2', status: 'active' }],
      client_memberships: [{ client_id: 'c1', status: 'active' }],
    } as any;
    expect(getUserVendorIds(user)).toEqual(expect.arrayContaining(['v1', 'v2']));
    expect(getUserClientIds(user)).toEqual(expect.arrayContaining(['c1']));
  });

  it('still accepts legacy Title Case statuses', () => {
    const user = {
      vendor_memberships: [{ vendor_id: 'v1', status: 'Active' }],
      project_memberships: [{ client_id: 'c2', status: 'Active' }],
    } as any;
    expect(getUserVendorIds(user)).toContain('v1');
    expect(getUserClientIds(user)).toContain('c2');
  });
});
