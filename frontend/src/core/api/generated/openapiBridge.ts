/**
 * StudioHub — OpenAPI Generated Type Bridge
 *
 * Exposes the TypeScript types generated directly from the Django REST
 * Framework OpenAPI schema (drf-spectacular) via `openapi-typescript`.
 *
 * These types are the canonical, machine-generated representation of the
 * backend contract and are the source of truth for both Mock (MSW) and
 * Real REST modes. Hand-written domain types in `src/types/*` should be
 * kept aligned with these where the backend defines the shape.
 *
 * Usage:
 *   import type { Schemas, Paths, Operations } from '@/core/api/generated';
 *   const p: Schemas['Project'] = ...;
 */

import type * as OpenApi from './openapi';

/** Path definitions (method -> operation). */
export type Paths = OpenApi.paths;

/** Component definitions (schemas, parameters, request bodies). */
export interface Components extends OpenApi.components {}

/** Operation definitions keyed by operationId. */
export type Operations = OpenApi.operations;

/** Convenience alias for the schema registry: `Schemas['Project']`. */
export type Schemas = Components['schemas'];

/** Convenience alias for parameters registry. */
export type Parameters = Components['parameters'];

/** Convenience alias for request body registry. */
export type RequestBodies = Components['requestBodies'];

/** Convenience alias for response registry. */
export type Responses = Components['responses'];

/** Look up the schema type for a given DRF model/serializer name. */
export type SchemaByName<TName extends keyof Schemas> = Schemas[TName];

/**
 * Resolve an operation's JSON response body type for a given operationId and
 * HTTP status code. Returns `never` when the operation has no such response.
 */
export type ResponseBody<
  TOp extends keyof Operations,
  TStatus extends keyof Operations[TOp]['responses'],
> = Operations[TOp]['responses'][TStatus] extends { content: { 'application/json': infer B } } ? B : never;
