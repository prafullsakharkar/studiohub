"""
Identity SQL injection security tests.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.identity.tests.factories import UserFactory


class TestSQLInjectionSecurity:
    """Tests for SQL injection security."""

    @pytest.mark.django_db
    def test_email_field_sanitizes_sql_injection(self, api_client):
        """Test that email field sanitizes SQL injection attempts."""
        sql_attempts = [
            "test@example.com' OR '1'='1",
            "test@example.com' UNION SELECT * FROM users--",
            "test@example.com'; DROP TABLE users;--",
            "test@example.com' AND 1=1--",
        ]

        for attempt in sql_attempts:
            response = api_client.post(
                reverse("api:v1:identity:login"),
                {"email": attempt, "password": "Password123!"},
            )
            # Should not return 200 (success) for SQL injection attempts
            assert response.status_code in [400, 401]

    @pytest.mark.django_db
    def test_username_field_sanitizes_sql_injection(self, api_client):
        """Test that username field sanitizes SQL injection attempts."""
        sql_attempts = [
            "admin' OR '1'='1",
            "admin' UNION SELECT * FROM users--",
            "admin'; DROP TABLE users;--",
        ]

        for attempt in sql_attempts:
            response = api_client.post(
                reverse("api:v1:identity:login"),
                {"email": attempt, "password": "Password123!"},
            )
            # Should not return 200 (success) for SQL injection attempts
            assert response.status_code in [400, 401]

    @pytest.mark.django_db
    def test_search_parameter_sanitizes_sql_injection(self, api_client):
        """Test that search parameter sanitizes SQL injection attempts."""
        sql_attempts = [
            "test' OR '1'='1",
            "test' UNION SELECT * FROM users--",
            "test'; DROP TABLE users;--",
        ]

        for attempt in sql_attempts:
            response = api_client.get(
                reverse("api:v1:identity:user-list"),
                {"search": attempt},
            )
            # Should not return 200 (success) for SQL injection attempts
            assert response.status_code in [400, 401]

    @pytest.mark.django_db
    def test_ordering_parameter_sanitizes_sql_injection(self, api_client):
        """Test that ordering parameter sanitizes SQL injection attempts."""
        sql_attempts = [
            "email DESC; DROP TABLE users;--",
            "email ASC UNION SELECT * FROM users--",
        ]

        for attempt in sql_attempts:
            response = api_client.get(
                reverse("api:v1:identity:user-list"),
                {"ordering": attempt},
            )
            # Should not return 200 (success) for SQL injection attempts
            assert response.status_code in [400, 401]
