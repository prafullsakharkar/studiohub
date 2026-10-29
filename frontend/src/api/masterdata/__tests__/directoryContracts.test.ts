import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';

/**
 * Every field the real backend returned for a masterdata directory route (docs/sync/samples/masterdata)
 * must be typed in the generated OpenAPI schema, and a caller without the sensitive-field grant must
 * receive a SUBSET of what an administrator gets (the UI renders sensitive fields only when present).
 */
const generated = fs.readFileSync(path.resolve(process.cwd(), 'src/core/api/generated/openapi.ts'), 'utf8');

function schemaProps(name: string): string[] {
  const start = generated.indexOf(`\n        ${name}: {`);
  if (start === -1) throw new Error(`schema ${name} not found`);
  const end = generated.indexOf('\n        };', start);
  return [...generated.slice(start, end).matchAll(/^ {12}(?:readonly )?([a-z_0-9]+)\??:/gm)].map((m) => m[1]);
}

type Captured = { status: number; body: any };
const firstRow = (c: Captured | undefined): Record<string, unknown> | undefined => {
  const body = c?.body;
  return body?.results?.[0] ?? body?.items?.[0];
};

const CASES: Array<[sample: string, schema: string]> = [
  ['teams', 'Team'],
  ['offices', 'Office'],
  ['positions', 'Position'],
  ['people', 'Person'],
  ['clients', 'Client'],
  ['vendors', 'Vendor'],
  ['client-contacts', 'ClientContact'],
  ['vendor-contacts', 'VendorContact'],
  ['client-contracts', 'ClientContract'],
  ['vendor-contracts', 'VendorContract'],
  ['platform__master-data__task-types', 'MasterTaskType'],
  ['platform__master-data__asset-types', 'MasterAssetType'],
  ['platform__master-data__shot-types', 'MasterShotType'],
  ['platform__master-data__review-types', 'MasterReviewType'],
  ['platform__master-data__file-types', 'MasterFileType'],
  ['platform__master-data__statuses', 'MasterStatus'],
  ['platform__master-data__software', 'Software'],
];

describe.each(CASES)('%s', (sample, schema) => {
  const flow = loadSample<Record<string, Captured>>(`masterdata/${sample}.json`);

  it(`every field of an admin list row is typed in the ${schema} schema`, () => {
    const row = firstRow(flow.list_admin);
    expect(row, 'the capture has no rows').toBeTruthy();
    expect(Object.keys(row as object).filter((k) => !schemaProps(schema).includes(k))).toEqual([]);
  });

  it('a caller without the sensitive grant gets a subset of the admin fields', () => {
    const admin = firstRow(flow.list_admin);
    const limited = firstRow(flow.list_norole);
    if (!admin || !limited) return; // contacts answer 403 to such callers (Q-01)
    expect(Object.keys(limited).filter((k) => !(k in admin))).toEqual([]);
  });

  it('the detail route returns the same fields as the list', () => {
    const list = firstRow(flow.list_admin);
    const detail = flow.detail_admin?.body as Record<string, unknown> | undefined;
    // The catalog captures requested the detail WITH a trailing slash, which those routes answer 404.
    if (!list || !detail || flow.detail_admin?.status !== 200) return;
    expect(Object.keys(detail).sort()).toEqual(Object.keys(list).sort());
  });
});

describe('sensitive fields (documented, observed)', () => {
  it('people: email, phone, date_of_birth, nationality, security_clearance are hidden from a no-grant caller', () => {
    const flow = loadSample<Record<string, Captured>>('masterdata/people.json');
    const admin = Object.keys(firstRow(flow.list_admin) as object);
    const limited = Object.keys(firstRow(flow.list_norole) as object);
    const hidden = admin.filter((k) => !limited.includes(k)).sort();
    expect(hidden).toEqual(['date_of_birth', 'email', 'nationality', 'phone', 'security_clearance']);
  });

  it('clients: total_billed_usd is hidden from a no-grant caller', () => {
    const flow = loadSample<Record<string, Captured>>('masterdata/clients.json');
    const admin = Object.keys(firstRow(flow.list_admin) as object);
    const limited = Object.keys(firstRow(flow.list_norole) as object);
    expect(admin.filter((k) => !limited.includes(k))).toContain('total_billed_usd');
  });
});
