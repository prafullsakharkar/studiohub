# StudioHub Pagination Contract

## 1. Pagination Specification

All list endpoints in StudioHub adhere strictly to standard Django REST Framework `PageNumberPagination` response envelopes.

### 1.1 Pagination Envelope Schema
```json
{
  "count": 128,
  "next": "https://api.studiohub.vfx/api/v1/shots/?page=2&page_size=20",
  "previous": null,
  "results": [
    {
      "id": "shot-001",
      "code": "NK_010_010",
      "name": "Hero Spinner Dive Through Neon Canyon"
    }
  ]
}
```

### 1.2 Query Parameters
| Parameter | Type | Default | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `page` | Integer | `1` | Min: 1 | The 1-based page index to retrieve. |
| `page_size` | Integer | `20` | Min: 1, Max: 100 | The number of records returned per page. |

### 1.3 DRF Backend Configuration
```python
# apps/core/pagination.py
from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
```
