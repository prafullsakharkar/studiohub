# Identity Phase 1 — Revocation & Lifecycle Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make revocation immediate and observable across StudioHub identity — password changes, logouts, deactivations, RBAC edits, and locked accounts — without schema churn.

**Architecture:** Sessions remain the source of truth for refresh validity. Phase 1 adds: a `revoke_all_for_user` token/session sweep called from every password/lifecycle action; SecurityEvent producers; a `must_change_password` JWT claim + SPA forced screen; username-only lockout with REMOTE_ADDR-only IPs and fail-closed login throttles; signal-driven RBAC cache invalidation; transactional rotation; and a cache-backed access-jti session check for ≤60 s access-token revocation.

**Tech Stack:** Django 6 / DRF / django-simplejwt (blacklist app installed), Redis cache (LocMem in tests), React 18 + react-router + ky (frontend sub-stream).

**Spec:** `backend/docs/superpowers/specs/2026-10-20-identity-phase1-revocation-hardening-design.md` (backend repo). The plan argues from the spec; executors read both.

## Global Constraints

- Backend repo `/home/prafull.sakharkar/Repository/github/studiohub/backend`, branch `develop`; FE repo `/home/prafull.sakharkar/Repository/github/studiohub-react`, branch `main`.
- No schema migrations unless a task explicitly says so; **no RunPython, no data backfills** (fresh-DB policy).
- TDD: production code only after a watched failing test. Every task ends with a commit.
- Verification conventions: targeted pytest + `ruff check` per commit; full `DJANGO_ENV=testing uv run pytest -q --no-cov -p no:cacheprovider` (currently 1631 passed) + `python manage.py makemigrations --check --dry-run` clean before push; FE: `pnpm tsc --noEmit`, `pnpm vitest run`, e2e smoke via warm vite (`PORT=3100 pnpm dev` background) + `E2E_EXTERNAL_SERVER=1 pnpm exec playwright test ... --workers=1 --retries=1`.
- Test env command prefix: `DJANGO_ENV=testing uv run pytest ... -q --no-cov -p no:cacheprovider`.
- Client IP is REMOTE_ADDR-only everywhere (user decision); lockout keying is username-only (user decision); `must_change_password` = token claim + forced screen (user decision).
- Never log credentials/tokens. SecurityEvent `metadata` may hold event context, never secrets.

## Review Focus

The spec is silent on these inputs; each is pinned by a test in the owning task:

1. **A login request from a proxy/LB** — all users share one IP; lockout must not go global, so IP must never gate login (username-only counter) and throttling must stay per-REMOTE_ADDR. → Task 2 + Task 1 tests.
2. **A client replaying an already-rotated refresh token at logout** — blacklist of an already-blacklisted token must not 500 logout. → Task 4 (TokenService.logout tolerance) test.
3. **An access token whose session row is missing** (e.g. swept by cleanup) — access-jti check must fail closed (401), not pass silently. → Task 13 test.
4. **RBAC writes through bulk `queryset.delete()`** — Django does not fire `post_delete` for bulk deletes; invalidation must still work for the serializer-driven single-row writes the API actually uses, and the limitation must be documented. → Task 11 test + comment.
5. **`must_change_password` user hitting a deep link** — every protected route must funnel to the change screen, not just the dashboard. → Task 14 (guard in `AuthenticatedRoute`, which wraps all protected routes) e2e check.

---

### Task 1: REMOTE_ADDR-only client IP extraction (WS6.2)

**Files:**
- Modify: `backend/apps/identity/authentication/utils.py:14-24` (`AuthenticationUtils.get_client_ip`)
- Modify: `backend/apps/identity/authentication/base.py:84-97` (`IdentityAuthentication.get_client_ip`)
- Modify: `backend/apps/identity/authentication/api_key.py:80-88` (`APIKeyAuthentication._get_ip`)
- Modify: `backend/apps/core/api/throttling.py` (add `get_ident` override on `ResilientScopedRateThrottle`)
- Test: `backend/apps/identity/tests/security/test_client_ip_extraction.py`

**Interfaces:**
- Consumes: `django.http.HttpRequest`
- Produces: `AuthenticationUtils.get_client_ip(request) -> str` (REMOTE_ADDR, never XFF) — later tasks rely on this single source.

- [ ] **Step 1: Write the failing tests**

```python
# backend/apps/identity/tests/security/test_client_ip_extraction.py
from __future__ import annotations

import pytest
from rest_framework.test import APIRequestFactory

from apps.identity.authentication.utils import AuthenticationUtils


def _request_with(xff: str | None, remote: str = "10.0.0.5") -> object:
    factory = APIRequestFactory()
    req = factory.get("/")
    req.META["REMOTE_ADDR"] = remote
    if xff is not None:
        req.META["HTTP_X_FORWARDED_FOR"] = xff
    return req


@pytest.mark.django_db
class TestClientIpIsRemoteAddrOnly:
    def test_xff_is_ignored(self):
        request = _request_with(xff="203.0.113.9, 10.0.0.1")
        assert AuthenticationUtils.get_client_ip(request) == "10.0.0.5"

    def test_no_xff_uses_remote_addr(self):
        request = _request_with(xff=None)
        assert AuthenticationUtils.get_client_ip(request) == "10.0.0.5"

    def test_throttle_ident_uses_remote_addr(self):
        from apps.core.api.throttling import ResilientScopedRateThrottle

        request = _request_with(xff="203.0.113.9")
        throttle = ResilientScopedRateThrottle()
        assert throttle.get_ident(request) == "10.0.0.5"
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/security/test_client_ip_extraction.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — `test_xff_is_ignored` returns `"203.0.113.9"` today.

- [ ] **Step 3: Implement REMOTE_ADDR-only extraction**

```python
# backend/apps/identity/authentication/utils.py — replace get_client_ip body
    @staticmethod
    def get_client_ip(
        request: HttpRequest,
    ) -> str:
        # REMOTE_ADDR only. X-Forwarded-For is client-supplied and must
        # never be trusted for lockout/throttle/forensics decisions.
        return request.META.get(
            "REMOTE_ADDR",
            "",
        )
```

```python
# backend/apps/identity/authentication/base.py — replace get_client_ip body
    def get_client_ip(
        self,
        request,
    ) -> str | None:
        from apps.identity.authentication.utils import AuthenticationUtils

        return AuthenticationUtils.get_client_ip(
            request,
        )
```

```python
# backend/apps/identity/authentication/api_key.py — replace _get_ip body
    def _get_ip(
        self,
        request,
    ):
        from apps.identity.authentication.utils import AuthenticationUtils

        return AuthenticationUtils.get_client_ip(
            request,
        )
```

```python
# backend/apps/core/api/throttling.py — add get_ident override to ResilientScopedRateThrottle
    def get_ident(self, request):
        # REMOTE_ADDR only; DRF's default trusts X-Forwarded-For, which is
        # client-supplied and must not drive rate limiting.
        return request.META.get(
            "REMOTE_ADDR",
            "127.0.0.1",
        )
```

- [ ] **Step 4: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/security/test_client_ip_extraction.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Collateral + commit**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests -q --no-cov -p no:cacheprovider` then `.venv/bin/ruff check apps/identity/authentication/ apps/core/api/throttling.py`
Expected: identity suite green (throttle ident change affects only scoped-throttle tests; login tests use `REMOTE_ADDR` of the test client).

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/authentication/utils.py apps/identity/authentication/base.py apps/identity/authentication/api_key.py apps/core/api/throttling.py apps/identity/tests/security/test_client_ip_extraction.py
git commit -m "fix(identity): client IP is REMOTE_ADDR-only (XFF never trusted)"
```

---

### Task 2: Username-only login lockout (WS6.1)

**Files:**
- Modify: `backend/apps/identity/validators/authentication.py:101-120` (`validate_login_attempts`)
- Test: `backend/apps/identity/tests/validators/test_username_lockout.py`

**Interfaces:**
- Consumes: `LoginAttempt.objects.failed()`, `.for_username(username)`, `.recent(minutes)` (all exist on `LoginAttemptQuerySet`)
- Produces: unchanged signature `validate_login_attempts(*, username, ip_address) -> None` (raises `TooManyLoginAttempts`); `ip_address` retained as parameter for call-site compatibility but unused for counting.

- [ ] **Step 1: Write the failing tests**

```python
# backend/apps/identity/tests/validators/test_username_lockout.py
from __future__ import annotations

import pytest
from django.utils import timezone

from apps.identity.exceptions.authentication import TooManyLoginAttempts
from apps.identity.models import LoginAttempt
from apps.identity.validators.authentication import (
    AuthenticationValidator,
)

MAX_ATTEMPTS = AuthenticationValidator.MAX_LOGIN_ATTEMPTS  # 5
WINDOW = AuthenticationValidator.MAX_LOGIN_ATTEMPT_WINDOW_MINUTES  # 15


def _fail(username: str, ip: str, minutes_ago: int = 0) -> None:
    LoginAttempt.objects.create(
        username=username,
        ip_address=ip,
        success=False,
        attempted_at=timezone.now() - timezone.timedelta(minutes=minutes_ago),
    )


