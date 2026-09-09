Part 14 — Data Platform, Metadata, Search & Knowledge Architecture — Overview

Purpose

This section defines StudioHub's enterprise data and search architecture: metadata, custom fields, taxonomies, tags, indexing, full-text and semantic search, embeddings, RAG readiness, governance, operations and testing. It prescribes a Postgres-first model (system of record) with derived search and vector layers that remain non-authoritative.

Core principles

- PostgreSQL is the System of Record. Use JSONB and relational modeling where appropriate; avoid pushing business state into search/vector stores.
- Derived indexes: search indexes and vector stores are projections built from domain data via the outbox/event pipeline.
- Event-driven indexing: domain events -> outbox -> indexing pipeline -> search/vector backends; support retries, DLQs and reindexing.
- Versioning & provenance: index documents, embeddings and embedding models must be versioned; store content-hashes and model metadata for reproducibility.
- Security & tenancy: always enforce server-side permissions and organization scoping prior to search results or semantic retrieval.

Scope

- Metadata architecture, custom field lifecycle, taxonomy & tag governance
- Search architecture: projections, search schema, faceting, filtering, paging, ranking and API design
- Semantic search: embeddings, model-versioning, vector-store strategy (pgvector vs external), hybrid retrieval patterns
- RAG & knowledge retrieval: pipelines, citation, permission scoping and LLM-safe execution boundaries
- Operations: indexing topology, reindexing, failure recovery, monitoring and DR
- Testing: index/unit/permission/semantic tests and reindex/replay verification

Non-goals

- Replacing PostgreSQL as the authoritative data store
- Selecting an irreversible, single vendor for vector/LLM—architecture must remain provider-agnostic

Next steps

1. Map existing search/metadata code (repo audit) and list gaps.
2. Prepare ADR candidates: Custom Field Storage, Search Indexing Strategy, Vector Store Choice, Embedding Versioning, RAG Safety.
3. Create index projection builders and OpenAPI fragments for search API (in next iteration).