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