@pytest.mark.django_db
class TestUsernameOnlyLockout:
    def test_lockout_counts_same_username_across_ips(self):
        # 5 failures for one username spread over 5 different IPs must lock.
        for i in range(MAX_ATTEMPTS):
            _fail("victim@example.com", f"10.0.{i}.1")

        with pytest.raises(TooManyLoginAttempts):
            AuthenticationValidator.validate_login_attempts(
                username="victim@example.com",
                ip_address="10.9.9.9",
            )

    def test_distinct_usernames_at_same_ip_do_not_lock(self):
        # 5 failures across 5 different usernames at one IP must NOT lock.
        for i in range(MAX_ATTEMPTS):
            _fail(f"user{i}@example.com", "10.0.0.1")

        AuthenticationValidator.validate_login_attempts(
            username="fresh@example.com",
            ip_address="10.0.0.1",
        )  # must not raise

    def test_old_failures_do_not_count(self):
        for _ in range(MAX_ATTEMPTS):
            _fail("victim@example.com", "10.0.0.1", minutes_ago=WINDOW + 1)

        AuthenticationValidator.validate_login_attempts(
            username="victim@example.com",
            ip_address="10.0.0.1",
        )  # must not raise
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/validators/test_username_lockout.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — `test_lockout_counts_same_username_across_ips` does not raise (pair keying misses across-IP failures).

- [ ] **Step 3: Implement username-only counting**

```python
# backend/apps/identity/validators/authentication.py — replace validate_login_attempts body
    @classmethod
    def validate_login_attempts(
        cls,
        *,
        username: str,
        ip_address: str,
    ):
        # Username-only keying: an attacker rotating source IPs must not
        # bypass the counter. ``ip_address`` is still accepted (and still
        # recorded per-attempt for forensics) but does not gate the count.
        failed_attempts = (
            LoginAttempt.objects.failed()
            .for_username(username)
            .recent(cls.MAX_LOGIN_ATTEMPT_WINDOW_MINUTES)
            .count()
        )

        if failed_attempts >= cls.MAX_LOGIN_ATTEMPTS:
            raise TooManyLoginAttempts()
```

- [ ] **Step 4: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/validators/test_username_lockout.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Collateral + commit**

Run: identity tests suite (lockout behavior tests in `test_auth_security.py` still pass — they assert lockout after 5 failures, which username-only still satisfies for same-username cases).
Expected: green.

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/validators/authentication.py apps/identity/tests/validators/test_username_lockout.py
git commit -m "fix(identity): login lockout keys on username across all IPs"
```

---

### Task 3: Fail-closed login/refresh throttles (WS6.3)

**Files:**
- Modify: `backend/apps/core/api/throttling.py` (add `FailClosedScopedRateThrottle`)
- Modify: `backend/apps/identity/api/views/auth_compat.py` (`AuthLoginView`, `AuthRefreshView` `throttle_classes`)
- Modify: `backend/apps/identity/api/views/authentication/login.py`, `.../refresh.py` (legacy views `throttle_classes`)
- Modify: `backend/apps/identity/tests/api/test_auth_security.py` (flip `test_login_survives_cache_outage`; extend `test_login_scope_configured`; add fail-open parallel test)
- Test: `backend/apps/identity/tests/api/test_throttle_fail_closed.py`

**Interfaces:**
- Consumes: `ResilientScopedRateThrottle` (existing)
- Produces: `apps.core.api.throttling.FailClosedScopedRateThrottle(ResilientScopedRateThrottle)` — same interface, cache-outage fallback = deny.

- [ ] **Step 1: Write the failing test**

```python
# backend/apps/identity/tests/api/test_throttle_fail_closed.py
from __future__ import annotations

from unittest import mock

import pytest
from rest_framework.throttling import SimpleRateThrottle

from apps.identity.api.views.auth_compat import AuthLoginView


class BrokenCache:
    def get(self, *args, **kwargs):
        raise ConnectionError("redis down")

    def set(self, *args, **kwargs):
        raise ConnectionError("redis down")


@pytest.mark.django_db
class TestLoginThrottleFailsClosedOnCacheOutage:
    def test_login_throttle_classes_use_fail_closed(self):
        from apps.core.api.throttling import FailClosedScopedRateThrottle

        assert FailClosedScopedRateThrottle in AuthLoginView.throttle_classes

    def test_login_denied_on_cache_outage(self, api_client):
        from apps.identity.tests.factories import UserFactory

        user = UserFactory.create(is_email_verified=True)
        user.set_password("secret123")
        user.save(update_fields=["password"])

        with mock.patch.object(SimpleRateThrottle, "cache", BrokenCache()):
            response = api_client.post(
                "/api/v1/auth/login/",
                {"email": user.email, "password": "secret123"},
            )

        assert response.status_code == 429
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/api/test_throttle_fail_closed.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — login returns 200 today (fail-open), and `FailClosedScopedRateThrottle` is not in `throttle_classes`.

- [ ] **Step 3: Implement fail-closed throttle + apply to login/refresh**

```python
# backend/apps/core/api/throttling.py — append
class FailClosedScopedRateThrottle(ResilientScopedRateThrottle):
    """
    ScopedRateThrottle that fails CLOSED when the cache backend is down.

    Used for login/refresh: a cache outage must not turn authentication
    into an unthrottled brute-force target. The login path itself stays
    up (Django session + DB); only rate limiting degrades to deny.
    """

    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception as exc:
            get_logger("throttling").warning(
                events.THROTTLE_CACHE_FALLBACK,
                backend=_cache_backend_name(),
                operation="throttle_check",
                scope=getattr(view, getattr(self, "scope_attr", "throttle_scope"), None),
                reason=classify_cache_error(exc),
                exception_type=type(exc).__name__,
                fallback="deny",
            )

            return False
```

```python
# backend/apps/identity/api/views/auth_compat.py — AuthLoginView & AuthRefreshView
from apps.core.api.throttling import FailClosedScopedRateThrottle

# in class AuthLoginView:  (and AuthRefreshView)
    throttle_classes = (FailClosedScopedRateThrottle,)
```

Apply the same two-line `throttle_classes` change to the legacy `LoginAPIView` (`apps/identity/api/views/authentication/login.py`) and `RefreshAPIView` (`.../refresh.py`).

- [ ] **Step 4: Update the flipped existing test**

In `backend/apps/identity/tests/api/test_auth_security.py`:
- `test_login_scope_configured`: assert `FailClosedScopedRateThrottle in AuthLoginView.throttle_classes` (replace the `ResilientScopedRateThrottle` assertion).
- `test_login_survives_cache_outage` → rename `test_login_denied_on_cache_outage`; assert `response.status_code == 429` (was 200).
- Add `test_other_throttle_scopes_still_fail_open`:

```python
    def test_other_throttle_scopes_still_fail_open(self, api_client):
        # Non-login scoped throttles keep the fail-open contract: a plain
        # ResilientScopedRateThrottle must ALLOW on cache outage.
        from unittest import mock

        from rest_framework.throttling import SimpleRateThrottle

        from apps.core.api.throttling import ResilientScopedRateThrottle

        throttle = ResilientScopedRateThrottle()
        request = APIRequestFactory().post("/")
        request.META["REMOTE_ADDR"] = "10.0.0.5"

        with mock.patch.object(SimpleRateThrottle, "cache", BrokenCache()):
            allowed = throttle.allow_request(request, view=None)

        assert allowed is True
```

(Add `from rest_framework.test import APIRequestFactory` to the test file imports.)

- [ ] **Step 5: Run all throttle + auth tests to verify**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/api/test_throttle_fail_closed.py apps/identity/tests/api/test_auth_security.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/core/api/throttling.py apps/identity/api/views/auth_compat.py apps/identity/api/views/authentication/login.py apps/identity/api/views/authentication/refresh.py apps/identity/tests/api/test_throttle_fail_closed.py apps/identity/tests/api/test_auth_security.py
git commit -m "fix(identity): login/refresh throttles fail closed on cache outage"
```

---

### Task 4: `revoke_all_for_user` — session logout + blacklist sweep (WS1/WS2/WS3 foundation)

**Files:**
- Modify: `backend/apps/identity/authentication/jwt.py` (add `blacklist_sweep_for_user`)
- Modify: `backend/apps/identity/authentication/token.py` (add `revoke_all_for_user`; make `logout` tolerate already-blacklisted tokens)
- Test: `backend/apps/identity/tests/services/test_revoke_all_services.py`

**Interfaces:**
- Consumes: `UserSessionService.logout_all(user, reason)`; `UserSession.objects.active().by_user(user)`; `rest_framework_simplejwt.token_blacklist.models.{OutstandingToken, BlacklistedToken}`
- Produces:
  - `JWTService.blacklist_sweep_for_user(*, user) -> int` (count swept jtis; idempotent)
  - `TokenService.revoke_all_for_user(*, user, reason=LogoutReason.USER) -> int`
  - Relies on existing parse-time blacklist enforcement (`BlacklistMixin.verify()` → `_translate_token_error` → `SessionRevoked`); the sweep makes that enforcement effective for swept jtis.

- [ ] **Step 1: Write the failing tests**

```python
# backend/apps/identity/tests/services/test_revoke_all_services.py
from __future__ import annotations

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.authentication.jwt import JWTService
from apps.identity.authentication.token import TokenService
from apps.identity.choices import LogoutReason, SessionStatus
from apps.identity.models import UserSession
from apps.identity.tests.factories import UserFactory
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken


