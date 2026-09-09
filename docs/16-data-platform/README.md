StudioHub — Data Platform, Metadata & Search (Part 14)

This folder contains canonical documentation for StudioHub's data platform, metadata management, search architecture, semantic search/embeddings, indexing operations, and search API. The guidance follows a Postgres-first principle, event-driven indexing, and careful governance around metadata, custom fields, taxonomies, and tags.

Files:
- overview.md — high-level overview and scope
- metadata.md — domain vs metadata, ownership, storage and quality
- custom-fields.md — custom field definition, storage recommendations, validation and governance
- taxonomy-tags.md — taxonomy vs tags guidance, normalization and indexing
- search-architecture.md — index document model, projection builders and search API guidance
- semantic-search-embeddings.md — embedding lifecycle, model/versioning, storage and hybrid retrieval
- indexing-operations.md — runbooks for failures, DLQ and reindex procedures
- search-api.md — sketch of unified search endpoint

Next actions (recommended):
1. Run a code audit to map implemented search/indexing code and list gaps.
2. Draft ADRs for vector store choice, custom field storage, and embedding versioning.
3. Implement projection builders and indexing workers aligning to these docs.
4. Create example OpenAPI fragments for search endpoints and saved-search management.

Maintainers: data-platform working group (TBD)