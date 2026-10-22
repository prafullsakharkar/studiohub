"""
Identity owns the only login history (decision: audit copy removed).

One append-only row per created session, retention-purged, with the audit
model, table and URL gone.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.apps import apps as django_apps
from django.contrib import admin as django_admin
from django.core.cache import cache
from django.urls import NoReverseMatch, reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.models import LoginHistory, UserSession
from apps.identity.querysets.ledger import ImmutableLedgerError
from apps.identity.selectors.authentication import AuthenticationSelector
from apps.identity.services.login_history import LoginHistoryService
from apps.identity.tests.factories import UserFactory

PASSWORD = "Correct-horse-battery-9!"


def _user():
    user = UserFactory.create(is_email_verified=True)
    user.set_password(PASSWORD)
    user.save(update_fields=["password"])
    return user


def _login(user, password=PASSWORD):
    return APIClient().post(
        reverse("api:v1:auth-compat:auth-login"),
        {"email": user.email, "password": password},
        format="json",
        HTTP_USER_AGENT="History-Test/1.0",
    )


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestLoginWritesHistory:
    def test_login_writes_exactly_one_success_row(self):
        user = _user()

        assert _login(user).status_code == 200

        rows = LoginHistory.objects.filter(user=user)
        assert rows.count() == 1
        row = rows.get()
        assert row.status == LoginHistory.STATUS_SUCCESS
        assert row.user_agent == "History-Test/1.0"
        assert row.ip_address == "127.0.0.1"

    def test_the_row_points_at_the_session(self):
        user = _user()
        _login(user)

        session = UserSession.objects.get(user=user)

        assert LoginHistory.objects.get(user=user).session_id == str(session.id)

    def test_failed_login_writes_no_history_row(self):
        user = _user()

        _login(user, "wrong-password")

        assert not LoginHistory.objects.filter(user=user).exists()

    def test_dashboard_reads_the_identity_history(self):
        user = _user()
        _login(user)

        history = AuthenticationSelector.get_dashboard(user=user)["login_history"]

        assert history is not None
        assert [h.pk for h in history] == [
            LoginHistory.objects.get(user=user).pk,
        ]


@pytest.mark.django_db
class TestAppendOnly:
    def test_a_stored_row_cannot_change_or_be_deleted(self):
        user = _user()
        row = LoginHistoryService.create(user=user, ip_address="10.0.0.1")

        row.ip_address = "10.0.0.2"
        with pytest.raises(ImmutableLedgerError):
            row.save()
        with pytest.raises(ImmutableLedgerError):
            row.delete()

        assert LoginHistory.objects.get(pk=row.pk).ip_address == "10.0.0.1"

    def test_admin_is_view_only(self, rf):
        model_admin = django_admin.site._registry[LoginHistory]
        request = rf.get("/")
        request.user = UserFactory.create(is_staff=True, is_superuser=True)

        assert model_admin.has_add_permission(request) is False
        assert model_admin.has_change_permission(request) is False
        assert model_admin.has_delete_permission(request) is False


@pytest.mark.django_db
class TestRetention:
    def _age(self, row, days):
        LoginHistory.objects.filter(pk=row.pk).update(
            created_at=timezone.now() - timedelta(days=days)
        )

    def test_purge_removes_only_rows_past_the_window(self):
        user = _user()
        old = LoginHistoryService.create(user=user)
        inside = LoginHistoryService.create(user=user)
        self._age(old, 400)
        self._age(inside, 364)

        deleted = LoginHistoryService.purge_expired(retention_days=365)

        assert deleted == 1
        assert not LoginHistory.objects.filter(pk=old.pk).exists()
        assert LoginHistory.objects.filter(pk=inside.pk).exists()

    def test_window_is_configurable(self, settings):
        settings.IDENTITY_LOGIN_HISTORY_RETENTION_DAYS = 30
        row = LoginHistoryService.create(user=_user())
        self._age(row, 31)

        assert LoginHistoryService.purge_expired() == 1


@pytest.mark.django_db
class TestAuditCopyIsGone:
    def test_the_audit_model_no_longer_exists(self):
        with pytest.raises(LookupError):
            django_apps.get_model("audit", "LoginHistory")

    def test_the_audit_url_no_longer_exists(self):
        with pytest.raises(NoReverseMatch):
            reverse("api:v1:audit:login-history-list")

        user = UserFactory.create(is_superuser=True, is_staff=True)
        client = APIClient()
        client.force_authenticate(user=user)

        assert client.get("/api/v1/audit/login-history/").status_code == 404
