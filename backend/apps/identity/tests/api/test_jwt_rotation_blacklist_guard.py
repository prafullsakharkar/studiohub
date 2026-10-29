"""
Guarded blacklist on refresh rotation.

Rotation must not fail when the old refresh token cannot be blacklisted
(e.g. token-blacklist store unavailable) — but the failure must be
observed, not silently swallowed, so an operator can act.
"""

from __future__ import annotations

import logging
from unittest import mock

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from apps.identity.authentication.jwt import JWTService
from apps.identity.tests.factories import UserFactory


@pytest.mark.django_db
class TestRotationBlacklistGuard:
    def test_rotation_survives_blacklist_failure_and_logs(self, caplog):
        user = UserFactory.create(is_active=True)
        refresh = RefreshToken.for_user(user)

        with (
            caplog.at_level(logging.WARNING, logger="apps.identity.authentication.jwt"),
            mock.patch.object(
                RefreshToken,
                "blacklist",
                side_effect=RuntimeError("token blacklist store unavailable"),
            ),
        ):
            new_refresh, access = JWTService.rotate_refresh_token(str(refresh))

        assert new_refresh is not None
        assert access is not None
        assert new_refresh != refresh
        assert any(
            "blacklist" in record.getMessage().lower() and record.levelno == logging.WARNING
            for record in caplog.records
        )