@pytest.mark.django_db
class TestRevokeAllForUser:
    def test_revoke_all_logs_out_sessions_and_blacklists(self):
        user = UserFactory.create(is_active=True)
        refresh1 = RefreshToken.for_user(user)
        refresh2 = RefreshToken.for_user(user)

        UserSession.objects.create(
            user=user,
            session_key=refresh1["jti"],
            refresh_token_jti=refresh1["jti"],
            access_token_jti="acc-jti-1",
            status=SessionStatus.ACTIVE,
        )
        UserSession.objects.create(
            user=user,
            session_key=refresh2["jti"],
            refresh_token_jti=refresh2["jti"],
            access_token_jti="acc-jti-2",
            status=SessionStatus.ACTIVE,
        )

        count = TokenService.revoke_all_for_user(user=user)

        assert count == 2
        assert not UserSession.objects.active().by_user(user).exists()
        assert (
            BlacklistedToken.objects.filter(
                token__jti__in=[refresh1["jti"], refresh2["jti"]],
            ).count()
            == 2
        )

    def test_blacklisted_refresh_rejected_by_validation(self):
        user = UserFactory.create(is_active=True)
        refresh = RefreshToken.for_user(user)
        UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="acc-jti",
            status=SessionStatus.ACTIVE,
        )

        TokenService.revoke_all_for_user(user=user)

        from apps.identity.authentication.exceptions import SessionRevoked

        with pytest.raises(SessionRevoked):
            JWTService.validate_refresh_token(str(refresh))

    def test_logout_with_already_blacklisted_refresh_does_not_raise(self):
        user = UserFactory.create(is_active=True)
        refresh = RefreshToken.for_user(user)
        refresh.blacklist()  # rotate path already blacklisted it

        # idempotent logout must not 500
        TokenService.logout(
            session=None,
            refresh_token=str(refresh),
        )
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_revoke_all_services.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — `TokenService.revoke_all_for_user` does not exist (tests 1 and 2 error on the missing method), and `TokenService.logout` with an already-blacklisted refresh raises instead of returning (test 3).

- [ ] **Step 3: Implement sweep + validation enforcement**

```python
# backend/apps/identity/authentication/jwt.py — add method
    @classmethod
    def blacklist_sweep_for_user(
        cls,
        *,
        user,
    ) -> int:
        """
        Blacklist every outstanding refresh token of ``user``.

        Idempotent: sessions already blacklisted are skipped. Returns the
        number of refresh jtis swept. Access tokens cannot be blacklisted
        by simplejwt; session-status enforcement covers them (Task 13).
        """
        from apps.identity.models import UserSession
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )

        jtis = list(
            UserSession.objects.active()
            .by_user(user)
            .values_list("refresh_token_jti", flat=True)
        )

        swept = 0
        for jti in jtis:
            if not jti:
                continue
            outstanding, _ = OutstandingToken.objects.get_or_create(
                jti=jti,
                defaults={
                    "user": user,
                    "token": f"jti:{jti}",
                },
            )
            _, created = BlacklistedToken.objects.get_or_create(
                token=outstanding,
            )
            if created:
                swept += 1

        return swept
```

**No change needed to `validate_refresh_token`.** `JWTService.refresh_token_class = RefreshToken` (the standard simplejwt class) inherits `BlacklistMixin`, which — because `rest_framework_simplejwt.token_blacklist` is in `INSTALLED_APPS` — overrides `verify()` to call `check_blacklist()` first. Every parse through `decode_refresh_token` therefore already rejects a blacklisted jti with `TokenError("Token is blacklisted")`, which `_translate_token_error` maps to `SessionRevoked`. The sweep's `BlacklistedToken` rows become live immediately; `test_blacklisted_refresh_rejected_by_validation` passes via this existing path. Do NOT add an explicit `check_blacklist()` call — it would be dead code.

```python
# backend/apps/identity/authentication/token.py — add method
    @classmethod
    def revoke_all_for_user(
        cls,
        *,
        user,
        reason=LogoutReason.USER,
    ) -> int:
        from apps.identity.services.user_session import UserSessionService

        UserSessionService.logout_all(
            user=user,
            reason=reason,
        )

        return JWTService.blacklist_sweep_for_user(
            user=user,
        )
```

```python
# backend/apps/identity/authentication/token.py — make logout idempotent
    @classmethod
    def logout(
        cls,
        *,
        session,
        refresh_token: str | None = None,
    ):
        from apps.identity.services.user_session import UserSessionService

        if refresh_token:
            try:
                JWTService.blacklist(
                    refresh_token,
                )
            except Exception:
                # Already blacklisted/rotated — logout stays idempotent.
                pass

        if session is not None:
            UserSessionService.logout(
                session,
            )
```

Note: `JWTService.blacklist` itself calls `validate_refresh_token`, which already raises `SessionRevoked` for blacklisted tokens (parse-time enforcement) — the try/except above keeps logout 200 for replays.

- [ ] **Step 4: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_revoke_all_services.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Collateral + commit**

Run: identity tests + `apps/identity/tests/api/test_auth_refresh_rotation.py` (reuse-denial tests now have a second enforcement layer).
Expected: green.

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/authentication/jwt.py apps/identity/authentication/token.py apps/identity/tests/services/test_revoke_all_services.py
git commit -m "feat(identity): revoke_all_for_user session sweep + refresh blacklist enforcement"
```

---

### Task 5: Password change revokes everything + SecurityEvent (WS1)

**Files:**
- Modify: `backend/apps/identity/services/password.py:8-34` (`PasswordService.change_password`)
- Modify: `backend/apps/identity/api/serializers/authentication/change_password.py` (pass request)
- Test: `backend/apps/identity/tests/services/test_password_revocation.py`

**Interfaces:**
- Consumes: `TokenService.revoke_all_for_user` (Task 4); `SecurityEventService.create`; `SecurityEventType.PASSWORD_CHANGED`
- Produces: `PasswordService.change_password(*, user, old_password, new_password, request=None) -> None` — revokes all sessions, blacklists sweep, writes SecurityEvent.

- [ ] **Step 1: Write the failing tests**

```python
# backend/apps/identity/tests/services/test_password_revocation.py
from __future__ import annotations

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.choices import SecurityEventType, SessionStatus
from apps.identity.models import SecurityEvent, UserSession
from apps.identity.services.password import PasswordService
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestPasswordChangeRevokes:
    def test_change_password_revokes_sessions_and_records_event(self):
        user = UserFactory.create(is_active=True)
        user.set_password("old-pass-1")
        user.save(update_fields=["password"])
        refresh = RefreshToken.for_user(user)
        UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="acc-jti",
            status=SessionStatus.ACTIVE,
        )

        PasswordService.change_password(
            user=user,
            old_password="old-pass-1",
            new_password="new-pass-1",
        )

        assert not UserSession.objects.active().by_user(user).exists()
        event = SecurityEvent.objects.filter(
            user=user,
            event_type=SecurityEventType.PASSWORD_CHANGED,
        ).first()
        assert event is not None
        assert user.check_password("new-pass-1")

    def test_change_password_rejects_wrong_old_password(self):
        # PasswordService raises the core exception class (not the identity
        # one) — import from the same module the service uses.
        from apps.core.api.exceptions.authentication import InvalidCredentials

        user = UserFactory.create(is_active=True)
        user.set_password("old-pass-1")
        user.save(update_fields=["password"])

        with pytest.raises(InvalidCredentials):
            PasswordService.change_password(
                user=user,
                old_password="wrong",
                new_password="new-pass-1",
            )
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_password_revocation.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — no SecurityEvent row; sessions remain ACTIVE.

- [ ] **Step 3: Implement**

```python
# backend/apps/identity/services/password.py — replace change_password body
    @classmethod
    def change_password(
        cls,
        *,
        user,
        old_password,
        new_password,
        request=None,
    ):

        if not check_password(
            old_password,
            user.password,
        ):
            raise InvalidCredentials()

        user.set_password(
            new_password,
        )

        user.save(
            update_fields=[
                "password",
            ]
        )

        from apps.identity.authentication.token import TokenService
        from apps.identity.services.security_event import SecurityEventService

        TokenService.revoke_all_for_user(
            user=user,
        )

        SecurityEventService.create(
            user=user,
            event_type=SecurityEventType.PASSWORD_CHANGED,
            ip_address=(
                AuthenticationUtils.get_client_ip(request)
                if request is not None
                else None
            ),
            user_agent=(
                request.META.get("HTTP_USER_AGENT", "")
                if request is not None
                else ""
            ),
            description="Password changed by the user.",
            metadata={"origin": "self"},
        )
```

```python
# backend/apps/identity/api/serializers/authentication/change_password.py — pass request
    def save(self, **kwargs):
        PasswordService.change_password(
            user=self.context["request"].user,
            old_password=self.validated_data["old_password"],
            new_password=self.validated_data["new_password"],
            request=self.context["request"],
        )
```

