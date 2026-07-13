# ADR-0001: Repository Structure

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub is an enterprise-scale production management platform intended to support VFX, animation, game development, virtual production, and other digital content pipelines.

The platform consists of multiple independently evolving domains including:

- Core Framework
- Identity
- Organization
- Production
- Assets
- Pipeline
- Review
- Reporting
- AI & Automation

The repository structure must:

- Scale to millions of lines of code
- Support multiple engineering teams
- Minimize coupling
- Encourage modular development
- Support independent testing
- Support CI/CD
- Simplify onboarding

A flat repository or feature-based structure would become difficult to maintain as the platform grows.

---

# Decision

StudioHub will adopt a **modular monorepository** with clear separation between backend, frontend, infrastructure, documentation, and automation.

High-level structure:

```text
repository/
│
├── backend/
│   ├── apps/
│   ├── config/
│   ├── scripts/
│   └── tests/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── tests/
│
├── docs/
│
├── docker/
│
├── infra/
│
├── scripts/
│
├── .github/
│
└── README.md
```

Within the backend:

```text
apps/

core/

identity/

organization/

production/

assets/

pipeline/

review/

reporting/

notifications/

automation/
```

Each application is an independent domain following the layered architecture.

---

# Rationale

This structure provides:

- Clear ownership boundaries
- Domain isolation
- Independent testing
- Scalable architecture
- Easier navigation
- Better maintainability
- Consistent development patterns

Developers can work within a single domain without understanding the entire codebase.

---

# Alternatives Considered

## Single Django App

Advantages:

- Simple initially

Disadvantages:

- Poor scalability
- Tight coupling
- Difficult maintenance
- Large migration files

Rejected.

---

## Feature-Based Repository

Advantages:

- Small projects benefit

Disadvantages:

- Shared code becomes fragmented
- Difficult dependency management
- Poor enterprise scalability

Rejected.

---

## Multiple Repositories

Advantages:

- Independent deployment

Disadvantages:

- Version synchronization
- Shared library duplication
- Operational complexity

Rejected for the current project scope.

---

# Consequences

### Positive

- Modular architecture
- Clear boundaries
- Easier onboarding
- Better scalability
- Independent testing
- Cleaner CI/CD

### Negative

- Slightly more initial setup
- More directories
- Requires architectural discipline

The benefits outweigh the additional organizational overhead.

---

# Implementation Notes

Repository organization should remain stable.

New domains should be introduced as separate applications rather than expanding existing ones unnecessarily.

Cross-domain dependencies should be minimized and documented.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0004 — Domain-Driven Design
- ADR-0005 — Event-Driven Architecture

---

# References

- `docs/02-architecture/overview.md`
- `docs/08-development/project-structure.md`
- `docs/13-roadmap/project-phases.md`