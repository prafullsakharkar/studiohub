# StudioHub API Versioning Strategy

## 1. URL Path Versioning

StudioHub uses explicit URL path versioning to ensure long-term stability and backward compatibility for studio pipelines, DCC plugins, and web clients.

```
/api/v1/...
```

### 1.1 Breaking Change Policy
A version increment (e.g. `/api/v2/`) is strictly required only when:
- Existing required request payload fields are renamed or removed.
- Response payload structure is modified in a way that breaks existing clients.
- HTTP status codes or semantics for an existing route change.

### 1.2 Non-Breaking Evolutions
The following changes are permitted within `/api/v1/`:
- Adding optional request body fields or query parameters.
- Adding new properties to response JSON payloads.
- Introducing new endpoints and domain routes.
