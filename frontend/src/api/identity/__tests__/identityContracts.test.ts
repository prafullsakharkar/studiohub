import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';

/**
 * Keeps the typed identity modules honest: every field the REAL backend returned (captured in
 * docs/sync/samples) must exist in the generated OpenAPI schema the types come from, and the
 * hand-written shapes must match the captured keys exactly.
 */
const generated = fs.readFileSync(path.resolve(process.cwd(), 'src/core/api/generated/openapi.ts'), 'utf8');

function schemaProps(name: string): string[] {
  const start = generated.indexOf(`\n        ${name}: {`);
  if (start === -1) throw new Error(`schema ${name} not found`);
  const end = generated.indexOf('\n        };', start);
  const block = generated.slice(start, end);
  return [...block.matchAll(/^ {12}(?:readonly )?([a-z_0-9]+)\??:/gm)].map((m) => m[1]);
}

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('identity/_identity_admin_flow.json');
const rows = (key: string): Record<string, unknown>[] => {
  const body = flow[key].body;
  return body.items ?? body.results ?? [body];
};
const keysOf = (key: string) => Object.keys(rows(key)[0]).sort();

describe('responses vs the generated OpenAPI schema (fields the server sends must be typed)', () => {
  const cases: Array<[string, string]> = [
    ['roles_list', 'Role'],
    ['permissions_list', 'Permission'],
    ['users_list', 'UserList'],
    ['users_detail', 'UserDetail'],
    ['sessions_target_list', 'UserSessionBase'],
    ['ledger_security_events', 'SecurityEventList'],
    ['ledger_login_history', 'LoginHistoryList'],
    ['ledger_login_attempts', 'LoginAttemptList'],
    ['ledger_ip_blacklist_create', 'IPBlacklistList'],
  ];
  it.each(cases)('%s ⊆ %s', (sample, schema) => {
    const missing = keysOf(sample).filter((k) => !schemaProps(schema).includes(k));
    expect(missing).toEqual([]);
  });

  it('groups: the create echo lacks id; the list row has it', () => {
    const props = schemaProps('Group');
    expect(props).toContain('id');
    expect(keysOf('groups_list_with_row').filter((k) => !props.includes(k))).toEqual([]);
  });
});

describe('hand-written shapes match the captured keys exactly', () => {
  it.each([
    ['roles_permissions_get', ['expires_at', 'granted', 'granted_at', 'granted_by', 'id', 'permission', 'role', 'uuid']],
    ['roles_users_get', ['created_at', 'id', 'role', 'updated_at', 'user', 'uuid']],
    ['groups_members_get', ['created_at', 'group', 'id', 'is_manager', 'is_owner', 'joined_at', 'left_at', 'updated_at', 'user', 'uuid']],
    ['groups_roles_get', ['created_at', 'group', 'id', 'role', 'updated_at', 'uuid']],
  ])('%s', (sample, expected) => {
    expect(keysOf(sample)).toEqual(expected);
  });

  // Regression: the sub-resources embed nested refs (`permission: {id, code, ...}`), not ids.
  // A first draft typed them as strings and only the top-level keys were compared.
  it.each([
    ['roles_permissions_get', 'role', ['code', 'id', 'name']],
    ['roles_permissions_get', 'permission', ['action', 'code', 'id', 'module', 'name']],
    ['roles_permissions_get', 'granted_by', ['email', 'id', 'is_active']],
    ['roles_users_get', 'user', ['email', 'id', 'is_active']],
    ['groups_members_get', 'group', ['code', 'id', 'name']],
    ['groups_roles_get', 'role', ['code', 'id', 'name']],
  ])('%s.%s is an embedded ref, not an id', (sample, field, expected) => {
    const value = rows(sample)[0][field];
    expect(typeof value).toBe('object');
    expect(Object.keys(value as object).sort()).toEqual(expected);
  });

  it('credential read shape has no secret; the create response adds exactly `secret`', () => {
    const listed = keysOf('pat_list');
    expect(listed).not.toContain('secret');
    expect(listed).toEqual(['created_at', 'description', 'expires_at', 'id', 'is_active', 'kind', 'last_used_at', 'last_used_ip', 'name', 'prefix', 'revoked_at', 'scopes', 'unrestricted']);
    expect(keysOf('pat_create').filter((k) => !listed.includes(k))).toEqual(['secret']);
  });

  it('sessions include is_current', () => {
    expect(keysOf('sessions_target_list')).toContain('is_current');
  });
});
