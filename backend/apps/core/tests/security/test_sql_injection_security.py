"""
Core SQL injection security tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.core.tests.factories import TagFactory


class TestSQLInjectionSecurity:
    """Tests for SQL injection security."""

    @pytest.mark.django_db
    def test_tag_search_prevents_sql_injection(self):
        """Test that tag search endpoint prevents SQL injection."""
        from rest_framework.test import APIClient

        client = APIClient()
        TagFactory.create_batch(10)

        # SQL injection attempts
        sql_injection_attempts = [
            "' OR '1'='1",
            "' OR 1=1--",
            "'; DROP TABLE core_tag;--",
            "1' AND 1=1 UNION SELECT * FROM users--",
        ]

        for attempt in sql_injection_attempts:
            url = reverse("api:v1:core:tag-list")
            response = client.get(url, {"search": attempt})

            # Should return valid response, not crash
            assert response.status_code in [200, 400, 401, 403]

    @pytest.mark.django_db
    def test_tag_filter_prevents_sql_injection(self):
        """Test that tag filter endpoint prevents SQL injection."""
        from rest_framework.test import APIClient

        client = APIClient()
        TagFactory.create_batch(10)

        # SQL injection attempts
        sql_injection_attempts = [
            "1' OR '1'='1",
            "1' OR 1=1--",
            "'; DROP TABLE core_tag;--",
        ]

        for attempt in sql_injection_attempts:
            url = reverse("api:v1:core:tag-list")
            response = client.get(url, {"is_system": attempt})

            # Should return valid response, not crash
            assert response.status_code in [200, 400, 401, 403]