Add `AuthenticationUtils` (`apps.identity.authentication.utils`) and `SecurityEventType` (`apps.identity.choices`) imports to `services/password.py`. (The snippet's `TokenService` and `SecurityEventService` imports are already inline in the method.)

- [ ] **Step 4: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_password_revocation.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Collateral + commit**

Run: identity tests (`test_authentication_service_services.py` exercises password change paths).
Expected: green.

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/services/password.py apps/identity/api/serializers/authentication/change_password.py apps/identity/tests/services/test_password_revocation.py
git commit -m "feat(identity): password change revokes all sessions and records SecurityEvent"
```

---

### Task 6: Admin change/reset paths + `must_change_password` claim (WS1)

**Files:**
- Modify: `backend/apps/identity/services/user_password.py` (`UserPasswordService.change_password` → delegate + revoke + event)
- Modify: `backend/apps/identity/services/user.py` (admin reset action sets `must_change_password` + revoke + event)
- Modify: `backend/apps/identity/authentication/jwt.py` (`create_refresh_token` claim)
- Modify: `backend/apps/identity/api/serializers/frontend_user.py` (`serialize_frontend_user` flag)
- Test: `backend/apps/identity/tests/services/test_admin_password_reset.py`, `backend/apps/identity/tests/api/test_must_change_password_claim.py`

**Interfaces:**
- Consumes: `PasswordService`-style revocation (Task 5 pattern), `Profile.must_change_password`
- Produces:
  - `UserPasswordService.change_password(user, password)` — validators + revoke + event (no old-password check; admin path)
  - `UserService.reset_password(instance, *, user=None)` — sets `must_change_password=True`, revoke, `SecurityEventType.PASSWORD_RESET`
  - JWT access+refresh carry claim `must_change_password`
  - `serialize_frontend_user` returns `must_change_password`

- [ ] **Step 1: Write the failing tests**

```python
# backend/apps/identity/tests/services/test_admin_password_reset.py
from __future__ import annotations

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.choices import SecurityEventType, SessionStatus
from apps.identity.models import SecurityEvent, UserSession
from apps.identity.services.user import UserService
from apps.identity.services.user_password import UserPasswordService
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestAdminPasswordPaths:
    def test_weak_password_rejected_on_admin_change(self):
        from django.core.exceptions import ValidationError

        user = UserFactory.create(is_active=True)
        user.set_password("old-pass-1")
        user.save(update_fields=["password"])

        with pytest.raises(ValidationError):
            UserPasswordService.change_password(user=user, password="weak")

    def test_admin_reset_sets_flag_revokes_and_events(self):
        user = UserFactory.create(is_active=True)
        refresh = RefreshToken.for_user(user)
        UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="acc-jti",
            status=SessionStatus.ACTIVE,
        )

        UserService.reset_password(instance=user, user=user)

        assert not UserSession.objects.active().by_user(user).exists()
        user.refresh_from_db()
        profile = user.profile
        assert profile.must_change_password is True
        assert SecurityEvent.objects.filter(
            user=user,
            event_type=SecurityEventType.PASSWORD_RESET,
        ).exists()
```

```python
# backend/apps/identity/tests/api/test_must_change_password_claim.py
from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.authentication.jwt import JWTService
from apps.identity.tests.factories import ProfileFactory, UserFactory


@pytest.mark.django_db
class TestMustChangePasswordClaim:
    def test_tokens_carry_claim_when_flag_set(self):
        user = UserFactory.create(is_active=True)
        ProfileFactory.create(user=user, must_change_password=True)

        access, refresh = JWTService.create_token_pair(user)

        decoded_access = JWTService.decode_access_token(access)
        assert decoded_access["must_change_password"] is True

    def test_me_payload_exposes_flag(self):
        user = UserFactory.create(is_active=True)
        ProfileFactory.create(user=user, must_change_password=True)

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/v1/auth/me/")

        assert response.status_code == 200
        assert response.data["must_change_password"] is True
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_admin_password_reset.py apps/identity/tests/api/test_must_change_password_claim.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — claim missing; `UserService.reset_password` missing; weak password accepted.

- [ ] **Step 3: Implement**

```python
# backend/apps/identity/services/user_password.py — replace change_password body
    @classmethod
    def change_password(
        cls,
        user,
        password,
    ):
        from django.contrib.auth.password_validation import validate_password

        validate_password(password, user=user)

        user.password = make_password(
            password,
        )

        user.save(
            update_fields=[
                "password",
                "updated_at",
            ],
        )

        profile = getattr(
            user,
            "profile",
            None,
        )

        if profile and profile.must_change_password:
            profile.must_change_password = False

            profile.save(
                update_fields=[
                    "must_change_password",
                    "updated_at",
                ],
            )

        from apps.identity.authentication.token import TokenService
        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        TokenService.revoke_all_for_user(
            user=user,
        )

        SecurityEventService.create(
            user=user,
            event_type=SecurityEventType.PASSWORD_CHANGED,
            description="Password changed via the admin/user management path.",
            metadata={"origin": "admin"},
        )
```

Add `Profile` to the `from apps.identity.models import (User,)` import in `user.py` before this step.

```python
# backend/apps/identity/services/user.py — add reset_password classmethod
    @classmethod
    def reset_password(
        cls,
        instance,
        *,
        user=None,
    ):
        """Admin password reset: force a change on next login, revoke all."""
        profile, _ = Profile.objects.get_or_create(
            user=instance,
        )

        profile.must_change_password = True

        profile.save(
            update_fields=[
                "must_change_password",
                "updated_at",
            ],
        )

        from apps.identity.authentication.token import TokenService
        from apps.identity.choices import SecurityEventType
        from apps.identity.services.security_event import SecurityEventService

        TokenService.revoke_all_for_user(
            user=instance,
        )

        SecurityEventService.create(
            user=instance,
            event_type=SecurityEventType.PASSWORD_RESET,
            description="Password reset by an administrator.",
            metadata={"origin": "admin"},
        )

        return instance
```

```python
# backend/apps/identity/authentication/jwt.py — create_refresh_token sets claim
    @classmethod
    def create_refresh_token(
        cls,
        user,
    ) -> RefreshToken:
        refresh = cls.refresh_token_class.for_user(
            user,
        )

        profile = getattr(
            user,
            "profile",
            None,
        )

        if profile is not None:
            refresh["must_change_password"] = bool(
                profile.must_change_password,
            )

        return refresh
```

```python
# backend/apps/identity/api/serializers/frontend_user.py — inside serialize_frontend_user
    "must_change_password": bool(
        getattr(profile, "must_change_password", False),
    ),
```

- [ ] **Step 4: Wire the viewset actions**

In `apps/identity/api/viewsets/user.py`:

- **`reset_password` action** (detail, `url_path="reset-password"`, currently calls the email stub `PasswordService.request_password_reset(user.email)`): replace the body with `UserService.reset_password(instance=user, user=request.user)` and return `{"detail": "Password reset. The user must change their password on next sign-in."}`. **This is a deliberate response-contract change** (the old email-generic message no longer applies) — update `apps/identity/tests/api/viewsets/test_user_viewset_actions.py` if it asserted the old message.
- **`force_password_change` action** (detail, already sets `profile.must_change_password = True` directly): replace its body with the same `UserService.reset_password(instance=user, user=request.user)` call, keeping its existing response message. Delegation is idempotent (flag re-set, sessions revoked, SecurityEvent recorded) and removes the duplicated ProfileService logic.
- **`change_password` action** (detail=False, self-service legacy endpoint): no action needed — it already delegates to `UserPasswordService.change_password`, which Step 3 makes revoke+event.

- [ ] **Step 5: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_admin_password_reset.py apps/identity/tests/api/test_must_change_password_claim.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 6: Collateral + commit**

Run: identity tests + `apps/identity/tests/api/viewsets/test_user_viewset_actions.py` (reset-password action shape).
Expected: green (update the action test if it asserted the old stub's no-op response — the response contract is preserved).

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/services/user_password.py apps/identity/services/user.py apps/identity/authentication/jwt.py apps/identity/api/serializers/frontend_user.py apps/identity/api/viewsets/user.py apps/identity/tests/services/test_admin_password_reset.py apps/identity/tests/api/test_must_change_password_claim.py
git commit -m "feat(identity): admin reset forces password change + must_change_password token claim"
```

---

### Task 7: `POST /api/v1/auth/change-password/` compat endpoint (WS1 FE contract)

**Files:**
- Create: `backend/apps/identity/api/views/auth_change_password.py`
- Modify: `backend/apps/identity/api/urls_auth_compat.py` (mount `/change-password/`)
- Test: `backend/apps/identity/tests/api/test_auth_compat_change_password.py`

**Interfaces:**
- Consumes: `PasswordService.change_password` (Task 5), `ChangePasswordSerializer` shape
- Produces: `POST /api/v1/auth/change-password/` → 200 `{"detail": ...}` (no tokens — sessions revoked); 401 on wrong old password; 400 on weak password.

- [ ] **Step 1: Write the failing test**

```python
# backend/apps/identity/tests/api/test_auth_compat_change_password.py
from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestAuthCompatChangePassword:
    def test_change_password_succeeds_and_returns_detail(self):
        user = UserFactory.create(is_active=True)
        user.set_password("old-pass-1")
        user.save(update_fields=["password"])

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/v1/auth/change-password/",
            {
                "old_password": "old-pass-1",
                "new_password": "new-pass-1",
                "confirm_password": "new-pass-1",
            },
            format="json",
        )

        assert response.status_code == 200
        assert "detail" in response.data
        user.refresh_from_db()
        assert user.check_password("new-pass-1")

    def test_wrong_old_password_returns_401(self):
        user = UserFactory.create(is_active=True)
        user.set_password("old-pass-1")
        user.save(update_fields=["password"])

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/v1/auth/change-password/",
            {
                "old_password": "wrong",
                "new_password": "new-pass-1",
                "confirm_password": "new-pass-1",
            },
            format="json",
        )

        assert response.status_code == 401

    def test_requires_authentication(self):
        client = APIClient()

        response = client.post(
            "/api/v1/auth/change-password/",
            {
                "old_password": "x",
                "new_password": "new-pass-1",
                "confirm_password": "new-pass-1",
            },
            format="json",
        )

        assert response.status_code == 401
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/api/test_auth_compat_change_password.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — 404 (route absent).

- [ ] **Step 3: Implement**

```python
# backend/apps/identity/api/views/auth_change_password.py
from __future__ import annotations

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    ChangePasswordSerializer,
)


class AuthChangePasswordView(BaseAPIView):
    """
    Frontend-compatible self password change.

    Deliberately returns NO replacement tokens: the backend revokes every
    session on password change, so the SPA must re-login.
    """

    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)
    serializer_class = ChangePasswordSerializer

    @extend_schema(
        request=OpenApiTypes.OBJECT,
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {"detail": "Password changed. All sessions have been signed out."},
            status=status.HTTP_200_OK,
        )
```

