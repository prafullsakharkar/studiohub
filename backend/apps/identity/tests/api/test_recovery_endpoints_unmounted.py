"""
H3 — the broken anonymous recovery endpoints must not be mounted.

``POST /identity/password/reset/`` crashed with 500 (calls a
nonexistent ``PasswordService.reset_password``) and ``POST
/identity/email/verify/`` crashed likewise (nonexistent
``get_by_verification_token``). With no token-issuance subsystem behind
them, mounting them only produces 500s on a public surface; they are
unmounted until a real reset-token system exists (Phase 1+). The
neighbouring self-service routes stay reachable.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestRecoveryEndpointsUnmounted:
    def test_password_reset_unmounted(self):
        client = APIClient()

        response = client.post(
            "/api/v1/identity/password/reset/",
            {"token": "x", "password": "new-pass-1", "confirm_password": "new-pass-1"},
            format="json",
        )

        assert response.status_code == 404

    def test_email_verify_unmounted(self):
        client = APIClient()

        response = client.post(
            "/api/v1/identity/email/verify/",
            {"token": "x"},
            format="json",
        )

        assert response.status_code == 404

    def test_surrounding_self_service_routes_still_mounted(self):
        client = APIClient()

        # password/forgot is a stub (returns without side effects); it must
        # still resolve to the view, not 404.
        forgot = client.post(
            "/api/v1/identity/password/forgot/",
            {"email": "nobody@example.com"},
            format="json",
        )
        assert forgot.status_code != 404

        # change requires authentication; it must not be a 404 either.
        change = client.post(
            "/api/v1/identity/password/change/",
            {"old_password": "x", "new_password": "y", "confirm_password": "y"},
            format="json",
        )
        assert change.status_code != 404
