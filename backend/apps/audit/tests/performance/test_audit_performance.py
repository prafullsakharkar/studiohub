"""
Performance tests for Audit application queries.
"""

from __future__ import annotations

import pytest

from apps.audit.models.audit_log import AuditLog
from apps.audit.selectors.audit_log import AuditLogSelector
from apps.audit.tests.factories import AuditLogFactory


@pytest.mark.django_db
class TestAuditLogQueryPerformance:
    """Tests for AuditLog query performance."""

    def test_audit_log_get_by_id_query_count(self, django_assert_num_queries) -> None:
        """Getting an audit log by ID is a bounded number of queries."""
        log = AuditLogFactory()
        with django_assert_num_queries(1):
            retrieved = AuditLogSelector.get_by_id(log.id)
        assert retrieved.id == log.id

    def test_audit_log_list_query_count(self, django_assert_num_queries) -> None:
        """Listing audit logs is a single query without N+1."""
        AuditLogFactory()
        AuditLogFactory()
        with django_assert_num_queries(1):
            logs = list(AuditLog.objects.all())
        assert len(logs) == AuditLog.objects.count()

    def test_audit_log_filter_by_action_query_count(
        self, django_assert_num_queries
    ) -> None:
        """Filtering by action is a single query."""
        AuditLogFactory(action=AuditLog.ACTION_CREATE)
        AuditLogFactory(action=AuditLog.ACTION_UPDATE)
        with django_assert_num_queries(1):
            logs = list(
                AuditLog.objects.filter(action=AuditLog.ACTION_CREATE)
            )
        assert len(logs) == 1

    def test_audit_log_count_no_extra_queries(self, django_assert_num_queries) -> None:
        """Counts on the selector queryset stay bounded."""
        AuditLogFactory()
        with django_assert_num_queries(1):
            count = AuditLogSelector.get_queryset().count()
        assert count >= 1