```python
# backend/apps/identity/api/urls_auth_compat.py — add route
    path(
        "change-password/",
        AuthChangePasswordView.as_view(),
        name="auth-change-password",
    ),
```

- [ ] **Step 4: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/api/test_auth_compat_change_password.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/api/views/auth_change_password.py apps/identity/api/urls_auth_compat.py apps/identity/tests/api/test_auth_compat_change_password.py
git commit -m "feat(identity): POST /auth/change-password/ compat endpoint"
```

---

### Task 8: Logout terminates the real session (WS2/F8)

**Files:**
- Modify: `backend/apps/identity/api/serializers/authentication/logout.py` (resolve session instead of `session=None`)
- Test: `backend/apps/identity/tests/api/test_logout_terminates_session.py`

**Interfaces:**
- Consumes: `AuthenticationSelector.get_session_by_refresh_jti` / `get_session_by_access_jti`; `request.auth.payload["jti"]`
- Produces: unchanged response contract `{"detail": ...}`; `UserSession` row becomes `LOGGED_OUT` on logout.

- [ ] **Step 1: Write the failing tests**

```python
# backend/apps/identity/tests/api/test_logout_terminates_session.py
from __future__ import annotations

import pytest
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APIClient

from apps.identity.choices import SessionStatus
from apps.identity.models import UserSession
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestLogoutTerminatesSession:
    def test_logout_with_refresh_marks_session_logged_out(self):
        user = UserFactory.create(is_active=True)
        refresh = RefreshToken.for_user(user)
        UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="acc-jti",
            status=SessionStatus.ACTIVE,
        )

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/v1/auth/logout/",
            {"refresh": str(refresh)},
            format="json",
        )

        assert response.status_code == 200
        session = UserSession.objects.get(session_key=refresh["jti"])
        assert session.status == SessionStatus.LOGGED_OUT
        assert session.logged_out_at is not None

    def test_logout_without_refresh_uses_access_jti(self):
        from rest_framework_simplejwt.tokens import AccessToken

        user = UserFactory.create(is_active=True)
        refresh = RefreshToken.for_user(user)
        session = UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="acc-jti",
            status=SessionStatus.ACTIVE,
        )

        access = AccessToken()
        access["jti"] = "acc-jti"

        client = APIClient()
        client.force_authenticate(user=user, token=access)

        response = client.post(
            "/api/v1/auth/logout/",
            {},
            format="json",
        )

        assert response.status_code == 200
        session.refresh_from_db()
        assert session.status == SessionStatus.LOGGED_OUT
```

Note: DRF's `force_authenticate(user=user, token=access)` stores the token as `request.auth`, so the serializer's access-jti branch resolves the session from `request.auth.payload["jti"]`.

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/api/test_logout_terminates_session.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — session stays ACTIVE (today `session=None` is passed).

- [ ] **Step 3: Implement session resolution in logout**

```python
# backend/apps/identity/api/serializers/authentication/logout.py — replace save()
    def save(
        self,
        **kwargs,
    ):
        request = self.context["request"]

        session = None
        refresh_token = self.validated_data.get(
            "refresh",
        ) or None

        if refresh_token:
            from rest_framework_simplejwt.tokens import RefreshToken

            try:
                jti = RefreshToken(refresh_token)["jti"]
            except Exception:
                jti = None
            if jti:
                session = AuthenticationSelector.get_session_by_refresh_jti(
                    refresh_token_jti=jti,
                )
        elif getattr(request, "auth", None) is not None:
            jti = getattr(
                getattr(request, "auth", None),
                "payload",
                {},
            ).get("jti")
            if jti:
                session = AuthenticationSelector.get_session_by_access_jti(
                    access_token_jti=jti,
                )

        AuthenticationService.logout(
            request=request,
            session=session,
            refresh_token=refresh_token,
        )
```

Add the `AuthenticationSelector` import (`from apps.identity.selectors.authentication import AuthenticationSelector`) to the serializer, and record a `SecurityEvent` when a real session is terminated. Modify `AuthenticationService.logout` so the session branch also records the event (Task 5 pattern):

```python
# backend/apps/identity/services/authentication.py — inside logout(), in the
# ``if session is not None:`` branch, after TokenService.logout(...)
            from apps.identity.choices import SecurityEventType
            from apps.identity.services.security_event import SecurityEventService

            SecurityEventService.create(
                user=session.user,
                event_type=SecurityEventType.SESSION_TERMINATED,
                ip_address=AuthenticationUtils.get_client_ip(request),
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
                description="Session terminated by logout.",
                metadata={"session_id": str(session.pk)},
            )
```

`session.user` is loaded via `get_session_by_refresh_jti`/`get_session_by_access_jti` (both `select_related("user")`). Only the `session is not None` path records an event.

- [ ] **Step 4: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/api/test_logout_terminates_session.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Collateral + commit**

Run: identity tests + auth compat suites (existing logout tests assert 200 — unchanged).
Expected: green.

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/api/serializers/authentication/logout.py apps/identity/services/authentication.py apps/identity/tests/api/test_logout_terminates_session.py
git commit -m "fix(identity): logout terminates the UserSession row (F8)"
```

---

### Task 9: Rolling session expiry with absolute cap (WS2/M4)

**Files:**
- Modify: `backend/apps/identity/services/user_session.py:137-168` (`UserSessionService.refresh`)
- Modify: `backend/config/settings/components/jwt.py` (settings)
- Test: `backend/apps/identity/tests/services/test_session_rolling_expiry.py`

**Interfaces:**
- Consumes: `session.expires_at` (existing column)
- Produces: `UserSessionService.refresh` sets `expires_at = min(now + REFRESH_TOKEN_LIFETIME, created_at + SESSION_MAX_ABSOLUTE_LIFETIME)`; settings `SESSION_MAX_ABSOLUTE_LIFETIME_DAYS = 90`.

- [ ] **Step 1: Write the failing test**

```python
# backend/apps/identity/tests/services/test_session_rolling_expiry.py
from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.choices import SessionStatus
from apps.identity.models import UserSession
from apps.identity.services.user_session import UserSessionService
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestRollingSessionExpiry:
    def test_refresh_extends_expiry_within_absolute_cap(self):
        user = UserFactory.create(is_active=True)
        session = UserSession.objects.create(
            user=user,
            session_key="s1",
            refresh_token_jti="r1",
            access_token_jti="a1",
            status=SessionStatus.ACTIVE,
            expires_at=timezone.now() - timedelta(days=1),
        )

        UserSessionService.refresh(
            session,
            access_token_jti="a2",
            refresh_token_jti="r2",
        )

        session.refresh_from_db()
        assert session.expires_at > timezone.now() + timedelta(days=20)

    def test_absolute_cap_never_exceeded(self):
        user = UserFactory.create(is_active=True)
        session = UserSession.objects.create(
            user=user,
            session_key="s2",
            refresh_token_jti="r1",
            access_token_jti="a1",
            status=SessionStatus.ACTIVE,
            created_at=timezone.now() - timedelta(days=85),
            expires_at=timezone.now() + timedelta(days=1),
        )

        UserSessionService.refresh(
            session,
            access_token_jti="a2",
            refresh_token_jti="r2",
        )

        session.refresh_from_db()
        assert session.expires_at <= timezone.now() + timedelta(days=90)
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_session_rolling_expiry.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — expires_at unchanged (stays 1 day in the past / +1 day).

- [ ] **Step 3: Implement**

```python
# backend/config/settings/components/jwt.py — add
SESSION_MAX_ABSOLUTE_LIFETIME_DAYS = 90
```

```python
# backend/apps/identity/services/user_session.py — replace refresh() body
    @classmethod
    def refresh(
        cls,
        session,
        *,
        access_token_jti,
        refresh_token_jti,
    ):
        UserSessionValidator.validate_refresh(
            session,
        )

        from django.conf import settings

        absolute = timedelta(
            days=getattr(
                settings,
                "SESSION_MAX_ABSOLUTE_LIFETIME_DAYS",
                90,
            ),
        )

        now = timezone.now()

        session.expires_at = min(
            now + settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"],
            session.created_at + absolute,
        )

        session.access_token_jti = access_token_jti

        session.refresh_token_jti = refresh_token_jti

        session.save(
            update_fields=[
                "access_token_jti",
                "refresh_token_jti",
                "expires_at",
            ],
        )

        SessionRefreshed.dispatch(
            instance=session,
        )

        return session
```

Add `from datetime import timedelta` if not already imported in the module.

- [ ] **Step 4: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_session_rolling_expiry.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Collateral + commit**

Run: identity tests + `test_auth_refresh_rotation.py`.
Expected: green.

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/services/user_session.py config/settings/components/jwt.py apps/identity/tests/services/test_session_rolling_expiry.py
git commit -m "feat(identity): rolling session expiry capped at 90 days (M4)"
```

---

### Task 10: Deactivation suspends credentials, activation restores (WS3)

**Files:**
- Modify: `backend/apps/identity/services/user.py` (`deactivate`, `archive`, `activate`)
- Modify: `backend/apps/identity/choices/security.py` (add `ACCOUNT_DEACTIVATED`, `ACCOUNT_ACTIVATED`)
- Test: `backend/apps/identity/tests/services/test_deactivation_suspends_credentials.py`

**Interfaces:**
- Consumes: `TokenService.revoke_all_for_user` (Task 4); `SecurityEventService`
- Produces: deactivate/archive → sessions revoked + PAT/ApiKey `is_active=False` + `ACCOUNT_DEACTIVATED` event; activate → `is_active=True` + credentials re-enabled + `ACCOUNT_ACTIVATED` event. The viewset's `suspend`/`unsuspend` actions already delegate to `deactivate`/`activate`, so they inherit this.

