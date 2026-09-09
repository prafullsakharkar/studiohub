# Error Contract

## Expected Shapes

The frontend parses every non-2xx body with `ApiError.fromDrfResponse`
(`frontend/src/api/errors/ApiError.ts`) against the type
`DrfErrorResponse` (`frontend/src/types/drf.ts`). Valid shapes:

```jsonc
// 1. Simple detail (auth errors, not found, permission denied)
{ "detail": "No active account found with the given email" }

// 2. Non-field errors
{ "non_field_errors": ["Unable to approve a closed review."] }

// 3. Field errors (validation)
{ "email": ["Enter a valid email address."], "code": ["This field is required."] }

// 4. Mixed
{ "detail": "Validation failed.", "name": ["This field is required."] }
```

Rules:
- Top-level string `detail` becomes the user-facing message.
- `non_field_errors: string[]` is joined into the message.
- Every other key is treated as a field error; string values are wrapped into arrays.
- No `code` field is consumed — status code drives behavior.

## Status Codes

| Status | Meaning | Frontend reaction |
|---|---|---|
| 400 | Validation error (`isValidationError = 400 \|\| 422`) | field messages shown |
| 401 | Unauthenticated / expired token | automatic refresh → retry once → logout on failure |
| 403 | Permission denied | error surfaced, **no refresh attempt** |
| 404 | Not found | handled per hook |
| 409 | Conflict | surfaced |
| 422 | Treated same as 400 | |
| 429 | Rate limited | surfaced (custom `RateLimitMiddleware` must return DRF-shaped body) |
| 5xx | Server error | ky retries GETs on 408/502/503/504 |

Client-side synthetic statuses (never sent by server): `0` network offline, `504` timeout
(30s).

## Backend Status: ALIGNED (Phase 0 complete)

The custom handler (`apps.core.api.exceptions.custom_exception_handler`) returns raw DRF
bodies: domain exceptions map to `{"detail": message}`, unhandled exceptions to
`{"detail": "Internal server error."}` (500), and authentication failures are coerced to
401. No envelope is emitted on `/api/v1/*`.

Remaining checklist:

- [x] Custom exception handler returns unwrapped DRF error bodies.
- [x] `AuthenticationFailed`/`NotAuthenticated` → 401.
- [x] PermissionDenied stays 403 when authenticated.
- [ ] Domain exceptions mapped to granular statuses (409 conflicts, state-machine
      violations) — Phase H (some mapping already exists via `BaseDomainException`
      → `{"detail": …}`).
- [ ] Rate-limit middleware (`RateLimitMiddleware`) responses verified to use
      `{ "detail": "…" }` — Phase H.
- [x] 500 responses are JSON, never HTML (`StandardJSONRenderer`).
