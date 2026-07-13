# ADR-0023: Search & Indexing Strategy

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub manages a large volume of production data across multiple domains, including:

- Organizations
- Users
- Departments
- Projects
- Episodes
- Sequences
- Shots
- Tasks
- Assets
- Reviews
- Comments

Users expect fast and accurate search across these entities.

As deployments scale from small studios to enterprise environments, search requirements evolve from simple keyword matching to advanced full-text search, filtering, ranking, and autocomplete.

The platform requires a search architecture that provides good default performance while supporting future scalability.

---

# Decision

StudioHub adopts a **tiered search architecture**.

The default implementation uses **PostgreSQL Full-Text Search (FTS)** for structured and textual queries.

Large-scale deployments may integrate a dedicated search engine such as **OpenSearch** or **Elasticsearch** without changing the application architecture.

Search remains a read-only capability and never becomes the system of record.

---

# Objectives

The search strategy aims to:

- Deliver fast search responses
- Support tenant isolation
- Scale with growing datasets
- Minimize operational complexity
- Enable advanced search capabilities
- Preserve database consistency

---

# Search Architecture

```text
Client

↓

API

↓

Selector

↓

Search Layer

↓

PostgreSQL FTS
or
Search Engine

↓

Results
```

Selectors provide the abstraction between business logic and the underlying search implementation.

---

# Search Providers

## Default Provider

PostgreSQL Full-Text Search

Suitable for:

- Small studios
- Medium-sized deployments
- Internal search
- Administrative interfaces

Advantages:

- No additional infrastructure
- Transactional consistency
- Simpler operations

---

## Enterprise Provider

Dedicated search engine

Examples:

- OpenSearch
- Elasticsearch

Suitable for:

- Millions of records
- Advanced ranking
- Autocomplete
- Fuzzy matching
- Analytics

This provider remains optional.

---

# Search Scope

Search may include:

- Names
- Codes
- Descriptions
- Tags
- Notes
- Metadata
- Comments

Each domain defines which fields participate in indexing.

---

# Tenant Isolation

Search results must always respect organization boundaries.

Every search query includes tenant constraints before ranking.

Cross-tenant indexing is prohibited.

---

# Indexing Strategy

Indexes are maintained through domain events.

Typical workflow:

```text
Entity Updated

↓

Domain Event

↓

Event Bus

↓

Index Update

↓

Search Provider
```

This keeps indexing independent from business services.

---

# Eventual Consistency

Search indexes are eventually consistent.

The authoritative data remains in PostgreSQL.

Temporary indexing delays are acceptable provided they remain within operational targets.

---

# Ranking

Ranking should consider:

- Exact matches
- Prefix matches
- Field weighting
- Recency
- Relevance score

Business-specific ranking rules may be introduced per domain.

---

# Filtering

Search supports structured filtering including:

- Organization
- Project
- Department
- Status
- Assigned User
- Asset Type
- Date Range

Filtering occurs before pagination.

---

# Pagination

Search results should support:

- Offset pagination
- Cursor pagination (future)

Large result sets should never be returned in a single response.

---

# Autocomplete

Autocomplete should:

- Return lightweight results
- Use indexed fields only
- Respect authorization
- Apply tenant isolation

Autocomplete must avoid expensive database scans.

---

# Security

Search must enforce:

- Authentication
- Authorization
- Tenant isolation
- Permission-aware filtering

Search indexes must not expose restricted information.

---

# Performance

Search performance should be monitored using:

- Query latency
- Index size
- Index update latency
- Search throughput
- Cache hit ratio

Expensive search queries should be optimized using indexes and query analysis.

---

# Monitoring

Operational metrics should include:

- Search request count
- Average latency
- Failed searches
- Index update failures
- Reindex duration
- Search engine health

These metrics support operational monitoring and capacity planning.

---

# Reindexing

The platform should support full reindexing.

Typical workflow:

```text
Reindex Command

↓

Read Database

↓

Generate Documents

↓

Update Index

↓

Verification
```

Reindexing should be executable without modifying application code.

---

# Alternatives Considered

## PostgreSQL Only

Advantages:

- Simple deployment
- Transactional consistency
- Minimal infrastructure

Disadvantages:

- Limited advanced search features
- Reduced scalability

Accepted as the default implementation.

---

## Search Engine Only

Advantages:

- Rich search capabilities
- Excellent scalability

Disadvantages:

- Additional infrastructure
- Higher operational cost
- Eventual consistency

Rejected as the default due to unnecessary complexity for smaller deployments.

---

## Direct ORM Filtering

Advantages:

- Minimal implementation

Disadvantages:

- Poor scalability
- Limited relevance ranking
- Weak full-text capabilities

Rejected.

---

# Consequences

## Positive

- Scalable search architecture
- Simple default deployment
- Optional enterprise search engine
- Strong tenant isolation
- Event-driven indexing

## Negative

- Eventual consistency for indexed data
- Additional infrastructure for enterprise deployments
- Index maintenance overhead

These trade-offs provide flexibility while preserving operational simplicity.

---

# Implementation Guidelines

- Use PostgreSQL FTS as the default search provider.
- Abstract search behind selectors.
- Update indexes through domain events.
- Enforce tenant isolation on every query.
- Monitor search performance and index health.
- Support optional migration to OpenSearch or Elasticsearch without changing application code.

---

# Compliance

Architecture reviews should verify:

- Search is accessed through selectors.
- PostgreSQL remains the system of record.
- Search indexes are updated via domain events.
- Tenant isolation is enforced.
- Search providers remain replaceable.
- Index rebuild procedures are documented.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0005 — Event-Driven Architecture
- ADR-0006 — PostgreSQL as the Primary Database
- ADR-0015 — Caching Strategy
- ADR-0018 — Event Bus Architecture
- ADR-0022 — Logging & Observability Strategy

---

# References

- `docs/03-backend/selectors.md`
- `docs/03-backend/events.md`
- `docs/03-backend/database.md`
- `docs/06-infrastructure/postgresql.md`
- `docs/11-operations/monitoring.md`