- [ ] **Step 1: Write the failing tests**

```python
# backend/apps/identity/tests/services/test_deactivation_suspends_credentials.py
from __future__ import annotations

import pytest

from apps.identity.api_keys.hashing import APIKeyHasher
from apps.identity.choices import SessionStatus
from apps.identity.models import ApiKey, PersonalAccessToken, UserSession
from apps.identity.services.user import UserService
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestDeactivationSuspendsCredentials:
    def _make_creds(self, user):
        PersonalAccessToken.objects.create(
            user=user,
            name="pat",
            prefix="pa",
            hashed_token=APIKeyHasher.hash("pat.secret"),
            is_active=True,
        )
        ApiKey.objects.create(
            name="key",
            prefix="ka",
            hashed_key=APIKeyHasher.hash("key.secret"),
            created_by=user,
            is_active=True,
        )

    def test_deactivate_revokes_sessions_and_suspends_credentials(self):
        user = UserFactory.create(is_active=True)
        self._make_creds(user)
        UserSession.objects.create(
            user=user,
            session_key="s1",
            refresh_token_jti="r1",
            access_token_jti="a1",
            status=SessionStatus.ACTIVE,
        )

        UserService.deactivate(instance=user, user=user)

        user.refresh_from_db()
        assert user.is_active is False
        assert not UserSession.objects.active().by_user(user).exists()
        assert PersonalAccessToken.objects.get(user=user).is_active is False
        assert ApiKey.objects.get(created_by=user).is_active is False

    def test_activate_restores_credentials(self):
        user = UserFactory.create(is_active=False)
        self._make_creds(user)
        # suspended
        PersonalAccessToken.objects.filter(user=user).update(is_active=False)
        ApiKey.objects.filter(created_by=user).update(is_active=False)

        UserService.activate(instance=user, user=user)

        user.refresh_from_db()
        assert user.is_active is True
        assert PersonalAccessToken.objects.get(user=user).is_active is True
        assert ApiKey.objects.get(created_by=user).is_active is True
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_deactivation_suspends_credentials.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — deactivate leaves sessions/credentials active.

- [ ] **Step 3: Implement**

```python
# backend/apps/identity/choices/security.py — extend SecurityEventType
    ACCOUNT_DEACTIVATED = "account_deactivated", "Account Deactivated"
    ACCOUNT_ACTIVATED = "account_activated", "Account Activated"
```

```python
# backend/apps/identity/services/user.py — deactivate body additions
        from apps.identity.authentication.token import TokenService
        from apps.identity.choices import SecurityEventType
        from apps.identity.models import ApiKey, PersonalAccessToken
        from apps.identity.services.security_event import SecurityEventService

        TokenService.revoke_all_for_user(
            user=instance,
        )

        PersonalAccessToken.objects.filter(
            user=instance,
            is_active=True,
        ).update(is_active=False)

        ApiKey.objects.filter(
            created_by=instance,
            is_active=True,
        ).update(is_active=False)

        SecurityEventService.create(
            user=instance,
            event_type=SecurityEventType.ACCOUNT_DEACTIVATED,
            description="Account deactivated.",
        )
```

Apply the same suspension pattern to `archive` (it also flips `is_active=False`), and the restoration pattern to `activate` (re-enable `is_active=True` on the user's PAT/ApiKey rows + `SecurityEventType.ACCOUNT_ACTIVATED`). Keep the existing flag flips, `publish_event`, and `invalidate_cache` calls.

Note: `UserService` has no `restore`/`suspend`/`unsuspend` methods. The viewset's `suspend`/`unsuspend` **actions** already delegate to `UserService.deactivate`/`activate`, so they inherit this behavior with no extra wiring.

- [ ] **Step 4: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_deactivation_suspends_credentials.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Collateral + commit**

Run: identity tests + `apps/identity/tests/api/viewsets/test_user_viewset_actions.py` (suspend/unsuspend/archive actions delegate to the service methods).
Expected: green.

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/services/user.py apps/identity/choices/security.py apps/identity/tests/services/test_deactivation_suspends_credentials.py
git commit -m "feat(identity): deactivation suspends credentials + sessions, activation restores (WS3)"
```

---

### Task 11: Signal-driven RBAC cache invalidation + grant expiry (WS4/C3)

**Files:**
- Create: `backend/apps/identity/signals/rbac.py` (receivers for UserRole, RolePermission, GroupMember, GroupRole, Role, Permission)
- Modify: `backend/apps/identity/signals/__init__.py` (import rbac)
- Modify: `backend/apps/identity/resolvers/permission.py` (enforce `RolePermission.expires_at`)
- Test: `backend/apps/identity/tests/services/test_rbac_cache_invalidation.py`, `backend/apps/identity/tests/resolvers/test_grant_expiry.py`

**Interfaces:**
- Consumes: `PermissionCacheService.invalidate_role_holders`, `invalidate_group_members`, `invalidate_permission_holders`, `invalidate_role_holders_by_id` (all exist)
- Produces: cache version bumps on any RBAC grant write; resolver excludes expired grants.

- [ ] **Step 1: Write the failing tests**

```python
# backend/apps/identity/tests/services/test_rbac_cache_invalidation.py
from __future__ import annotations

import pytest

from apps.identity.models import Role, UserRole
from apps.identity.services.permission_cache import PermissionCacheService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_all_known_codes


@pytest.mark.django_db
class TestRbacCacheInvalidation:
    def test_userrole_write_bumps_cache_version(self):
        user = UserFactory.create()
        grant_all_known_codes(user)
        before = PermissionCacheService.get_permissions(
            user=user,
        )
        assert before  # baseline has grants

        role = Role.objects.create(
            name="Probe Role",
            code="probe-role",
        )

        def _version():
            from django.core.cache import cache

            return cache.get(
                f"identity.permission.version:{user.pk}",
                1,
            )

        v0 = _version()
        UserRole.objects.create(user=user, role=role)
        v1 = _version()
        assert v1 == v0 + 1

    def test_rolepermission_delete_bumps_holder_versions(self):
        user = UserFactory.create()
        grant_all_known_codes(user)
        from apps.identity.models import RolePermission

        rp = RolePermission.objects.filter(role__users=user).first()
        assert rp is not None

        def _version():
            from django.core.cache import cache

            return cache.get(
                f"identity.permission.version:{user.pk}",
                1,
            )

        v0 = _version()
        rp.delete()
        v1 = _version()
        assert v1 == v0 + 1
```

```python
# backend/apps/identity/tests/resolvers/test_grant_expiry.py
from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.identity.models import Permission, Role, RolePermission, UserRole
from apps.identity.resolvers.permission import PermissionResolver
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestGrantExpiry:
    def test_expired_grant_does_not_resolve(self):
        user = UserFactory.create()
        role = Role.objects.create(name="R", code="role-expiry")
        permission = Permission.objects.create(
            code="shot.probe.expired",
            name="Probe",
        )
        RolePermission.objects.create(
            role=role,
            permission=permission,
            granted=True,
            expires_at=timezone.now() - timedelta(days=1),
        )
        UserRole.objects.create(user=user, role=role)

        resolved = PermissionResolver.resolve(user=user)
        assert "shot.probe.expired" not in resolved

    def test_denied_row_never_grants(self):
        user = UserFactory.create()
        role = Role.objects.create(name="R2", code="role-deny")
        permission = Permission.objects.create(
            code="shot.probe.denied",
            name="Probe2",
        )
        RolePermission.objects.create(
            role=role,
            permission=permission,
            granted=False,
        )
        UserRole.objects.create(user=user, role=role)

        resolved = PermissionResolver.resolve(user=user)
        assert "shot.probe.denied" not in resolved
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_rbac_cache_invalidation.py apps/identity/tests/resolvers/test_grant_expiry.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — versions unchanged; expired grant resolves.

- [ ] **Step 3: Implement**

```python
# backend/apps/identity/signals/rbac.py
from __future__ import annotations

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.identity.models import (
    GroupMember,
    GroupRole,
    Permission,
    Role,
    RolePermission,
    UserRole,
)
from apps.identity.services.permission_cache import PermissionCacheService


@receiver(post_save, sender=UserRole)
@receiver(post_delete, sender=UserRole)
def _user_role_changed(sender, instance, **kwargs):
    PermissionCacheService.invalidate_role_holders_by_id(
        getattr(instance, "role_id", None),
    )


@receiver(post_save, sender=RolePermission)
@receiver(post_delete, sender=RolePermission)
def _role_permission_changed(sender, instance, **kwargs):
    PermissionCacheService.invalidate_role_holders_by_id(
        getattr(instance, "role_id", None),
    )


@receiver(post_save, sender=GroupMember)
@receiver(post_delete, sender=GroupMember)
def _group_member_changed(sender, instance, **kwargs):
    PermissionCacheService.invalidate_group_members(
        getattr(instance, "group_id", None),
    )


@receiver(post_save, sender=GroupRole)
@receiver(post_delete, sender=GroupRole)
def _group_role_changed(sender, instance, **kwargs):
    PermissionCacheService.invalidate_role_holders_by_id(
        getattr(instance, "role_id", None),
    )


@receiver(post_save, sender=Role)
@receiver(post_delete, sender=Role)
def _role_changed(sender, instance, **kwargs):
    if kwargs.get("update_fields") and "is_deleted" not in kwargs["update_fields"]:
        return
    PermissionCacheService.invalidate_role_holders(instance)


@receiver(post_save, sender=Permission)
@receiver(post_delete, sender=Permission)
def _permission_changed(sender, instance, **kwargs):
    PermissionCacheService.invalidate_permission_holders(instance)
