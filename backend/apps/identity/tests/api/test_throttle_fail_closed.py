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
