# StudioHub Search Specification

## 1. Global & Field Search Standards

All entities supporting search accept the standard `search` query parameter, powered by `rest_framework.filters.SearchFilter` and PostgreSQL GIN full-text search indexes.

### 1.1 Query Syntax
```
GET /api/v1/shots/?search=Hero%20Spinner
GET /api/v1/assets/?search=cruiser
GET /api/v1/people/?search=Rostova
```

### 1.2 Search Target Mapping by Domain
| Domain / Entity | Indexed Fields |
| :--- | :--- |
| **Shots** | `code`, `name`, `description`, `sequence_code` |
| **Assets** | `name`, `code`, `category`, `tags`, `description` |
| **Tasks** | `name`, `code`, `description`, `entity_code` |
| **People** | `first_name`, `last_name`, `email`, `role`, `title` |
| **Projects** | `name`, `code`, `description`, `client_name` |
| **Audit Logs** | `action`, `user_name`, `entity_code`, `details` |

### 1.3 Implementation Rule
Search filters must be applied within Selector methods using case-insensitive `icontains` or PostgreSQL `SearchVector` against tenant-filtered querysets:
```python
# apps/production/selectors/shot_selector.py
def get_shot_queryset(organization, filters=None):
    qs = Shot.objects.filter(organization=organization, is_deleted=False)
    if filters and filters.get('search'):
        query = filters['search']
        qs = qs.filter(
            Q(code__icontains=query) |
            Q(name__icontains=query) |
            Q(sequence_code__icontains=query)
        )
    return qs
```
