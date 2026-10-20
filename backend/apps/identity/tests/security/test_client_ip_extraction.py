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
