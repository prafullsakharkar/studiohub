"""
Append-only audit ledgers, retention and housekeeping (WP 5.4 / 5.5 / 5.10).

SecurityEvent and LoginAttempt rows can be created and read, never changed.
Rows leave the attempt ledger only through the retention job.
"""

from __future__ import annotations

from datetime import timedelta
from io import StringIO

import pytest
from django.contrib import admin as django_admin
from django.core.management import call_command
from django.db import models as django_models
from django.utils import timezone

from apps.identity.choices import LoginAttemptReason, SecurityEventType
from apps.identity.models import (
    LoginAttempt,
    SecurityEvent,
    TrustedDevice,
    UserSession,
)
from apps.identity.querysets.security_event import ImmutableLedgerError
from apps.identity.services.login_attempt import LoginAttemptService
from apps.identity.services.security_event import SecurityEventService
from apps.identity.services.user_session import UserSessionService
from apps.identity.tasks.maintenance import identity_cleanup, run_cleanup
from apps.identity.tests.factories import (
    LoginAttemptFactory,
    SecurityEventFactory,
    TrustedDeviceFactory,
    UserFactory,
    UserSessionFactory,
)


@pytest.mark.django_db
class TestSecurityEventIsAppendOnly:
    def test_a_stored_row_cannot_be_saved_again(self):
        event = SecurityEventFactory.create(description="original")

        event.description = "tampered"
        with pytest.raises(ImmutableLedgerError):
            event.save()

        assert SecurityEvent.objects.get(pk=event.pk).description == "original"

    def test_a_row_cannot_be_deleted(self):
        event = SecurityEventFactory.create()

        with pytest.raises(ImmutableLedgerError):
            event.delete()

        assert SecurityEvent.objects.filter(pk=event.pk).exists()

    def test_bulk_update_and_delete_are_refused(self):
        event = SecurityEventFactory.create(description="original")

        with pytest.raises(ImmutableLedgerError):
            SecurityEvent.objects.filter(pk=event.pk).update(description="x")
        with pytest.raises(ImmutableLedgerError):
            SecurityEvent.objects.filter(pk=event.pk).delete()
        with pytest.raises(ImmutableLedgerError):
            SecurityEvent.objects.bulk_update([event], ["description"])

        assert SecurityEvent.objects.get(pk=event.pk).description == "original"

    def test_the_service_can_only_create(self):
        assert not hasattr(SecurityEventService, "update")
        assert not hasattr(SecurityEventService, "delete")

        user = UserFactory.create()
        event = SecurityEventService.create(user=user, event_type=SecurityEventType.LOGIN_SUCCESS)

        assert SecurityEvent.objects.filter(pk=event.pk).exists()

    def test_deleting_a_user_still_works_and_keeps_the_event(self):
        user = UserFactory.create()
        event = SecurityEventFactory.create(user=user)

        # ``User.delete`` is a soft delete; call the base implementation so
        # Django's collector runs the real FK handling (SET_NULL).
        django_models.Model.delete(user)

        event.refresh_from_db()
        assert event.user_id is None


@pytest.mark.django_db
class TestLoginAttemptLedger:
    def test_the_service_cannot_update_or_delete(self):
        assert not hasattr(LoginAttemptService, "update")
        assert not hasattr(LoginAttemptService, "delete")

    def test_every_recorded_failure_reason_is_a_known_choice(self):
        from django.urls import reverse
        from rest_framework.test import APIClient

        user = UserFactory.create(is_email_verified=True)
        user.set_password("Right-pass-123!")
        user.save(update_fields=["password"])
        client = APIClient()
        url = reverse("api:v1:auth-compat:auth-login")
        client.post(url, {"email": user.email, "password": "nope"}, format="json")
        client.post(url, {"email": "ghost@example.com", "password": "x"}, format="json")

        reasons = set(LoginAttempt.objects.filter(success=False).values_list("reason", flat=True))
        assert reasons <= set(LoginAttemptReason.values)
        assert reasons


@pytest.mark.django_db
class TestAdminIsReadOnly:
    @pytest.mark.parametrize("model", [SecurityEvent, LoginAttempt])
    def test_no_add_change_or_delete(self, model, rf):
        model_admin = django_admin.site._registry[model]
        request = rf.get("/")
        request.user = UserFactory.create(is_staff=True, is_superuser=True)

        assert model_admin.has_add_permission(request) is False
        assert model_admin.has_change_permission(request) is False
        assert model_admin.has_delete_permission(request) is False
        assert model_admin.has_view_permission(request) is True


