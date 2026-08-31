# StudioHub Error Handling & Status Codes

## Standardized Error Envelope
StudioHub uses DRF's `custom_exception_handler` in `apps.core.exceptions` to produce consistent JSON error structures matching the frontend's `ApiError` expectations.

---

## Response Structure

### 1. Field Validation Errors (HTTP 400 Bad Request)
```json
{
  "errors": {
    "email": ["Enter a valid email address."],
    "code": ["Shot with this code already exists in sequence."]
  },
  "status_code": 400
}
```

### 2. Authentication & Authorization Errors
- `HTTP 401 Unauthorized`:
```json
{
  "detail": "Given token not valid for any token type",
  "status_code": 401
}
```
- `HTTP 403 Forbidden`:
```json
{
  "detail": "You do not have permission to perform this action.",
  "status_code": 403
}
```

### 3. Resource Not Found (HTTP 404)
```json
{
  "detail": "Not found.",
  "status_code": 404
}
```