```

```python
# backend/apps/identity/signals/__init__.py — ensure rbac module is imported
from . import rbac  # noqa: F401
```

```python
# backend/apps/identity/resolvers/permission.py — add expiry filter to the
# RolePermission query (keep granted=True and is_deleted=False)
from django.utils import timezone
from django.db.models import Q

permission_ids = RolePermission.objects.filter(
    role_id__in=roles,
    granted=True,
    is_deleted=False,
).filter(
    Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()),
).values_list(
    "permission_id",
    flat=True,
)
```

- [ ] **Step 4: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_rbac_cache_invalidation.py apps/identity/tests/resolvers/test_grant_expiry.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Collateral + commit**

Run: identity tests (RBAC viewset tests in `apps/identity/tests/api/viewsets/test_user_viewset_*` and `apps/identity/tests/security/`) + the contract suite `apps/core/tests/test_contract_regression.py` (RBAC matrix unchanged).
Expected: green. Document in a code comment (on `_group_member_changed`): Django does not fire per-row `post_delete` for bulk `QuerySet.delete()` — the API's serializer-driven single-row writes do fire it, which is the supported path.

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/signals/rbac.py apps/identity/signals/__init__.py apps/identity/resolvers/permission.py apps/identity/tests/services/test_rbac_cache_invalidation.py apps/identity/tests/resolvers/test_grant_expiry.py
git commit -m "feat(identity): signal-driven RBAC cache invalidation + grant expiry enforcement (C3)"
```

---

### Task 12: Transactional rotation (WS5/M3)

**Files:**
- Modify: `backend/apps/identity/authentication/token.py` (`TokenService.refresh`)
- Test: `backend/apps/identity/tests/services/test_transactional_rotation.py`

**Interfaces:**
- Consumes: `JWTService.rotate_refresh_token`, `UserSessionService.refresh` (both unchanged)
- Produces: `TokenService.refresh` is atomic — session jti re-stamp and token rotation commit together.

- [ ] **Step 1: Write the failing test**

```python
# backend/apps/identity/tests/services/test_transactional_rotation.py
from __future__ import annotations

from unittest import mock

import pytest
from django.db import transaction
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.authentication.token import TokenService
from apps.identity.choices import SessionStatus
from apps.identity.models import UserSession
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestTransactionalRotation:
    def test_failed_session_update_rolls_back_rotation(self):
        user = UserFactory.create(is_active=True)
        refresh = RefreshToken.for_user(user)
        session = UserSession.objects.create(
            user=user,
            session_key=refresh["jti"],
            refresh_token_jti=refresh["jti"],
            access_token_jti="a1",
            status=SessionStatus.ACTIVE,
        )
        old_jti = session.refresh_token_jti

        # Force a failure inside UserSessionService.refresh AFTER rotation
        # produced a new pair: the whole rotation must roll back.
        with mock.patch(
            "apps.identity.services.user_session.UserSessionValidator.validate_refresh",
            side_effect=RuntimeError("boom"),
        ):
            with pytest.raises(RuntimeError):
                TokenService.refresh(
                    session=session,
                    refresh_token=str(refresh),
                )

        session.refresh_from_db()
        assert session.refresh_token_jti == old_jti
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_transactional_rotation.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — `refresh_token_jti` changed despite the exception (no rollback).

- [ ] **Step 3: Implement**

```python
# backend/apps/identity/authentication/token.py — wrap refresh body
    @classmethod
    def refresh(
        cls,
        *,
        session,
        refresh_token: str,
    ):
        from django.db import transaction

        from apps.identity.services.user_session import UserSessionService

        with transaction.atomic():
            new_refresh, new_access = JWTService.rotate_refresh_token(
                refresh_token,
            )

            UserSessionService.refresh(
                session,
                access_token_jti=JWTService.get_jti(
                    new_access,
                ),
                refresh_token_jti=JWTService.get_jti(
                    new_refresh,
                ),
            )

        return {
            "access": str(new_access),
            "refresh": str(new_refresh),
        }
```

- [ ] **Step 4: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/services/test_transactional_rotation.py apps/identity/tests/api/test_auth_refresh_rotation.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/authentication/token.py apps/identity/tests/services/test_transactional_rotation.py
git commit -m "fix(identity): transactional refresh rotation (M3)"
```

---

### Task 13: Cache-backed access-jti session check (WS5, ≤60 s access revocation)

**Files:**
- Create: `backend/apps/identity/authentication/session_status.py` (`SessionStatusCache`)
- Create: `backend/apps/identity/authentication/session_bound_jwt.py` (`SessionBoundJWTAuthentication`)
- Modify: `backend/config/settings/components/drf.py` (first auth class)
- Modify: `backend/apps/identity/api/views/auth_compat.py`, `backend/apps/identity/api/views/mfa_compat.py`, `backend/apps/identity/api/views/auth_change_password.py` (explicit `JWTAuthentication` → `SessionBoundJWTAuthentication`)
- Test: `backend/apps/identity/tests/api/test_session_bound_jwt.py`

**Interfaces:**
- Consumes: `AuthenticationSelector.get_session_by_access_jti` (exists); Django cache
- Produces: `SessionStatusCache.is_active(jti) -> bool` (60 s TTL); `SessionBoundJWTAuthentication` — same interface as simplejwt's, 401 `session_expired` when the session is inactive/missing.

- [ ] **Step 1: Write the failing test**

```python
# backend/apps/identity/tests/api/test_session_bound_jwt.py
from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.authentication.jwt import JWTService
from apps.identity.choices import SessionStatus
from apps.identity.models import UserSession
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestSessionBoundJWT:
    def test_valid_session_authenticates(self):
        user = UserFactory.create(is_active=True)
        access, _ = JWTService.create_token_pair(user)
        # login flow creates the session; simulate it
        session = UserSession.objects.create(
            user=user,
            session_key="s1",
            refresh_token_jti="r1",
            access_token_jti=JWTService.get_jti(JWTService.decode_access_token(access)),
            status=SessionStatus.ACTIVE,
        )

        client = APIClient()
        response = client.get(
            "/api/v1/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )

        assert response.status_code == 200

    def test_logged_out_session_rejected(self):
        user = UserFactory.create(is_active=True)
        access, _ = JWTService.create_token_pair(user)
        UserSession.objects.create(
            user=user,
            session_key="s2",
            refresh_token_jti="r2",
            access_token_jti=JWTService.get_jti(JWTService.decode_access_token(access)),
            status=SessionStatus.LOGGED_OUT,
        )

        from django.core.cache import cache

        cache.clear()  # force cache miss -> DB truth

        client = APIClient()
        response = client.get(
            "/api/v1/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )

        assert response.status_code == 401

    def test_missing_session_fails_closed(self):
        user = UserFactory.create(is_active=True)
        access, _ = JWTService.create_token_pair(user)
        # no UserSession row at all

        client = APIClient()
        response = client.get(
            "/api/v1/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {access}",
        )

        assert response.status_code == 401
```

- [ ] **Step 2: Run to verify it fails**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/api/test_session_bound_jwt.py -q --no-cov -p no:cacheprovider`
Expected: FAIL — logged-out and missing-session cases return 200 today.

- [ ] **Step 3: Implement**

```python
# backend/apps/identity/authentication/session_status.py
from __future__ import annotations

from django.core.cache import cache
from django.utils import timezone

from apps.identity.choices import SessionStatus

CACHE_PREFIX = "identity.session.status"
CACHE_TTL_SECONDS = 60


class SessionStatusCache:
    """
    Cache-backed access-token jti -> session validity snapshot.

    The snapshot (60 s TTL) is refreshed from the DB on miss. Revocation
    therefore propagates to in-flight access tokens within ~60 s instead of
    the full access-token lifetime.
    """

    @classmethod
    def is_active(cls, jti: str) -> bool:
        key = f"{CACHE_PREFIX}:{jti}"
        status = cache.get(key)

        if status is None:
            status = cls._load(jti)
            cache.set(
                key,
                status,
                CACHE_TTL_SECONDS,
            )

        return status == "active"

    @classmethod
    def _load(cls, jti: str) -> str:
        from apps.identity.models import UserSession

        session = (
            UserSession.objects.filter(access_token_jti=jti).only("status", "expires_at").first()
        )

        if session is None:
            return "inactive"

        if session.status != SessionStatus.ACTIVE:
            return "inactive"

        if session.expires_at and session.expires_at <= timezone.now():
            return "inactive"

        return "active"
```

```python
# backend/apps/identity/authentication/session_bound_jwt.py
from __future__ import annotations

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.identity.authentication.session_status import SessionStatusCache


class SessionBoundJWTAuthentication(JWTAuthentication):
    """
    JWTAuthentication that also enforces the owning UserSession's status.

    Revocation (logout, password change, deactivation) reaches in-flight
    access tokens within ~60 s (cache snapshot TTL) instead of at token
    expiry. Fails closed: a missing session row denies the request.
    """

    def authenticate(self, request):
        result = super().authenticate(request)

        if result is None:
            return None

        user, validated_token = result

        jti = validated_token.payload.get("jti")

        if jti and not SessionStatusCache.is_active(jti):
            raise AuthenticationFailed(
                "Session is no longer active.",
                code="session_expired",
            )

        return result
```

```python
# backend/config/settings/components/drf.py — replace the first auth class
        "apps.identity.authentication.session_bound_jwt.SessionBoundJWTAuthentication",
