# StudioHub Selector Layer Architecture

## Selector Pattern
Selectors encapsulate all read queries, prefetching, and tenant filtering. Views invoke selectors to obtain querysets, eliminating query duplication and preventing N+1 queries.

---

## Query Optimization Strategy

### 1. Prefetching & Joins
- `select_related()` on all single-value foreign keys (e.g. `supervisor`, `assigned_artist`, `department`, `team`, `client`, `project`).
- `prefetch_related()` on collection relations (e.g. `shots`, `assets`, `annotations`, `comments`, `versions`, `people`).

### 2. Tenant Scoping
All selector functions take an `organization` parameter and automatically filter out soft-deleted records (`is_deleted=False`).

Example:
```python
def get_shots_for_project(*, project_id, organization):
    return (
        Shot.objects.filter(
            project_id=project_id,
            organization=organization,
            is_deleted=False
        )
        .select_related('project', 'sequence', 'assigned_artist')
        .order_by('code')
    )
```
