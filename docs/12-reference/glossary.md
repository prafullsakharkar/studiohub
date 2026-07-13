# Glossary

## Overview

This glossary defines common technical, architectural, operational, and business terms used throughout the StudioHub documentation. It provides a shared vocabulary for developers, DevOps engineers, QA engineers, project managers, production coordinators, and system administrators.

Definitions are intentionally concise and should be updated as the platform evolves.

---

# General Terms

| Term | Definition |
|------|------------|
| API | Application Programming Interface used for communication between systems. |
| Backend | Django-based server responsible for business logic and data management. |
| Frontend | React application providing the user interface. |
| Service | A reusable business logic component. |
| Selector | Read-only data access layer responsible for queries. |
| Repository | Source code managed in Git. |
| Module | A logical functional area of the platform. |
| Domain | A business capability such as Identity or Production. |
| Entity | A persistent business object stored in the database. |

---

# Architecture Terms

| Term | Definition |
|------|------------|
| Layered Architecture | Separation of concerns into presentation, application, domain, and infrastructure layers. |
| Domain Model | Representation of business concepts and relationships. |
| Aggregate | A consistency boundary in domain-driven design. |
| Bounded Context | Logical boundary defining a business domain. |
| Event | A notification representing a significant business occurrence. |
| Event Bus | Infrastructure responsible for publishing and subscribing to domain events. |
| ADR | Architecture Decision Record documenting important technical decisions. |
| Dependency Injection | Providing dependencies from outside a component rather than creating them internally. |

---

# Backend Terms

| Term | Definition |
|------|------------|
| Model | Django ORM class representing a database table. |
| Manager | Entry point for model-level queries and operations. |
| QuerySet | Lazy collection of database queries. |
| Serializer | Converts models to and from API representations. |
| ViewSet | DRF component exposing API endpoints. |
| Service Layer | Encapsulates business logic and transactional behavior. |
| Validator | Performs business rule validation. |
| Signal | Django event triggered by framework actions. |
| Migration | Version-controlled database schema change. |

---

# Security Terms

| Term | Definition |
|------|------------|
| Authentication | Verifying the identity of a user or system. |
| Authorization | Determining what an authenticated identity may access. |
| MFA | Multi-Factor Authentication requiring multiple verification methods. |
| JWT | JSON Web Token used for stateless authentication. |
| Secret | Sensitive credential such as an API key or encryption key. |
| RBAC | Role-Based Access Control. |
| Least Privilege | Granting only the permissions necessary to perform required tasks. |
| Audit Log | Immutable record of security-sensitive actions. |

---

# Infrastructure Terms

| Term | Definition |
|------|------------|
| Container | Isolated runtime environment, typically using Docker. |
| Kubernetes | Container orchestration platform. |
| Redis | In-memory data store used for caching and messaging. |
| PostgreSQL | Primary relational database. |
| Reverse Proxy | Server forwarding requests to backend services. |
| Load Balancer | Distributes traffic across multiple application instances. |
| Object Storage | Storage for uploaded assets and large binary files. |

---

# Deployment Terms

| Term | Definition |
|------|------------|
| CI | Continuous Integration. |
| CD | Continuous Delivery or Continuous Deployment. |
| Pipeline | Automated workflow for building, testing, and deploying software. |
| Rollback | Reverting a deployment to a previous stable version. |
| Blue-Green Deployment | Deployment strategy using two identical production environments. |
| Canary Release | Gradual rollout of a new version to a subset of users. |

---

# Operations Terms

| Term | Definition |
|------|------------|
| Monitoring | Continuous observation of system health and performance. |
| Logging | Recording runtime events for analysis and troubleshooting. |
| Runbook | Step-by-step operational procedure. |
| Incident | Event causing or threatening service disruption. |
| Disaster Recovery | Process of restoring systems after catastrophic failure. |
| Backup | Copy of data used for recovery purposes. |
| Maintenance Window | Planned period for operational changes. |

---

# Reliability Terms

| Term | Definition |
|------|------------|
| SLI | Service Level Indicator measuring service behavior. |
| SLO | Service Level Objective defining a target for an SLI. |
| SLA | Service Level Agreement defining contractual commitments. |
| RTO | Recovery Time Objective defining maximum acceptable downtime. |
| RPO | Recovery Point Objective defining maximum acceptable data loss. |
| MTTR | Mean Time to Recover. |
| MTTD | Mean Time to Detect. |
| MTBF | Mean Time Between Failures. |
| Error Budget | Acceptable amount of service unreliability within a defined period. |

---

# Production Management Terms

| Term | Definition |
|------|------------|
| Organization | Top-level tenant within StudioHub. |
| Department | Functional division within an organization. |
| Team | Group of users collaborating on work. |
| Project | Collection of production work managed as a unit. |
| Sequence | Group of related shots within a project. |
| Shot | Individual production unit in a sequence. |
| Asset | Reusable production resource such as a model, rig, or texture. |
| Task | Assigned unit of work within the production pipeline. |
| Review | Approval process for creative deliverables. |
| Version | Specific revision of an asset or shot submission. |

---

# Development Practices

| Term | Definition |
|------|------------|
| Code Review | Peer evaluation of source code before merging. |
| Refactoring | Improving internal code structure without changing behavior. |
| Technical Debt | Cost of suboptimal implementation requiring future improvement. |
| Linting | Automated verification of coding style and quality. |
| Static Analysis | Automated analysis without executing code. |
| Unit Test | Test verifying a single component in isolation. |
| Integration Test | Test validating interactions between components. |
| Smoke Test | Basic verification that critical functionality works after deployment. |

---

# Related Documents

- overview.md
- coding-standards.md
- naming-conventions.md
- architecture-decision-records.md
- ../02-architecture/domain-model.md
- ../10-security/overview.md
- ../11-operations/overview.md