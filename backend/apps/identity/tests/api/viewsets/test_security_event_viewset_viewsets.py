"""
Identity security event viewset tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.tests.factories import SecurityEventFactory


class TestSecurityEventViewSet:
    """Tests for SecurityEventViewSet."""

    @pytest.mark.django_db
    def test_list_security_events_unauthenticated(self, api_client):
        """Test listing security events without authentication."""
        response = api_client.get(reverse("api:v1:identity:security-event-list"))
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_list_security_events_authenticated(self, authenticated_client):
        """Test listing security events with authentication."""
        response = authenticated_client.get(reverse("api:v1:identity:security-event-list"))
        assert response.status_code == 403

    @pytest.mark.django_db
    def test_list_security_events_staff(self, staff_client):
        """Test listing security events with staff privileges."""
        response = staff_client.get(reverse("api:v1:identity:security-event-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_list_security_events_admin(self, admin_client):
        """Test listing security events with admin privileges."""
        response = admin_client.get(reverse("api:v1:identity:security-event-list"))
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_retrieve_security_event_unauthenticated(self, api_client):
        """Test retrieving security event without authentication."""
        event = SecurityEventFactory.create()
        response = api_client.get(
            reverse("api:v1:identity:security-event-detail", kwargs={"pk": event.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_retrieve_security_event_staff(self, staff_client):
        """Test retrieving security event with staff privileges."""
        event = SecurityEventFactory.create()
        response = staff_client.get(
            reverse("api:v1:identity:security-event-detail", kwargs={"pk": event.id})
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_create_security_event_unauthenticated(self, api_client):
        """Test creating security event without authentication."""
        data = {
            "event_type": "login",
        }
        response = api_client.post(reverse("api:v1:identity:security-event-list"), data)
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_create_security_event_staff(self, staff_client):
        """Test creating security event with staff privileges."""
        data = {
            "event_type": "login_success",
        }
        response = staff_client.post(reverse("api:v1:identity:security-event-list"), data)
        assert response.status_code == 201

    @pytest.mark.django_db
    def test_update_security_event_unauthenticated(self, api_client):
        """Test updating security event without authentication."""
        event = SecurityEventFactory.create()
        data = {"event_type": "logout"}
        response = api_client.put(
            reverse("api:v1:identity:security-event-detail", kwargs={"pk": event.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_update_security_event_staff(self, staff_client):
        """Test updating security event with staff privileges."""
        event = SecurityEventFactory.create()
        data = {"event_type": "login_failed"}
        response = staff_client.patch(
            reverse("api:v1:identity:security-event-detail", kwargs={"pk": event.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_partial_update_security_event_unauthenticated(self, api_client):
        """Test partially updating security event without authentication."""
        event = SecurityEventFactory.create()
        data = {"event_type": "logout"}
        response = api_client.patch(
            reverse("api:v1:identity:security-event-detail", kwargs={"pk": event.id}), data
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_partial_update_security_event_staff(self, staff_client):
        """Test partially updating security event with staff privileges."""
        event = SecurityEventFactory.create()
        data = {"event_type": "login_failed"}
        response = staff_client.patch(
            reverse("api:v1:identity:security-event-detail", kwargs={"pk": event.id}), data
        )
        assert response.status_code == 200

    @pytest.mark.django_db
    def test_destroy_security_event_unauthenticated(self, api_client):
        """Test deleting security event without authentication."""
        event = SecurityEventFactory.create()
        response = api_client.delete(
            reverse("api:v1:identity:security-event-detail", kwargs={"pk": event.id})
        )
        assert response.status_code == 401

    @pytest.mark.django_db
    def test_destroy_security_event_staff(self, staff_client):
        """Test deleting security event with staff privileges."""
        event = SecurityEventFactory.create()
        response = staff_client.delete(
            reverse("api:v1:identity:security-event-detail", kwargs={"pk": event.id})
        )
        assert response.status_code == 204
