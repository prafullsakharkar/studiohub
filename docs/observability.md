# StudioHub Observability — API Error Diagnostics

Backend error diagnostics for the Django REST API: every API failure is
diagnosable from backend logs via a shared `request_id`.

Related decisions: ADR-0020 (exception handling), ADR-0022 (logging &
observability), ADR-0031 (API error diagnostics).

---

# 1. Architecture

```text
HTTP Request
    │
    ▼
RequestLoggingMiddleware          # first: assigns request_id, times request
    │                             # emits ONE request_completed record
    ▼
RequestIDMiddleware               # reuses request_id, echoes X-Request-ID
    │
    ▼
LoggingContextMiddleware          # seeds logging ContextVars
    │
    ▼
OrganizationMiddleware / auth / views (DRF)
    │                             # BaseAPIView/BaseViewSet finalize_response
    │                             # syncs user/org into ContextVars
    ▼
custom_exception_handler          # ONE diagnostic record per failure
    │                             # (event + reason + request_id)
    ▼
JSON error response               # detail (unchanged) + error.code/request_id
```

Two records per failed request, correlated by `request_id`:

```text
WARNING authentication_failed  request_id=abc reason=missing_credentials ...
INFO    request_completed      request_id=abc status_code=401 duration_ms=12 ...
```

Successful requests emit only `request_completed` (INFO).

---

# 2. Request ID / Correlation ID

Every request gets a `request_id`:

1. Client sends a valid `X-Request-ID` → reused (sanitized: control
   characters stripped, truncated to 128 chars; blank/invalid → replaced).
2. Otherwise a UUIDv4 is generated.

The id is returned in the `X-Request-ID` response header AND in every
error body (`error.request_id`), and appears in every log record for the
request. To debug any failure: take the `request_id` from the client
error (or response header) and search backend logs for it.

---

# 3. Structured Events

Stable `event` names (see `apps/core/api/diagnostics/events.py`):

```text
request_started (DEBUG only)      request_completed
authentication_success (DEBUG)    authentication_failed
permission_granted (DEBUG)        permission_denied
method_not_allowed                not_found
validation_error                  throttled
cache_error                       throttle_cache_fallback
database_error                    external_service_error
unhandled_exception
```

Every record carries the request context: `request_id`, `method`, `path`,
`route`, `url_name`, `view`, `view_action`, `api_version`, `status_code`
(completion), `duration_ms` (completion), `user_id`, `organization_id`,
`authenticated`, `auth_scheme`, `client_ip`, `user_agent`, `content_type`,
`query_params` (sanitized), plus `service` and `environment`.

---

# 4. Authentication Diagnostics (401)

`authentication_failed` always includes:

```text
reason                  # missing_credentials | invalid_token |
                        # expired_token | revoked_token | malformed_token |
                        # unsupported_authentication_scheme |
                        # authentication_backend_error
authentication_classes  # DRF authenticators evaluated, e.g. JWTAuthentication
auth_scheme             # presented scheme (Bearer/Basic/…), never the secret
has_credentials         # header credentials or credential-named body fields
```

Examples:

```text
authentication_failed method=POST path=/api/v1/audit/ reason=missing_credentials
  authentication_classes=[JWTAuthentication, BasicAuthentication,
  SessionAuthentication] request_id=… user_id=None

authentication_failed method=GET path=/api/v1/audit/audit-logs/
  reason=expired_token auth_scheme=Bearer request_id=…
```

401 vs 403:

- **401** — authentication missing/invalid (`authentication_failed`).
- **403** — authentication succeeded, authorization failed
  (`permission_denied` with `permission_classes` naming the denying
  classes, `view`, `view_action`, `reason=missing_required_permission`).

```text
permission_denied method=POST path=/api/v1/things/ view=ThingViewSet
  view_action=create permission_classes=[IsAdminPermission]
  user_id=… organization_id=… reason=missing_required_permission
```

---

# 5. Routing Diagnostics (404 / 405)

Unknown paths return JSON (not HTML) via `handler404` and log `not_found`
with `path` (route resolution never ran, so `route`/`view` are null).

Method-not-allowed logs the authoritative data:

```text
method_not_allowed method=POST path=/api/v1/audit/ route=api/v1/audit/
  view=APIRootView requested_method=POST allowed_methods=[GET, HEAD, OPTIONS]
  view_action=None status_code=405 request_id=…
```

Reading it: the bare `/api/v1/audit/` path serves DRF's read-only API
root (all audit ViewSets are List+Retrieve-only by design); POST was
never registered there. See §10 for this incident's root cause.

---

# 6. Validation, Throttling, Database, Cache

Validation (400) — `validation_error` with `serializer`, `fields`,
`error_count`, and capped per-field `errors`. Values for sensitive field
names are replaced with `"Invalid value."`:

```text
validation_error serializer=LoginSerializer fields=[email, password]
  error_count=2 request_id=… user_id=None
```

Throttling (429) — `throttled` with `throttle_scope` and `wait_seconds`.
Cache outages fail open and log a single structured fallback (no silent
degradation):

```text
throttle_cache_fallback backend=RedisCache operation=throttle_check
  scope=refresh reason=connection_refused exception_type=ConnectionError
  fallback=allow
```

