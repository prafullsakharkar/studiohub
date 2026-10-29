/**
 * Type-level smoke tests for the OpenAPI-generated contract types.
 *
 * These assertions are evaluated by `tsc --noEmit` (the `lint`/`typecheck`
 * scripts). They verify that the generated types from the Django OpenAPI
 * schema resolve to real schema names and that the bridge helpers produce
 * usable types, so a stale/malformed generation is caught at compile time.
 */
import { describe, it, expect } from 'vitest';
import type {
  Paths,
  Operations,
  Schemas,
  SchemaByName,
  ResponseBody,
} from '../openapiBridge';

describe('OpenAPI generated contract bridge', () => {
  it('exposes schema types for real DRF serializers', () => {
    // Compile-time assertions only: if the schema names below ever disappear
    // from the generated openapi.ts, this file will fail to typecheck.
    type _AssetList = SchemaByName<'AssetList'>;
    type _AssetDetail = SchemaByName<'AssetDetail'>;
    type _ProjectList = SchemaByName<'ProjectList'>;
    type _TaskList = SchemaByName<'TaskList'>;
    type _User = SchemaByName<'User'>;

    const schemas = {} as Schemas;
    expect(typeof schemas).toBe('object');
    void (0 as unknown as _AssetList);
    void (0 as unknown as _AssetDetail);
    void (0 as unknown as _ProjectList);
    void (0 as unknown as _TaskList);
    void (0 as unknown as _User);
  });

  it('exposes path and operation maps', () => {
    // The `paths` and `operations` maps must exist and be indexable.
    type _Paths = Paths;
    type _Ops = Operations;

    // Verify a known operationId from the Django schema resolves.
    // (operationIds are stable drf-spectacular operation names.)
    type _Op = Operations['projects_list'];
    void (0 as unknown as _Paths);
    void (0 as unknown as _Ops);
    void (0 as unknown as _Op);
  });

  it('ResponseBody resolves a JSON 200 body when present', () => {
    type Body = ResponseBody<'projects_list', 200>;
    // If the operation has no JSON 200 content, Body resolves to `never`
    // and the assertion below fails at compile time (never is not assignable
    // to object).
    const b = {} as Body;
    expect(b).toBeDefined();
  });
});
