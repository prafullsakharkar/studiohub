"""
Tests for organization domain events.

This module contains tests for all organization domain events,
testing event creation and payload handling against the actual
``apps.core.events.DomainEvent`` contract.
"""

from __future__ import annotations

from uuid import uuid4

from apps.organization.events.organization import (
    OrganizationActivated,
    OrganizationArchived,
    OrganizationCreated,
    OrganizationDeactivated,
    OrganizationDeleted,
    OrganizationManagerAssigned,
    OrganizationMoved,
    OrganizationRestored,
    OrganizationUpdated,
)


def _build_payload():
    return {
        "organization_id": uuid4(),
        "organization_code": "ORG001",
        "organization_name": "Test Organization",
        "created_by_id": uuid4(),
    }


class TestOrganizationCreated:
    """Tests for OrganizationCreated event."""

    def test_event_creation(self):
        """Test creating OrganizationCreated event."""
        event = OrganizationCreated(**_build_payload())

        assert event.event_type == "organization.created"
        assert event.payload["organization_id"] is not None
        assert event.payload["organization_code"] == "ORG001"

    def test_event_payload(self):
        """Test event payload attributes."""
        payload = _build_payload()
        event = OrganizationCreated(**payload)

        assert event.payload == payload

    def test_event_accepts_extra_kwargs(self):
        """Test event accepts arbitrary keyword payload."""
        event = OrganizationCreated(**_build_payload(), source="API")

        assert event.payload["source"] == "API"


class TestOrganizationUpdated:
    """Tests for OrganizationUpdated event."""

    def test_event_creation(self):
        """Test creating OrganizationUpdated event."""
        payload = _build_payload()
        event = OrganizationUpdated(**payload)

        assert event.event_type == "organization.updated"
        assert event.payload["organization_code"] == "ORG001"

    def test_event_with_changes(self):
        """Test creating event with changes."""
        payload = _build_payload()
        payload["changes"] = {
            "name": ("Old Name", "Updated Organization"),
            "slug": ("old-slug", "updated-slug"),
        }
        event = OrganizationUpdated(**payload)

        assert event.payload["changes"] == payload["changes"]


class TestOrganizationArchived:
    """Tests for OrganizationArchived event."""

    def test_event_creation(self):
        """Test creating OrganizationArchived event."""
        event = OrganizationArchived(**_build_payload())

        assert event.event_type == "organization.archived"
        assert event.payload["organization_code"] == "ORG001"


class TestOrganizationDeleted:
    """Tests for OrganizationDeleted event."""

    def test_event_creation(self):
        """Test creating OrganizationDeleted event."""
        event = OrganizationDeleted(**_build_payload())

        assert event.event_type == "organization.deleted"
        assert event.payload["organization_code"] == "ORG001"


class TestOrganizationManagerAssigned:
    """Tests for OrganizationManagerAssigned event."""

    def test_event_creation(self):
        """Test creating OrganizationManagerAssigned event."""
        event = OrganizationManagerAssigned(
            organization_id=uuid4(),
            organization_code="ORG001",
            manager_id=uuid4(),
            manager_email="manager@example.com",
            assigned_by_id=uuid4(),
        )

        assert event.event_type == "organization.manager_assigned"
        assert event.payload["organization_code"] == "ORG001"
        assert event.payload["manager_id"] is not None
        assert event.payload["manager_email"] == "manager@example.com"


class TestOrganizationMoved:
    """Tests for OrganizationMoved event."""

    def test_event_creation(self):
        """Test creating OrganizationMoved event."""
        event = OrganizationMoved(
            organization_id=uuid4(),
            organization_code="ORG001",
            old_office_id=uuid4(),
            new_office_id=uuid4(),
            moved_by_id=uuid4(),
        )

        assert event.event_type == "organization.moved"
        assert event.payload["organization_code"] == "ORG001"
        assert event.payload["old_office_id"] is not None
        assert event.payload["new_office_id"] is not None


class TestOrganizationRestored:
    """Tests for OrganizationRestored event."""

    def test_event_creation(self):
        """Test creating OrganizationRestored event."""
        event = OrganizationRestored(**_build_payload())

        assert event.event_type == "organization.restored"
        assert event.payload["organization_code"] == "ORG001"


class TestOrganizationActivated:
    """Tests for OrganizationActivated event."""

    def test_event_creation(self):
        """Test creating OrganizationActivated event."""
        event = OrganizationActivated(**_build_payload())

        assert event.event_type == "organization.activated"
        assert event.payload["organization_code"] == "ORG001"


class TestOrganizationDeactivated:
    """Tests for OrganizationDeactivated event."""

    def test_event_creation(self):
        """Test creating OrganizationDeactivated event."""
        event = OrganizationDeactivated(**_build_payload())

        assert event.event_type == "organization.deactivated"
        assert event.payload["organization_code"] == "ORG001"