Database (409/500) — `database_error` with `exception_type`,
`operation` (view action), and `model`. SQL text is never logged;
tracebacks carry the failing statement in development.

Unexpected (500) — `unhandled_exception` at ERROR **with full traceback**
(`logger.exception`), `exception_type`, and truncated
`exception_message`. Tracebacks never leave the server.

---

# 7. API Error Format

Bodies keep their existing shapes (`{"detail": …}` / field-error maps —
the frontend `ApiError.fromDrfResponse` contract is unchanged) with one
additive, parser-ignored object key:

```json
{
  "detail": "Authentication credentials were not provided.",
  "error": {
    "code": "not_authenticated",
    "request_id": "50493c93-ae5c-4898-a5f8-edc7ef284342"
  }
}
```

Validation:

```json
{
  "email": ["This field is required."],
  "error": {
    "code": "validation_error",
    "request_id": "…"
  }
}
```

Production 500 (safe message, correlatable id):

```json
{
  "detail": "Internal server error.",
  "error": {
    "code": "internal_server_error",
    "request_id": "…"
  }
}
```

---

# 8. Log Levels

| Level | Used for |
|-------|----------|
| DEBUG | `request_started`, auth/permission success internals |
| INFO | `request_completed` 2xx/3xx |
| WARNING | `request_completed` 4xx, all 4xx diagnostics (401/403/404/405/409/429), throttling + cache fallbacks |
| ERROR | `request_completed` 5xx, `unhandled_exception`, `database_error`, infrastructure failures |
| CRITICAL | Reserved for severe system failures |

4xx responses are never ERROR. Django's duplicate per-4xx one-liners
(`Unauthorized: …`, `Not Found: …`) are suppressed at the
`django.request` logger — the structured records above replace them.

---

# 9. Configuration

Environment variables (see `backend/.env.example`):

```env
LOG_LEVEL=INFO        # DEBUG | INFO | WARNING | ERROR | CRITICAL
LOG_FORMAT=           # empty = automatic (JSON unless DEBUG), or json/console
```

JSON rendering is automatic in non-DEBUG environments (log aggregation);
human-readable console otherwise. Request bodies and SQL are never
logged by design (stronger than a toggle). Tracebacks are always logged
server-side for 5xx and never sent to clients.

---

# 10. Worked Incidents

## POST /api/v1/audit/ → 401

Unauthenticated callers fail closed before method dispatch: the three
default authenticators (SimpleJWT/Basic/Session) find no credentials,
the permission layer denies, and the handler coerces to 401.

```text
authentication_failed reason=missing_credentials
  authentication_classes=[JWTAuthentication, BasicAuthentication,
  SessionAuthentication] path=/api/v1/audit/
request_completed status_code=401
```

Fix client-side: attach `Authorization: Bearer <access-token>`. If a
token IS sent, `reason` distinguishes expired/invalid/revoked/malformed
and names the failing scheme/class.

## POST /api/v1/audit/ → 405 (authenticated)

The bare path is DRF's auto-generated API root (GET-only index of the
eight read-only audit collections). No audit ViewSet implements
`create()` — records are append-only, written by internal services.

```text
method_not_allowed requested_method=POST allowed_methods=[GET, HEAD, OPTIONS]
  route=api/v1/audit/ view=APIRootView
```

Root cause: **frontend/backend contract mismatch**, not an auth bug.
`AuditService.recordLog`/`BaseRepository.create` plus the MSW mocks
assume a writable collection at the bare path, but the backend never
implemented it (`recordLog` currently has zero call sites). Do not add
a POST endpoint to silence the error — align the caller with an existing
collection route or remove the dead call path.

---

# 11. Redaction

Automatic, at the logging pipeline (not per call site):

- Event keys matching `SENSITIVE_KEYS` (`password`, `token`,
  `authorization`, `cookie`, `api_key`, `secret`, … — full list in
  `apps/core/logging/constants.py`) are replaced with `***REDACTED***`.
- Query parameters with sensitive names are dropped; other values are
  truncated.
- Validation summaries keep field names but replace values for
  sensitive fields with `"Invalid value."`.
- Tokens, headers, cookies, and request bodies are never logged.
- `request_id` values are sanitized against log injection.

---

# 12. Debugging Playbook

1. Take `request_id` from the client error (`error.request_id`) or the
   `X-Request-ID` response header.
2. Search backend logs for `request_id=<id>`.
3. Read the diagnostic record (`authentication_failed`, …) for the
   `reason`, then `request_completed` for status/duration.
4. For 500s, the `unhandled_exception` record has the traceback and
   `exception_type`; find the frame in `apps/…` for the fix location.
5. For 401s, check `reason` + `authentication_classes` + `auth_scheme`.
6. For 403s, check `permission_classes` + `view`/`view_action`.
7. For 405s, compare `requested_method` vs `allowed_methods` + `route`.
8. For 429s, check `throttle_scope`; for cache fallbacks, `reason`.

---

# 13. Performance Notes

- Context building is attribute reads only — no database queries, no
  body parsing, no serialization of payloads.
- Permission-denial attribution re-evaluates `has_permission` only on
  the 403 path (pure checks; guarded so diagnostics never raise).
- One completion record per request; DEBUG lifecycle events are off by
  default outside development.
