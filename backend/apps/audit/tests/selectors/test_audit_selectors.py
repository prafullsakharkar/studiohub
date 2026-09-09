# tests/selectors/test_audit_selectors.py
"""
Selector tests for Audit application.
"""

from __future__ import annotations

import pytest

from apps.audit.models.audit_log import AuditLog
from apps.audit.selectors.audit_log import AuditLogSelector
from apps.audit.tests.factories import AuditLogFactory


class TestAuditLogSelector:
    """Tests for AuditLog selector."""

    @pytest.mark.django_db
    def test_selector_get_queryset(self) -> None:
        """Test selector get_queryset method."""
        AuditLogFactory.create_batch(5)
        assert AuditLogSelector.get_queryset().count() == 5

    @pytest.mark.django_db
    def test_selector_get_by_id(self, audit_log: AuditLog) -> None:
        """Test selector get_by_id method."""
        retrieved = AuditLogSelector.get_by_id(str(audit_log.id))
        assert retrieved == audit_log

    @pytest.mark.django_db
    def test_selector_by_organization(self, audit_log: AuditLog) -> None:
        """Test selector by_organization method."""
        queryset = AuditLogSelector.by_organization(
            str(audit_log.organization_id)
        )
        assert audit_log in queryset

    @pytest.mark.django_db
    def test_selector_by_actor(self, audit_log: AuditLog) -> None:
        """Test selector by_actor method."""
        queryset = AuditLogSelector.by_actor(str(audit_log.actor_id))
        assert audit_log in queryset

    @pytest.mark.django_db
    def test_selector_filter_by_action(self) -> None:
        """Test filtering by action."""
        AuditLogFactory.create_batch(3, action=AuditLog.ACTION_CREATE)
        AuditLogFactory.create_batch(2, action=AuditLog.ACTION_UPDATE)
        queryset = AuditLog.objects.filter(action=AuditLog.ACTION_UPDATE)
        assert queryset.count() == 2
