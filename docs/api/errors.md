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

## CRITICAL: Current Backend Does NOT Match

`apps.core.api.exceptions.custom_exception_handler` wraps all errors in:

```json
{
  "success": false, "status_code": 400,
  "message": "Validation failed.",
  "data": null, "meta": {},
  "errors": { "name": ["This field is required."] }
}
```

The frontend would read top-level keys as *field names* (e.g. it would treat
`"success": false` as a field error for field `success`). Resolution: **adapt Django** —
the v1 exception handler must emit raw DRF bodies (`detail` / `non_field_errors` /
field maps) at the top level. Keep the envelope only if a non-API consumer needs it.

Also note: domain exceptions (`apps/core/exceptions/base.py`,
`{"error": {"code","message","details"}}`) are plain Python exceptions and currently fall
through to the generic handler — they need explicit mapping to DRF shapes/status codes.

## Backend Requirements Checklist

- [ ] Custom exception handler returns unwrapped DRF error bodies.
- [ ] `AuthenticationFailed`/`NotAuthenticated` → 401 (already coerced today).
- [ ] PermissionDenied stays 403 when authenticated (already correct).
- [ ] Domain exceptions mapped to statuses (conflict → 409, validation → 400, missing → 404).
- [ ] Throttling/rate-limit middleware responses use `{ "detail": "…" }`.
- [ ] 500 responses are JSON `{ "detail": "Internal server error." }` (never HTML) —
      `StandardJSONRenderer` already helps here.
