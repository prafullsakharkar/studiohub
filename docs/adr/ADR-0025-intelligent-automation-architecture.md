# ADR-0025: Intelligent Automation Architecture

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

Modern VFX productions generate large volumes of operational data and repetitive workflows.

Examples include:

- Task assignment
- Review routing
- Asset tagging
- Shot status updates
- File validation
- Notification delivery
- Scheduling
- Resource planning
- Production reporting
- Knowledge retrieval

Many of these activities benefit from intelligent automation.

Some automation is deterministic, while other scenarios may leverage Artificial Intelligence or Machine Learning.

The platform requires an architecture that supports both traditional workflow automation and AI-powered capabilities without coupling business domains to specific vendors or technologies.

---

# Decision

StudioHub adopts an **Intelligent Automation Architecture**.

Automation capabilities are implemented as independent services that subscribe to domain events and execute workflows asynchronously.

Business domains remain unaware of:

- AI providers
- Machine learning models
- Prompt templates
- Workflow engines
- Automation rules

Automation services consume domain events and produce business outcomes through well-defined interfaces.

---

# Objectives

The architecture aims to:

- Reduce repetitive manual work
- Improve production efficiency
- Support optional AI capabilities
- Remain vendor independent
- Enable human review where appropriate
- Scale automation independently

Automation enhances business workflows but never replaces authoritative business rules.

---

# Architecture

```text
Business Service

↓

Domain Event

↓

Event Bus

↓

Automation Engine

↓

Automation Worker

↓

AI Provider
Workflow Engine
Rules Engine

↓

Business Service
```

Automation components operate independently from business services.

---

# Automation Categories

StudioHub supports multiple forms of automation.

### Rule-Based Automation

Examples:

- Status transitions
- Task creation
- Notification routing
- Escalation policies
- SLA enforcement

These workflows are deterministic.

---

### AI-Assisted Automation

Examples:

- Asset tagging
- Shot summaries
- Review summaries
- Metadata extraction
- Knowledge search
- Content classification
- Natural language assistance

AI-generated outputs should be considered advisory unless explicitly approved.

---

### Workflow Automation

Examples:

- Daily reports
- Scheduled reminders
- Pipeline synchronization
- Approval routing
- Calendar updates

Workflow execution remains asynchronous.

---

# Provider Abstraction

AI capabilities are accessed through provider abstractions.

Potential providers include:

- OpenAI
- Anthropic
- Google
- Azure OpenAI
- Local LLMs
- Future providers

Business domains must never communicate directly with provider SDKs.

---

# Prompt Management

Prompts are treated as application assets.

Prompt definitions should support:

- Versioning
- Localization
- Testing
- Reuse

Prompt templates should not be embedded in business services.

---

# Human Oversight

Certain automation requires human approval.

Examples:

- Production scheduling
- Budget recommendations
- Resource allocation
- Asset publication
- Review decisions

Automation may recommend actions but should not override governance controls.

---

# Background Processing

Automation workloads execute asynchronously using background workers.

Suitable workloads include:

- Large language model requests
- Media analysis
- Batch classification
- Report generation

Long-running automation must not block user requests.

---

# Security

Automation services must:

- Respect tenant boundaries
- Enforce authorization
- Protect confidential data
- Avoid unnecessary data sharing
- Log automation activity

Sensitive information should be minimized before transmission to external providers.

---

# Governance

Automation should provide:

- Execution logs
- Approval history
- Prompt version tracking
- Provider selection
- Cost visibility

These controls support enterprise governance.

---

# Monitoring

Operational metrics include:

- Automation executions
- Success rate
- Failure rate
- Processing latency
- Provider latency
- Cost metrics
- Queue depth

Monitoring enables capacity planning and operational visibility.

---

# Failure Handling

Automation failures should:

- Be isolated from business transactions
- Support retries
- Generate alerts
- Record diagnostic information

Business operations should remain successful even when automation fails.

---

# Vendor Independence

Automation providers remain replaceable.

Business logic depends only on platform interfaces rather than vendor SDKs.

This enables future migration without domain changes.

---

# Alternatives Considered

## Direct AI Calls from Services

Advantages:

- Simple implementation

Disadvantages:

- Tight coupling
- Vendor lock-in
- Difficult testing

Rejected.

---

## AI Everywhere

Advantages:

- Broad automation

Disadvantages:

- High operational risk
- Reduced predictability
- Increased cost

Rejected.

---

## No Automation

Advantages:

- Simpler architecture

Disadvantages:

- Manual repetitive work
- Lower productivity
- Limited extensibility

Rejected.

---

# Consequences

## Positive

- Vendor independence
- Modular automation
- Event-driven workflows
- Improved scalability
- Human governance
- Future extensibility

## Negative

- Additional infrastructure
- Eventual consistency
- Operational monitoring requirements
- Automation lifecycle management

These trade-offs support a scalable and future-ready enterprise platform.

---

# Implementation Guidelines

- Trigger automation through domain events.
- Execute automation asynchronously.
- Keep business services provider-agnostic.
- Centralize prompt management.
- Require human approval for high-impact decisions.
- Log and monitor automation activities.
- Design providers to be replaceable.

---

# Compliance

Architecture reviews should verify:

- Business domains remain independent of AI providers.
- Automation executes asynchronously.
- Tenant isolation is maintained.
- Prompt templates are centrally managed.
- Human approval exists for critical workflows.
- Provider integrations remain replaceable.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0005 — Event-Driven Architecture
- ADR-0007 — Background Processing with Celery & Redis
- ADR-0015 — Caching Strategy
- ADR-0018 — Event Bus Architecture
- ADR-0022 — Logging & Observability Strategy
- ADR-0024 — Notification Architecture

---

# References

- `docs/03-backend/events.md`
- `docs/03-backend/tasks.md`
- `docs/06-infrastructure/ai.md`
- `docs/06-infrastructure/background-processing.md`
- `docs/08-development/coding-standards.md`