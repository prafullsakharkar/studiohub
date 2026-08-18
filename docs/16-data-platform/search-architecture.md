Search Architecture — Indexing, Projection, and API

Principles

- Postgres is the System of Record; indexes and vector stores are projections derived via events.
- Index documents must never be treated as authoritative; always reference source entities for authoritative data.
- Index versioning: include index_version, projection_version, and embeddings_version in documents.

Index document model

Each index document should include:
- id (entity_id)
- entity_type
- organization_id
- project_id
- searchable_fields (projected strings, numbers, dates)
- metadata (projected key-value pairs marked searchable)
- tags
- taxonomy_nodes
- permission_projection (set of role/visibility tokens to evaluate filters at query time)
- created_at, updated_at
- projection_version
- source_content_hash

Indexing pipeline

- Source: domain events from outbox -> indexing worker
- Transform: build projection document (normalize, flatten, apply templates)
- Write: push to index backend (e.g., Postgres FTS table / external search)
- Monitor: record indexing status, retries, and DLQ

Projection builder guidance

- Keep projection builders idempotent and deterministic.
- Use content-hash to skip unchanged projections.
- Respect custom field searchability flags when building projections.

Search API

- Provide unified search endpoint with parameters:
  - q: free text
  - entity_types: list
  - filters: structured filters
  - facets: requested facets
  - sort: relevance|name|created|updated|custom_field
  - page: cursor-based pagination
  - highlight: boolean
- API must accept query objects (structured) to allow saved searches and transformation pipelines.

Permissions

- Enforce server-side filtering using permission_projection or post-filtering when necessary.
- Consider filter-before-search for strong security and search-then-authorize for performance-sensitive flows with smaller result sets and additional authorization steps.

Reindexing

- Support full, project-level, and entity reindex.
- Provide safety: do not modify source data; perform backfill into a new index/version and swap aliases.

