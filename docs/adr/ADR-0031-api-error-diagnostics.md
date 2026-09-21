# ADR-0031: API Error Diagnostics

- **Status:** Accepted
- **Date:** 2026-09-09
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

API failures were diagnosable only as status codes (`Unauthorized:
…`, `Method Not Allowed: …`). Determining *why* authentication failed,
*which* permission denied access, or *why* a method was rejected
required reproducing the problem. A concrete incident (`POST
/api/v1/audit/` → 401/405) motivated a centralized answer.

Constraints:

- ADR-0020 requires consistent error payloads with code/message/request
  id; ADR-0022 requires structured, correlatable logs without secrets.
- The frontend parses raw DRF bodies via `ApiError.fromDrfResponse`
  (`detail` / field-error maps). Changing body shapes would regress
  client error messages.

---

# Decision

Extend — do not replace — the existing structlog pipeline and DRF
exception handler:

1. **Request lifecycle middleware** (`RequestLoggingMiddleware`, first
   in `MIDDLEWARE`): exactly one `request_completed` record per request
   plus `unhandled_exception` with traceback for exceptions escaping
   the view layer. Never swallows, never queries.
2. **Centralized DRF exception handler** emits one structured diagnostic
   record per failure (401 `authentication_failed` with reason codes
   such as `missing_credentials`/`expired_token`/`revoked_token`;
   403 `permission_denied` naming denying classes; 405
   `method_not_allowed` with allowed methods/route/view; 400
   `validation_error` with serializer/fields; 429 `throttled`; 409/500
   `database_error`/`unhandled_exception` with traceback).
3. **Additive error envelope**: bodies keep their exact shapes and gain
   `"error": {"code", "request_id"}` (an object value, ignored by the
   current frontend parser — zero contract breakage). `X-Request-ID`
   is returned on every response.
4. **Identity token errors preserve cause**: `JWTService.decode_*`
   maps expiration/revocation to `RefreshTokenExpired`/`ExpiredToken`/
   `SessionRevoked` instead of collapsing everything into generic
   `InvalidToken`.
5. **Cache fallbacks stay visible**: throttle and permission-cache
   outages log classified reasons (`connection_refused`, …) while
   still failing open.
6. Django's duplicate per-4xx one-liners are suppressed at the
   `django.request` logger; the structured records replace them.

---

# Consequences

## Positive

- Any API error is root-causable from logs via `request_id`.
- No per-view logging code; no second logging framework.
- Client-visible contract unchanged (additive object key only).

## Negative

- `permission_denied` attribution re-evaluates `has_permission` on the
  403 path (error path only; guarded, side-effect-free assumption).

---

# Compliance

Reviews should verify: new endpoints need no logging code (bases cover
them); no credentials/bodies in logs; 4xx never logged as ERROR;
tracebacks server-side only.

---

# Related ADRs

- ADR-0009 — Authentication & Authorization Strategy
- ADR-0017 — Permission & Authorization Model
- ADR-0020 — Exception Handling Strategy
- ADR-0022 — Logging & Observability Strategy

---

# References

- `docs/observability.md`
- `docs/05-api/error-handling.md`
- `backend/apps/core/api/diagnostics/`