@pytest.mark.django_db
class TestLoginAttemptRetention:
    def _age(self, attempt, days):
        # attempted_at is auto_now_add; backdate through the queryset
        LoginAttempt.objects.filter(pk=attempt.pk).update(
            attempted_at=timezone.now() - timedelta(days=days)
        )

    def test_purge_is_keyed_on_attempted_at(self):
        old = LoginAttemptFactory.create()
        fresh = LoginAttemptFactory.create()
        self._age(old, 120)

        deleted = LoginAttemptService.purge_expired(retention_days=90)

        assert deleted == 1
        assert not LoginAttempt.objects.filter(pk=old.pk).exists()
        assert LoginAttempt.objects.filter(pk=fresh.pk).exists()

    def test_window_boundary(self):
        inside = LoginAttemptFactory.create()
        outside = LoginAttemptFactory.create()
        self._age(inside, 89)
        self._age(outside, 91)

        LoginAttemptService.purge_expired(retention_days=90)

        assert LoginAttempt.objects.filter(pk=inside.pk).exists()
        assert not LoginAttempt.objects.filter(pk=outside.pk).exists()

    def test_retention_is_configurable(self, settings):
        settings.IDENTITY_LOGIN_ATTEMPT_RETENTION_DAYS = 7
        attempt = LoginAttemptFactory.create()
        self._age(attempt, 8)

        assert LoginAttemptService.purge_expired() == 1

    def test_retention_never_touches_the_lockout_window(self):
        from apps.identity.validators.authentication import AuthenticationValidator

        recent = LoginAttemptFactory.create(success=False, username="locked@example.com")
        LoginAttemptService.purge_expired(retention_days=1)

        assert AuthenticationValidator.MAX_LOGIN_ATTEMPT_WINDOW_MINUTES < 24 * 60
        assert LoginAttempt.objects.filter(pk=recent.pk).exists()


@pytest.mark.django_db
class TestHousekeeping:
    def _expired_session(self):
        user = UserFactory.create()
        session = UserSessionFactory.create(user=user, refresh_token_jti=f"refresh-{user.pk}")
        UserSession.objects.filter(pk=session.pk).update(
            expires_at=timezone.now() - timedelta(minutes=5)
        )
        return session

    def test_run_cleanup_expires_sessions_and_purges_old_rows(self):
        session = self._expired_session()
        old_attempt = LoginAttemptFactory.create()
        LoginAttempt.objects.filter(pk=old_attempt.pk).update(
            attempted_at=timezone.now() - timedelta(days=400)
        )
        device = TrustedDeviceFactory.create()
        TrustedDevice.objects.filter(pk=device.pk).update(
            expires_at=timezone.now() - timedelta(days=1)
        )

        counts = run_cleanup()

        assert counts["sessions_expired"] >= 1
        assert counts["login_attempts_purged"] >= 1
        assert counts["trusted_devices_purged"] >= 1
        session.refresh_from_db()
        assert session.status == "EXPIRED"

    def test_cleanup_is_idempotent(self):
        self._expired_session()

        run_cleanup()
        second = run_cleanup()

        assert second == {
            "sessions_expired": 0,
            "login_attempts_purged": 0,
            "login_history_purged": 0,
            "trusted_devices_purged": 0,
        }

    def test_management_command_runs_the_same_cleanup(self):
        self._expired_session()
        out = StringIO()

        call_command("identity_cleanup", stdout=out)

        assert "sessions_expired: 1" in out.getvalue()

    def test_celery_task_and_beat_schedule_are_wired(self, settings):
        schedule = settings.CELERY_BEAT_SCHEDULE["identity-cleanup"]

        assert schedule["task"] == identity_cleanup.name == "identity.cleanup"
        assert identity_cleanup() == run_cleanup()

    def test_cleanup_survives_a_flushed_outstanding_token(self):
        """SimpleJWT's flush deletes expired OutstandingToken rows; cleanup must not crash."""
        session = self._expired_session()

        assert UserSessionService.cleanup() >= 1

        session.refresh_from_db()
        assert session.status == "EXPIRED"

    def test_closing_a_live_session_recreates_a_missing_outstanding_token(self):
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )

        user = UserFactory.create()
        session = UserSessionFactory.create(
            user=user,
            refresh_token_jti="live-refresh-jti",
            expires_at=timezone.now() + timedelta(days=1),
        )
        assert not OutstandingToken.objects.filter(jti="live-refresh-jti").exists()

        UserSessionService.logout(session)

        row = OutstandingToken.objects.get(jti="live-refresh-jti")
        assert row.expires_at == session.expires_at
        assert BlacklistedToken.objects.filter(token=row).exists()
