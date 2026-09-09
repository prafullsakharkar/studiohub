"""
Identity security event permissions tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import SecurityEventFactory


class TestSecurityEventPermissions:
    """Tests for SecurityEvent permissions."""

    @pytest.fixture(autouse=True)
    def _inject_api_client(self, api_client):
        """Expose the API client to tests using ``self.api_client``."""
        self.api_client = api_client

    @pytest.mark.django_db
    def test_anonymous_user_cannot_view_security_event_list(self):
        """Test that anonymous user cannot view security event list."""
        response = self.api_client.get("/api/v1/identity/security-events/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_view_security_event_list(self, authenticated_client):
        """Test that authenticated user cannot view security event list."""
        response = authenticated_client.get("/api/v1/identity/security-events/")
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_view_security_event_list(self, staff_client):
        """Test that staff user can view security event list."""
        response = staff_client.get("/api/v1/identity/security-events/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_view_security_event_list(self, admin_client):
        """Test that admin user can view security event list."""
        response = admin_client.get("/api/v1/identity/security-events/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_create_security_event(self):
        """Test that anonymous user cannot create security event."""
        response = self.api_client.post(
            "/api/v1/identity/security-events/",
            {"event_type": "login_success"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_create_security_event(self, authenticated_client):
        """Test that authenticated user cannot create security event."""
        response = authenticated_client.post(
            "/api/v1/identity/security-events/",
            {"event_type": "login_success"},
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_create_security_event(self, staff_client):
        """Test that staff user can create security event."""
        response = staff_client.post(
            "/api/v1/identity/security-events/",
            {"event_type": "login_success"},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_admin_user_can_create_security_event(self, admin_client):
        """Test that admin user can create security event."""
        response = admin_client.post(
            "/api/v1/identity/security-events/",
            {"event_type": "login_success"},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_anonymous_user_cannot_update_security_event(self):
        """Test that anonymous user cannot update security event."""
        event = SecurityEventFactory.create()
        response = self.api_client.patch(
            f"/api/v1/identity/security-events/{event.id}/",
            {"event_type": "login_failed"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_update_security_event(self, authenticated_client):
        """Test that authenticated user cannot update security event."""
        event = SecurityEventFactory.create()
        response = authenticated_client.patch(
            f"/api/v1/identity/security-events/{event.id}/",
            {"event_type": "login_failed"},
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_update_security_event(self, staff_client):
        """Test that staff user can update security event."""
        event = SecurityEventFactory.create()
        response = staff_client.patch(
            f"/api/v1/identity/security-events/{event.id}/",
            {"event_type": "login_failed"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_update_security_event(self, admin_client):
        """Test that admin user can update security event."""
        event = SecurityEventFactory.create()
        response = admin_client.patch(
            f"/api/v1/identity/security-events/{event.id}/",
            {"event_type": "login_failed"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_delete_security_event(self):
        """Test that anonymous user cannot delete security event."""
        event = SecurityEventFactory.create()
        response = self.api_client.delete(f"/api/v1/identity/security-events/{event.id}/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_delete_security_event(self, authenticated_client):
        """Test that authenticated user cannot delete security event."""
        event = SecurityEventFactory.create()
        response = authenticated_client.delete(
            f"/api/v1/identity/security-events/{event.id}/"
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_delete_security_event(self, staff_client):
        """Test that staff user can delete security event."""
        event = SecurityEventFactory.create()
        response = staff_client.delete(f"/api/v1/identity/security-events/{event.id}/")
        assert response.status_code == 204

    @pytest.mark.django_db
    def test_admin_user_can_delete_security_event(self, admin_client):
        """Test that admin user can delete security event."""
        event = SecurityEventFactory.create()
        response = admin_client.delete(f"/api/v1/identity/security-events/{event.id}/")
        assert response.status_code == 204
