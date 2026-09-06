# ADR-0029: Stub-Data Elimination and Deferred-Domain Decisions

- **Status:** Accepted
- **Date:** 2026-09-06
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

Several Django endpoints served hard-coded mock payloads, violating the
project Mock API Rule ("never return hard-coded mock data from the Django
API"). Worse, two intelligence endpoints mutated module-global lists, leaking
state across requests and users (chat transcripts, knowledge documents).

# Decision

1. **Real models where the domain is small and the contract is fixed:**
   - `OrganizationBilling` (per-org tier/credits/storage/seats) backs
     `GET/PATCH /api/v1/billing/`. Usage counters start at zero; consumption
     wiring is future work.
   - `KnowledgeDocument` (org-scoped, unique slug per org) backs the
     intelligence knowledge CRUD endpoints with identical URL contracts.
2. **Stateless explicit stubs where the backend cannot exist yet:**
   - AI chat is a stateless echo (stores nothing by design).
   - Reports and notifications return honest empty lists (never fake records).
   - AI risks/search/analytics keep contract-shaped static payloads with
     module docstrings marking them as stubs.
3. **Deferred (require infrastructure before real builds):**
   - LLM-backed assistant, risk detection, and semantic search need
     search-index + LLM services first.
   - Reporting and notification domains need product decisions + models.

# Consequences

- No Django endpoint returns fabricated per-entity records anymore; empty
  states are honest and frontend-tolerant.
- Knowledge docs and billing rows are seeded for development via `seed_dev`.
- Frontend intelligence module stays on local mocks until item 3 lands
  (rewiring now would regress the UI).
