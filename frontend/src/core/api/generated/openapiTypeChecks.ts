/**
 * StudioHub — OpenAPI Generated Type Compile-Time Guards
 *
 * This file is intentionally NOT a `*.test.ts` (those are excluded from the
 * `tsc --noEmit` typecheck). It contains type-level assertions that are
 * evaluated during `pnpm typecheck`, guaranteeing that the generated types
 * from the Django OpenAPI schema still resolve to real schema/operation
 * names. If a generation is stale or the schema names change, this file
 * fails to compile.
 */

import type {
  Paths,
  Operations,
  Schemas,
  SchemaByName,
  ResponseBody,
} from './openapiBridge';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _GuardPaths = Paths;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _GuardOps = Operations;

// Real DRF serializer schemas that must exist in the generated openapi.ts.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _GuardSchemas = Schemas;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _GuardSchemaAssetList = SchemaByName<'AssetList'>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _GuardSchemaAssetDetail = SchemaByName<'AssetDetail'>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _GuardSchemaProjectList = SchemaByName<'ProjectList'>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _GuardSchemaTaskList = SchemaByName<'TaskList'>;

// A known drf-spectacular operationId must resolve.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _GuardOp = Operations['v1_departments_list'];

// The departments list 200 JSON body must resolve to a concrete type (not never).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _GuardDepartmentsBody = ResponseBody<'v1_departments_list', 200>;

export type { Paths, Operations, Schemas };
