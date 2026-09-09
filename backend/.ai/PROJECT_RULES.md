# StudioHub Backend Project Rules

## 1. Mandatory Rules

All backend development must follow:

* `ARCHITECTURE.md`
* `CODING_GUIDELINES.md`
* `DEVELOPMENT_WORKFLOW.md`
* `docs/APP_ARCHITECTURE_TEMPLATE.md`

---

# 2. Reference Implementations

Always inspect:

```text
apps/core
apps/identity
apps/organization
```

Organization is the primary reference for new domain applications.

Never create a new architecture without justification.

---

# 3. Core Rule

Core must remain generic.

Never put VFX business logic into Core.

Core must not import business domains.

---

# 4. No Duplicate Infrastructure

Before creating:

* BaseModel
* Manager
* QuerySet
* Selector
* Service
* Validator
* Permission
* Event
* API component

search Core first.

Reuse existing functionality whenever possible.

---

# 5. Application Structure

Follow the established StudioHub structure.

Do not create:

```text
repositories/
use_cases/
repositories_impl/
domain_services/
infrastructure/
```

merely because another architecture uses those names.

Use the existing StudioHub conventions.

---

# 6. Service Rule

Complex business logic belongs in services.

Do not implement business workflows directly inside:

* Views
* ViewSets
* Serializers
* Admin
* URL configuration

---

# 7. Selector Rule

Complex reads belong in selectors.

Selectors must not perform business mutations.

---

# 8. Serializer Rule

Serializers are not business-service classes.

Use serializers for:

* Validation
* Serialization
* Deserialization
* API representation

Delegate complex business operations to services.

---

# 9. View Rule

Views and ViewSets must remain thin.

They should coordinate:

```text
Request
 ↓
Serializer
 ↓
Service / Selector
 ↓
Response
```

---

# 10. Organization Rule

Organization-aware models must use the existing Organization domain.

Never create:

```text
Studio
Tenant
Company
OrganizationProfile
```

as replacements for the canonical Organization unless explicitly approved.

---

# 11. Security Rule

Never bypass backend permissions.

Never trust:

* frontend hidden controls
* client-supplied organization IDs
* client-supplied ownership
* client-supplied permission claims

Always validate server-side.

---

# 12. API Rule

Never break an existing API contract without documenting the change.

Check frontend API requirements before modifying endpoints.

---

# 13. Migration Rule

Never manually edit migrations that have already been applied to shared environments unless following an approved migration recovery procedure.

Use Django migrations.

---

# 14. Database Rule

Do not write database-specific logic for SQLite.

Development SQLite must remain compatible with production PostgreSQL.

---

# 15. Event Rule

Events represent business facts.

Do not use events merely as an alternative function-call mechanism.

---

# 16. Celery Rule

Use Celery for genuinely asynchronous work.

Do not use Celery to hide poorly designed synchronous business logic.

---

# 17. Testing Rule

New business functionality requires tests.

A feature is not complete until its relevant tests pass.

---

# 18. Documentation Rule

Architectural changes require documentation.

Significant decisions require an ADR.

---

# 19. Dependency Rule

Avoid circular dependencies.

Preferred:

```text
Core
 ↓
Identity / Organization
 ↓
Domain Applications
```

Never:

```text
Core ↔ Production
```

---

# 20. Python Environment

Always use:

```bash
uv run
```

Examples:

```bash
uv run python manage.py check
uv run python manage.py migrate
uv run python manage.py test
```

Never depend on the system Python environment.

---

# 21. Forbidden Patterns

Do not:

* Duplicate Core
* Duplicate Identity
* Duplicate Organization
* Put business logic in serializers
* Put complex queries in views
* Put workflows in models
* Bypass permissions
* Bypass organization isolation
* Hard-code production data
* Return mock data from production APIs
* Introduce random folder structures
* Add unnecessary abstractions
* Create architectural changes without review

---

# 22. Definition of Done

A backend change is complete only when:

```text
Implementation
+
Tests
+
Architecture compliance
+
Security verification
+
Documentation
```

are complete.
