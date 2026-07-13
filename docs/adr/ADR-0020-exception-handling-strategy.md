# ADR-0020: Exception Handling Strategy

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub is an enterprise platform composed of multiple domains, asynchronous workers, REST APIs, and background services.

Errors originate from many sources, including:

- Validation failures
- Authorization failures
- Business rule violations
- Database operations
- External integrations
- Background jobs
- Infrastructure failures

Without a consistent exception strategy, the platform would suffer from:

- Inconsistent API responses
- Duplicate error handling
- Poor observability
- Difficult debugging
- Business logic leakage
- Tight coupling between domains

The platform requires a standardized exception architecture that separates domain concerns from transport concerns.

---

# Decision

StudioHub adopts a **layered exception architecture**.

Exceptions are categorized according to their responsibility and handled at the appropriate layer.

Business code raises domain-specific exceptions.

The API layer translates exceptions into standardized HTTP responses.

Infrastructure exceptions are logged and converted into application-specific failures where appropriate.

---

# Exception Layers

```text
Infrastructure

↓

Repository / ORM

↓

Service

↓

API

↓

Client
```

Each layer is responsible for translating exceptions rather than exposing implementation-specific errors.

---

# Exception Categories

StudioHub defines several exception categories.

### Validation Exceptions

Raised when business rules are violated.

Examples:

- Invalid project transition
- Duplicate organization code
- Invalid task assignment

---

### Authorization Exceptions

Raised when the user lacks sufficient permissions.

Examples:

- Missing permission
- Cross-tenant access
- Disabled account
- Membership required

---

### Resource Exceptions

Raised when requested resources cannot be accessed.

Examples:

- Organization not found
- Project not found
- Asset not found

---

### Conflict Exceptions

Raised when the requested operation conflicts with current state.

Examples:

- Duplicate email
- Duplicate code
- Concurrent update conflict
- Existing active membership

---

### Infrastructure Exceptions

Raised when external systems fail.

Examples:

- Redis unavailable
- Storage service failure
- SMTP unavailable
- Database connectivity issue

Infrastructure exceptions should not leak implementation details to API clients.

---

### External Integration Exceptions

Raised when third-party services fail.

Examples:

- OAuth provider unavailable
- Payment gateway failure
- AI service timeout
- Webhook delivery failure

These exceptions should be isolated from business logic.

---

# Exception Hierarchy

A simplified hierarchy:

```text
ApplicationError
├── ValidationError
├── AuthorizationError
├── AuthenticationError
├── ResourceNotFoundError
├── ConflictError
├── InfrastructureError
├── ExternalServiceError
└── RateLimitError
```

Domains may define specialized subclasses while preserving the common hierarchy.

---

# Service Responsibilities

Services should:

- Raise domain exceptions
- Avoid HTTP-specific exceptions
- Avoid framework-specific exceptions
- Preserve domain intent

Services should not construct API responses directly.

---

# Validator Responsibilities

Validators raise business validation exceptions.

They should not:

- Return HTTP responses
- Log infrastructure failures
- Catch unrelated exceptions

Validation failures are expected business outcomes.

---

# API Layer Responsibilities

The API layer is responsible for:

- Mapping exceptions to HTTP status codes
- Returning consistent error responses
- Logging unexpected failures
- Hiding internal implementation details

This translation is performed by a centralized exception handler.

---

# Error Response Format

All API errors should follow a consistent structure.

Example:

```json
{
  "error": {
    "code": "project_not_found",
    "message": "The requested project does not exist.",
    "details": {},
    "request_id": "req_123456"
  }
}
```

Error payloads should remain stable within an API version.

---

# Logging

Unexpected exceptions should include:

- Request identifier
- Correlation identifier
- User identifier (if available)
- Organization identifier
- Stack trace
- Environment metadata

Expected business exceptions generally require lower log severity.

---

# Retry Strategy

Retry behavior depends on exception type.

Suitable for retry:

- Temporary network failures
- Redis timeouts
- External API timeouts
- SMTP failures

Not suitable for retry:

- Validation failures
- Authorization failures
- Business conflicts
- Missing resources

Retry policies should be implemented by infrastructure components rather than business services.

---

# Security

Exception messages must not expose:

- SQL statements
- Internal file paths
- Stack traces
- Credentials
- Secrets
- Internal infrastructure topology

Clients should receive only information necessary to resolve the request.

---

# Observability

Exception metrics should include:

- Error rate
- Exception type
- HTTP status distribution
- Retry count
- Infrastructure failures
- External service failures

Monitoring supports operational health and incident response.

---

# Testing

Exception handling should be verified through:

- Unit tests
- API tests
- Integration tests
- Failure injection
- Infrastructure simulations

Tests should confirm both business behavior and HTTP response consistency.

---

# Alternatives Considered

## Framework Exceptions Everywhere

Advantages:

- Minimal implementation

Disadvantages:

- Tight framework coupling
- Difficult testing
- Poor domain separation

Rejected.

---

## Generic Exceptions Only

Advantages:

- Simple hierarchy

Disadvantages:

- Loss of semantic meaning
- Difficult error handling
- Poor diagnostics

Rejected.

---

## Error Codes Without Exceptions

Advantages:

- Explicit control flow

Disadvantages:

- Verbose implementation
- Reduced readability
- Difficult propagation

Rejected.

---

# Consequences

## Positive

- Consistent API responses
- Clear domain boundaries
- Improved maintainability
- Better observability
- Easier testing
- Framework independence

## Negative

- Additional exception classes
- Translation layer maintenance
- Developer discipline required

These trade-offs support long-term maintainability and operational excellence.

---

# Implementation Guidelines

- Raise domain-specific exceptions from services and validators.
- Keep HTTP concerns within the API layer.
- Use a centralized exception handler.
- Standardize error response formats.
- Log unexpected exceptions with sufficient context.
- Avoid exposing sensitive implementation details.

---

# Compliance

Architecture reviews should verify:

- Services do not raise HTTP exceptions.
- Exception hierarchy is consistently applied.
- API responses follow the standard error format.
- Sensitive information is not leaked.
- Logging includes correlation and request identifiers.
- Retry logic is limited to transient failures.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0003 — Service & Selector Pattern
- ADR-0008 — API Design Principles
- ADR-0009 — Authentication & Authorization Strategy
- ADR-0016 — Validation Architecture
- ADR-0018 — Event Bus Architecture
- ADR-0019 — API Versioning Strategy

---

# References

- `docs/03-backend/services.md`
- `docs/03-backend/validators.md`
- `docs/05-api/error-handling.md`
- `docs/10-security/access-control.md`
- `docs/11-operations/logging.md`
- `docs/11-operations/monitoring.md`