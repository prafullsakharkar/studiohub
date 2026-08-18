"""
Identity IP blacklist viewset tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.tests.factories import IPBlacklistFactory


class TestIPBlacklistViewSet:
    """Tests for IPBlacklistViewSet."""

    @pytest.mark.django_db
    def test_list_ip_blacklist_unauthenticated(self, api_client):
        """Test listing IP blacklist without authentication."""
        response = api_client.get(reverse("api:v1:identity:ip-blacklist-list"))
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_list_ip_blacklist_authenticated(self, authenticated_client):
        """Test listing IP blacklist with authentication."""
        response = authenticated_client.get(reverse("api:v1:identity:ip-blacklist-list"))
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_list_ip_blacklist_staff(self, staff_client):
        """Test listing IP blacklist with staff privileges."""
        response = staff_client.get(reverse("api:v1:identity:ip-blacklist-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_list_ip_blacklist_admin(self, admin_client):
        """Test listing IP blacklist with admin privileges."""
        response = admin_client.get(reverse("api:v1:identity:ip-blacklist-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_retrieve_ip_blacklist_unauthenticated(self, api_client):
        """Test retrieving IP blacklist entry without authentication."""
        entry = IPBlacklistFactory.create()
        response = api_client.get(
            reverse("api:v1:identity:ip-blacklist-detail", kwargs={"pk": entry.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_retrieve_ip_blacklist_staff(self, staff_client):
        """Test retrieving IP blacklist entry with staff privileges."""
        entry = IPBlacklistFactory.create()
        response = staff_client.get(
            reverse("api:v1:identity:ip-blacklist-detail", kwargs={"pk": entry.id})
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_create_ip_blacklist_unauthenticated(self, api_client):
        """Test creating IP blacklist entry without authentication."""
        data = {
            "ip_address": "192.168.1.1",
            "reason": "Suspicious activity",
        }
        response = api_client.post(reverse("api:v1:identity:ip-blacklist-list"), data)
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_create_ip_blacklist_staff(self, staff_client):
        """Test creating IP blacklist entry with staff privileges."""
        data = {
            "ip_address": "192.168.1.1",
            "reason": "Suspicious activity",
        }
        response = staff_client.post(reverse("api:v1:identity:ip-blacklist-list"), data)
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_update_ip_blacklist_unauthenticated(self, api_client):
        """Test updating IP blacklist entry without authentication."""
        entry = IPBlacklistFactory.create()
        data = {"reason": "Updated reason"}
        response = api_client.put(
            reverse("api:v1:identity:ip-blacklist-detail", kwargs={"pk": entry.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_update_ip_blacklist_staff(self, staff_client):
        """Test updating IP blacklist entry with staff privileges."""
        entry = IPBlacklistFactory.create()
        data = {"reason": "Updated reason"}
        response = staff_client.put(
            reverse("api:v1:identity:ip-blacklist-detail", kwargs={"pk": entry.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_partial_update_ip_blacklist_unauthenticated(self, api_client):
        """Test partially updating IP blacklist entry without authentication."""
        entry = IPBlacklistFactory.create()
        data = {"reason": "Updated reason"}
        response = api_client.patch(
            reverse("api:v1:identity:ip-blacklist-detail", kwargs={"pk": entry.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_partial_update_ip_blacklist_staff(self, staff_client):
        """Test partially updating IP blacklist entry with staff privileges."""
        entry = IPBlacklistFactory.create()
        data = {"reason": "Updated reason"}
        response = staff_client.patch(
            reverse("api:v1:identity:ip-blacklist-detail", kwargs={"pk": entry.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_destroy_ip_blacklist_unauthenticated(self, api_client):
        """Test deleting IP blacklist entry without authentication."""
        entry = IPBlacklistFactory.create()
        response = api_client.delete(
            reverse("api:v1:identity:ip-blacklist-detail", kwargs={"pk": entry.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_destroy_ip_blacklist_staff(self, staff_client):
        """Test deleting IP blacklist entry with staff privileges."""
        entry = IPBlacklistFactory.create()
        response = staff_client.delete(
            reverse("api:v1:identity:ip-blacklist-detail", kwargs={"pk": entry.id})
        )
        assert response.status_code == 204
