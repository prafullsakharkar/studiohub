# tests/querysets/test_audit_querysets.py
"""
QuerySet tests for Audit application.
"""

from __future__ import annotations

import pytest

from apps.audit.models.audit_log import AuditLog
from apps.audit.tests.factories import AuditLogFactory


class TestAuditLogQuerySet:
    """Tests for AuditLog queryset."""

    @pytest.mark.django_db
    def test_queryset_filter_by_action(self) -> None:
        """Test filtering by action."""
        AuditLogFactory.create_batch(3, action=AuditLog.ACTION_CREATE)
        AuditLogFactory.create_batch(2, action=AuditLog.ACTION_UPDATE)
        queryset = AuditLog.objects.filter(action=AuditLog.ACTION_UPDATE)
        assert queryset.count() == 2

    @pytest.mark.django_db
    def test_queryset_select_related(
        self, django_assert_num_queries
    ) -> None:
        """Test select_related method."""
        AuditLogFactory.create_batch(5)
        with django_assert_num_queries(1):
            list(AuditLog.objects.select_related("actor", "organization").all())
