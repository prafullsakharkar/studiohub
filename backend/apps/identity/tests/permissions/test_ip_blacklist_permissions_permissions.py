"""
Identity IP blacklist permissions tests.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import IPBlacklistFactory


class TestIPBlacklistPermissions:
    """Tests for IPBlacklist permissions."""

    @pytest.fixture(autouse=True)
    def _inject_api_client(self, api_client):
        """Expose the API client to tests using ``self.api_client``."""
        self.api_client = api_client

    @pytest.mark.django_db
    def test_anonymous_user_cannot_view_ip_blacklist_list(self):
        """Test that anonymous user cannot view IP blacklist list."""
        response = self.api_client.get("/api/v1/identity/ip-blacklist/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_view_ip_blacklist_list(self, authenticated_client):
        """Test that authenticated user cannot view IP blacklist list."""
        response = authenticated_client.get("/api/v1/identity/ip-blacklist/")
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_view_ip_blacklist_list(self, staff_client):
        """Test that staff user can view IP blacklist list."""
        response = staff_client.get("/api/v1/identity/ip-blacklist/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_view_ip_blacklist_list(self, admin_client):
        """Test that admin user can view IP blacklist list."""
        response = admin_client.get("/api/v1/identity/ip-blacklist/")
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_create_ip_blacklist(self):
        """Test that anonymous user cannot create IP blacklist."""
        response = self.api_client.post(
            "/api/v1/identity/ip-blacklist/",
            {"ip_address": "192.168.1.1"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_create_ip_blacklist(self, authenticated_client):
        """Test that authenticated user cannot create IP blacklist."""
        response = authenticated_client.post(
            "/api/v1/identity/ip-blacklist/",
            {"ip_address": "192.168.1.1"},
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_create_ip_blacklist(self, staff_client):
        """Test that staff user can create IP blacklist."""
        response = staff_client.post(
            "/api/v1/identity/ip-blacklist/",
            {"ip_address": "192.168.1.1"},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_admin_user_can_create_ip_blacklist(self, admin_client):
        """Test that admin user can create IP blacklist."""
        response = admin_client.post(
            "/api/v1/identity/ip-blacklist/",
            {"ip_address": "192.168.1.1"},
        )
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_anonymous_user_cannot_update_ip_blacklist(self):
        """Test that anonymous user cannot update IP blacklist."""
        entry = IPBlacklistFactory.create()
        response = self.api_client.patch(
            f"/api/v1/identity/ip-blacklist/{entry.id}/",
            {"ip_address": "10.0.0.1"},
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_update_ip_blacklist(self, authenticated_client):
        """Test that authenticated user cannot update IP blacklist."""
        entry = IPBlacklistFactory.create()
        response = authenticated_client.patch(
            f"/api/v1/identity/ip-blacklist/{entry.id}/",
            {"ip_address": "10.0.0.1"},
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_update_ip_blacklist(self, staff_client):
        """Test that staff user can update IP blacklist."""
        entry = IPBlacklistFactory.create()
        response = staff_client.patch(
            f"/api/v1/identity/ip-blacklist/{entry.id}/",
            {"ip_address": "10.0.0.1"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_admin_user_can_update_ip_blacklist(self, admin_client):
        """Test that admin user can update IP blacklist."""
        entry = IPBlacklistFactory.create()
        response = admin_client.patch(
            f"/api/v1/identity/ip-blacklist/{entry.id}/",
            {"ip_address": "10.0.0.1"},
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_anonymous_user_cannot_delete_ip_blacklist(self):
        """Test that anonymous user cannot delete IP blacklist."""
        entry = IPBlacklistFactory.create()
        response = self.api_client.delete(f"/api/v1/identity/ip-blacklist/{entry.id}/")
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_authenticated_user_cannot_delete_ip_blacklist(self, authenticated_client):
        """Test that authenticated user cannot delete IP blacklist."""
        entry = IPBlacklistFactory.create()
        response = authenticated_client.delete(f"/api/v1/identity/ip-blacklist/{entry.id}/")
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_staff_user_can_delete_ip_blacklist(self, staff_client):
        """Test that staff user can delete IP blacklist."""
        entry = IPBlacklistFactory.create()
        response = staff_client.delete(f"/api/v1/identity/ip-blacklist/{entry.id}/")
        assert response.status_code == 204

    @pytest.mark.django_db
    def test_admin_user_can_delete_ip_blacklist(self, admin_client):
        """Test that admin user can delete IP blacklist."""
        entry = IPBlacklistFactory.create()
        response = admin_client.delete(f"/api/v1/identity/ip-blacklist/{entry.id}/")
        assert response.status_code == 204
