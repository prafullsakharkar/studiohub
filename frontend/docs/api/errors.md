# StudioHub Error Handling & Status Codes

## 1. Standard Error Envelope Schema

The frontend `ApiClient` and `ApiError` parser expect structured JSON error responses with standard HTTP status codes.

### 1.1 Field-Level Validation Error (`400 Bad Request`)
```json
{
  "errors": {
    "code": ["A shot with this code already exists in this project."],
    "frame_in": ["Frame in must be less than or equal to frame out."]
  },
  "message": "Validation failed on submitted payload."
}
```

### 1.2 General / Non-Field Error (`400 Bad Request`, `404 Not Found`, `403 Forbidden`, `401 Unauthorized`)
```json
{
  "detail": "Authentication credentials were not provided or have expired.",
  "code": "token_not_valid"
}
```

---

## 2. Standard HTTP Status Code Map

| Status Code | Reason | Frontend Handling |
| :--- | :--- | :--- |
| `200 OK` | Successful read, update, or custom action | Renders data directly |
| `201 Created` | Successful entity creation | Updates cache / redirects to entity view |
| `204 No Content` | Successful deletion | Removes entity from UI store |
| `400 Bad Request` | Validation failure or malformed payload | Highlights form fields with error messages |
| `401 Unauthorized` | Invalid / expired JWT token | Triggers refresh token flow; redirects to `/login` if refresh fails |
| `403 Forbidden` | Insufficient RBAC permissions | Displays permission denied banner |
| `404 Not Found` | Entity not found or deleted | Displays 404 state / not found toast |
| `409 Conflict` | Optimistic concurrency conflict | Prompts user to refresh / re-fetch state |
| `500 Server Error` | Unhandled backend exception | Displays generic system error toast |

---

## 3. Custom DRF Exception Handler
```python
# apps/core/exceptions.py
from rest_framework.views import exception_handler

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        if isinstance(response.data, dict) and 'detail' not in response.data:
            response.data = {
                'errors': response.data,
                'message': 'Validation failed.'
            }
    return response
```