```

In `apps/identity/api/views/auth_compat.py`, `apps/identity/api/views/mfa_compat.py`, and `apps/identity/api/views/auth_change_password.py` (created in Task 7), replace `from rest_framework_simplejwt.authentication import JWTAuthentication` with `from apps.identity.authentication.session_bound_jwt import SessionBoundJWTAuthentication` and update the `authentication_classes = (JWTAuthentication,)` references accordingly. (`mfa_compat.py` has ~11 explicit refs; a sed/grep sweep is appropriate.)

- [ ] **Step 4: Run to verify it passes**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests/api/test_session_bound_jwt.py -q --no-cov -p no:cacheprovider`
Expected: PASS.

- [ ] **Step 5: Collateral sweep + commit**

Run: `DJANGO_ENV=testing uv run pytest apps/identity/tests -q --no-cov -p no:cacheprovider`. If any existing test fabricates a JWT for HTTP calls **without** creating a `UserSession` row, update that test to create the row (or use the login flow) — this is the intended fail-closed behavior, not a regression. Then full `apps/identity/tests` green.

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend
git add apps/identity/authentication/session_status.py apps/identity/authentication/session_bound_jwt.py config/settings/components/drf.py apps/identity/api/views/auth_compat.py apps/identity/api/views/mfa_compat.py apps/identity/tests/api/test_session_bound_jwt.py
git commit -m "feat(identity): cache-backed access-jti session check (<=60s revocation)"
```

---

### Task 14: Frontend forced change-password screen (WS1 FE)

**Files:**
- Modify: `studiohub-react/src/types/identity.ts` (User: add `must_change_password?`)
- Modify: `studiohub-react/src/api/repositories/interfaces/IAuthRepository.ts` (add `changePassword`)
- Modify: `studiohub-react/src/api/repositories/adapters/rest/RESTAuthAdapter.ts` (implement `changePassword`)
- Modify: `studiohub-react/src/modules/auth/services/AuthService.ts` (expose `changePassword`)
- Create: `studiohub-react/src/modules/auth/pages/ChangePasswordPage.tsx`
- Modify: `studiohub-react/src/routes/AuthenticatedRoute.tsx` (force redirect while flag set)
- Modify: `studiohub-react/src/routes/AppRoutes.tsx` (add `/auth/change-password` route)
- Test: `studiohub-react/src/modules/auth/__tests__/changePasswordGuard.test.ts` (pure guard decision), plus e2e smoke

**Interfaces:**
- Consumes: `user.must_change_password` from login/refresh/me payloads (Task 6); `POST /api/v1/auth/change-password/` (Task 7)
- Produces: `shouldForcePasswordChange(user)` pure helper; `AuthService.changePassword({old_password, new_password, confirm_password}) -> Promise<void>`

- [ ] **Step 1: Write the failing guard test**

```ts
// studiohub-react/src/modules/auth/__tests__/changePasswordGuard.test.ts
import { describe, expect, it } from 'vitest';
import { shouldForcePasswordChange } from '../utils/passwordChangeGuard';
import { User } from '@/types/identity';

describe('shouldForcePasswordChange', () => {
  it('forces change when the flag is set', () => {
    expect(shouldForcePasswordChange({ must_change_password: true } as Partial<User>)).toBe(true);
  });

  it('does not force change when the flag is absent or false', () => {
    expect(shouldForcePasswordChange({} as Partial<User>)).toBe(false);
    expect(shouldForcePasswordChange({ must_change_password: false } as Partial<User>)).toBe(false);
  });
});
```

```ts
// studiohub-react/src/modules/auth/utils/passwordChangeGuard.ts
import { User } from '@/types/identity';

export function shouldForcePasswordChange(user: Pick<User, 'must_change_password'> | null): boolean {
  return Boolean(user && user.must_change_password === true);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/prafull.sakharkar/Repository/github/studiohub-react && pnpm vitest run src/modules/auth/__tests__/changePasswordGuard.test.ts`
Expected: FAIL (module missing) → then PASS after creating the util. (The guard util is the pure-logic RED driver; the route/API wiring below is exercised by tsc + e2e.)

- [ ] **Step 3: Implement FE wiring**

```ts
// studiohub-react/src/types/identity.ts — inside interface User
  must_change_password?: boolean;
```

```ts
// studiohub-react/src/api/repositories/interfaces/IAuthRepository.ts
  changePassword(data: { old_password: string; new_password: string; confirm_password: string }): Promise<void>;
```

```ts
// studiohub-react/src/api/repositories/adapters/rest/RESTAuthAdapter.ts
  async changePassword(data: {
    old_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> {
    await this.request<void>(`${this.basePath}change-password/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
```

```ts
// studiohub-react/src/modules/auth/services/AuthService.ts
  async changePassword(data: {
    old_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> {
    await this.repository.changePassword(data);
  }
```

```tsx
// studiohub-react/src/modules/auth/pages/ChangePasswordPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/modules/auth/services/AuthService';
import { useAuth } from '@/modules/auth/hooks/useAuth';

export const ChangePasswordPage: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Backend revokes every session on change: force a fresh login.
      await authService.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirm,
      });
      await logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(err?.message ?? 'Could not change password. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Change your password</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input type="password" placeholder="Current password" value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)} className="w-full p-2 rounded bg-slate-800" />
        <input type="password" placeholder="New password" value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)} className="w-full p-2 rounded bg-slate-800" />
        <input type="password" placeholder="Confirm new password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} className="w-full p-2 rounded bg-slate-800" />
        <button type="submit" disabled={submitting}
          className="w-full p-2 rounded bg-indigo-600 disabled:opacity-50">
          {submitting ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </div>
  );
};
```

```tsx
// studiohub-react/src/routes/AuthenticatedRoute.tsx — after the isAuthenticated check
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // ... existing isLoading / !isAuthenticated blocks ...

  if (shouldForcePasswordChange(user) && location.pathname !== '/auth/change-password') {
    return <Navigate to="/auth/change-password" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
```

```tsx
// studiohub-react/src/routes/AppRoutes.tsx — inside the AuthenticatedRoute branch
        <Route path="/auth/change-password" element={<ChangePasswordPage />} />
```

Add `ChangePasswordPage` to the `@/modules/auth` exports.

- [ ] **Step 4: Verify**

Run: `cd /home/prafull.sakharkar/Repository/github/studiohub-react && pnpm tsc --noEmit && pnpm vitest run src/modules/auth/__tests__/changePasswordGuard.test.ts`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub-react
git add src/types/identity.ts src/api/repositories/interfaces/IAuthRepository.ts src/api/repositories/adapters/rest/RESTAuthAdapter.ts src/modules/auth/services/AuthService.ts src/modules/auth/pages/ChangePasswordPage.tsx src/modules/auth/utils/passwordChangeGuard.ts src/modules/auth/__tests__/changePasswordGuard.test.ts src/routes/AuthenticatedRoute.tsx src/routes/AppRoutes.tsx
git commit -m "feat(auth): forced change-password screen on must_change_password claim"
```

---

### Task 15: Full verification + release gates

**Files:** none (verification only).

- [ ] **Step 1: Backend full suite + hygiene**

Run: `cd /home/prafull.sakharkar/Repository/github/studiohub/backend && DJANGO_ENV=testing uv run pytest -q --no-cov -p no:cacheprovider`
Expected: all green (baseline 1631 + new tests).
Run: `.venv/bin/ruff check apps/identity apps/core` and `DJANGO_ENV=testing uv run python manage.py makemigrations --check --dry-run`
Expected: clean / "No changes detected".

- [ ] **Step 2: FE full checks**

Run: `cd /home/prafull.sakharkar/Repository/github/studiohub-react && pnpm tsc --noEmit && pnpm vitest run`
Expected: clean.

- [ ] **Step 3: E2E smoke**

Restart the dev backend on the new code (see Global Constraints for the runserver command), start warm vite (`PORT=3100 pnpm dev` background), then:
Run: `E2E_EXTERNAL_SERVER=1 pnpm exec playwright test e2e/route-authorization.spec.ts e2e/platform-workflow.spec.ts e2e/real-api-validation.spec.ts e2e/flat-entity-views.spec.ts --workers=1 --retries=1`
Expected: green. Add a small `e2e/change-password-flow.spec.ts` if time permits: login as a seeded user → visit `/auth/change-password` → change password → redirected to login → login with the new password succeeds.

- [ ] **Step 4: Push + ledger**

```bash
cd /home/prafull.sakharkar/Repository/github/studiohub/backend && git push origin develop
cd /home/prafull.sakharkar/Repository/github/studiohub-react && git push origin main
```

Append a Wave-4 entry to `.superpowers/sdd/2026-10-15-organization-removal/progress.md` (frontend repo, local-only): Phase 1 shipped, verification numbers, deferred items (Phase 2 credentials API, Phase 3 MFA/LDAP).

- [ ] **Step 5: Working tree check**

Run: `git status --short` in both repos. Expected: clean.

---

## Self-Review Notes (resolved inline)

- **Spec coverage:** WS6.2→T1, WS6.1→T2, WS6.3→T3, WS1/2/3 foundation→T4, WS1 self→T5, WS1 admin+claim→T6, WS1 FE contract→T7, WS2 logout→T8, WS2 expiry→T9, WS3→T10, WS4→T11, WS5 rotation→T12, WS5 access-jti→T13, WS1 FE screen→T14, gates→T15. All spec sections mapped.
- **Type consistency:** `revoke_all_for_user` / `blacklist_sweep_for_user` / `SessionStatusCache.is_active` / `shouldForcePasswordChange` signatures are identical across the tasks that consume and produce them.
- **Review Focus pins:** proxy/IP→T1+T2; replayed rotated refresh at logout→T4; missing session→T13; bulk-delete signal gap→T11 comment; deep-link forced change→T14 route guard.
