# tests/managers/test_audit.py
"""
Manager tests for Audit application.
"""

from __future__ import annotations

import pytest

from apps.audit.models.audit_log import AuditLog
from apps.audit.tests.factories import AuditLogFactory
from apps.core.tests.base import BaseTestCase


class TestAuditLogManager(BaseTestCase):
    """Tests for AuditLog manager."""

    @pytest.mark.django_db
    def test_manager_all(self) -> None:
        """Test manager all method."""
        AuditLogFactory.create_batch(5)
        queryset = AuditLog.objects.all()
        assert queryset.count() == 5

    @pytest.mark.django_db
    def test_manager_filter(self) -> None:
        """Test manager filter method."""
        AuditLogFactory.create_batch(3, action="create")
        AuditLogFactory.create_batch(2, action="update")
        queryset = AuditLog.objects.filter(action="update")
        assert queryset.count() == 2
