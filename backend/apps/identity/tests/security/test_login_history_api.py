"""
Identity login-history read API (follow-up to ADR-0035).

Read-only, permission-gated, and never able to change a recorded row.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.models import LoginHistory
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions

LIST = "api:v1:identity:login-history-list"
DETAIL = "api:v1:identity:login-history-detail"
VIEW = "identity.login_history.view"


def _row(user, **extra):
    return LoginHistory.objects.create(user=user, ip_address="198.51.100.4", **extra)


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _rows(response):
    body = response.json()
    return body if isinstance(body, list) else body.get("results", body.get("data", body))


@pytest.mark.django_db
class TestAccess:
    def test_anonymous_is_refused(self):
        assert APIClient().get(reverse(LIST)).status_code in (401, 403)

    def test_a_user_without_the_permission_is_forbidden(self):
        user = UserFactory.create()
        row = _row(user)

        assert _client(user).get(reverse(LIST)).status_code == 403
        assert _client(user).get(reverse(DETAIL, kwargs={"pk": row.pk})).status_code == 403

    def test_a_holder_of_the_permission_can_list_and_retrieve(self):
        viewer = UserFactory.create()
        grant_permissions(viewer, VIEW)
        row = _row(UserFactory.create(), user_agent="UA/1.0")

        listing = _client(viewer).get(reverse(LIST))
        detail = _client(viewer).get(reverse(DETAIL, kwargs={"pk": row.pk}))

        assert listing.status_code == 200
        assert [str(r["id"]) for r in _rows(listing)] == [str(row.pk)]
        assert detail.status_code == 200
        body = detail.json()
        assert (body.get("data") or body)["user_agent"] == "UA/1.0"


@pytest.mark.django_db
class TestReadOnly:
    @pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
    def test_no_write_route_exists(self, method):
        viewer = UserFactory.create()
        grant_permissions(viewer, VIEW)
        row = _row(UserFactory.create())
        url = reverse(DETAIL, kwargs={"pk": row.pk})
        if method == "post":
            url = reverse(LIST)

        response = getattr(_client(viewer), method)(url, {"status": "failed"}, format="json")

        assert response.status_code in (403, 405)
        row.refresh_from_db()
        assert row.status == LoginHistory.STATUS_SUCCESS
        assert LoginHistory.objects.filter(pk=row.pk).exists()


@pytest.mark.django_db
class TestFilters:
    def test_filters_by_user_and_status(self):
        viewer = UserFactory.create()
        grant_permissions(viewer, VIEW)
        alice, bob = UserFactory.create(), UserFactory.create()
        _row(alice)
        failed = _row(bob, status=LoginHistory.STATUS_FAILED)

        by_user = _rows(_client(viewer).get(reverse(LIST), {"user": str(bob.pk)}))
        by_status = _rows(_client(viewer).get(reverse(LIST), {"status": "failed"}))

        assert len(by_user) == 1
        assert [str(r["id"]) for r in by_status] == [str(failed.pk)]
