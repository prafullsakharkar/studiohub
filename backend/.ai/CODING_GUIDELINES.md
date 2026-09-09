# StudioHub Backend Coding Guidelines

## 1. General

Write code that is:

* Explicit
* Typed
* Testable
* Maintainable
* Reusable
* Domain-focused

Prefer clarity over cleverness.

---

# 2. Naming

Use descriptive names.

Prefer:

```python
ProjectSelector
CreateProjectService
ProjectPermission
ProjectListSerializer
```

Avoid:

```python
Helper
Manager2
Utils
DataProcessor
```

unless the responsibility is genuinely generic.

---

# 3. Models

Models should primarily define:

* Fields
* Relationships
* Constraints
* Lightweight domain behavior

Avoid putting large workflows inside models.

---

# 4. QuerySets

QuerySets should expose reusable query operations.

Example:

```python
Project.objects.active().for_organization(organization)
```

Avoid complex workflow logic.

---

# 5. Managers

Managers should remain thin.

Prefer delegating reusable query behavior to QuerySets.

---

# 6. Selectors

Selectors should make read operations explicit.

Example:

```python
ProjectSelector.list_for_organization(
    organization=organization
)
```

Selectors should optimize queries using:

* `select_related`
* `prefetch_related`
* `annotate`

where appropriate.

---

# 7. Services

Services represent business operations.

Example:

```python
CreateProjectService.execute(...)
```

Services should:

* Validate
* Authorize where appropriate
* Use transactions
* Modify state
* Publish events

---

# 8. Transactions

Use:

```python
transaction.atomic()
```

when multiple operations must be atomic.

Keep transactions focused and short.

---

# 9. Serializers

Use serializers for API boundaries.

Avoid:

```python
serializer.save_complex_business_workflow()
```

Prefer:

```text
Serializer
 ↓
Service
```

---

# 10. Views

Views should be thin.

Avoid large methods.

Prefer:

```python
def create(self, request):
    serializer = self.get_serializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    result = CreateProjectService.execute(
        **serializer.validated_data
    )

    return Response(...)
```

---

# 11. Permissions

Permissions must be explicit.

Do not assume organization filtering alone provides authorization.

Use both:

```text
Organization Scope
+
Object Permission
```

where required.

---

# 12. Type Hints

Use type hints for public functions and important internal APIs.

Prefer:

```python
def get_project(
    project_id: UUID,
) -> Project:
    ...
```

---

# 13. Constants

Avoid magic strings.

Prefer:

```python
ProjectStatus.ACTIVE
```

over:

```python
"active"
```

when an established choice/enum exists.

---

# 14. Choices

Use Django choices/enums for controlled values.

Do not duplicate choices across serializers, models, and frontend contracts unnecessarily.

---

# 15. Exceptions

Use meaningful exceptions.

Avoid generic:

```python
raise Exception(...)
```

Prefer domain/API-specific exceptions.

---

# 16. Logging

Use structured logging.

Do not log:

* passwords
* tokens
* secrets
* sensitive authentication information

---

# 17. Security

Never trust client input.

Validate:

* IDs
* organization scope
* ownership
* permissions
* state transitions

---

# 18. API Responses

Use the established Core response infrastructure.

Do not create custom response formats per application.

---

# 19. Pagination

Use Core pagination.

Do not implement independent pagination logic inside each domain.

---

# 20. Filtering

Use Core filtering infrastructure where applicable.

Domain-specific filters belong in the domain application.

---

# 21. Imports

Keep imports clean and avoid circular imports.

Prefer importing public APIs rather than private implementation details.

---

# 22. Comments

Write comments explaining **why**, not obvious **what**.

Avoid unnecessary comments.

---

# 23. Functions

Prefer small, cohesive functions.

A function should have one clear responsibility.

---

# 24. Error Handling

Fail explicitly.

Do not silently swallow exceptions.

Avoid:

```python
try:
    ...
except Exception:
    pass
```

---

# 25. Tests

Tests should verify behavior rather than implementation details.

Prefer:

```text
Given
When
Then
```

style tests.

---

# 26. Performance

Always consider:

* N+1 queries
* unnecessary database calls
* pagination
* indexing
* select_related
* prefetch_related

Do not optimize prematurely.

Measure before introducing complex optimizations.

---

# 27. Code Review

Before considering code complete:

```text
Architecture
Security
Performance
Testing
Documentation
```

must all be reviewed.
