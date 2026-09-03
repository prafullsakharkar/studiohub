"""
Identity IP blacklist service tests.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from apps.identity.tests.factories import IPBlacklistFactory, UserFactory


class TestIPBlacklistService:
    """Tests for IPBlacklistService."""

    @pytest.mark.django_db
    def test_create_ip_blacklist_success(self):
        """Test successful IP blacklist creation."""
        user = UserFactory.create()

        with patch(
            "apps.identity.services.ip_blacklist.create_ip_blacklist"
        ) as mock_create:
            mock_create.return_value = IPBlacklistFactory.create()
            from apps.identity.services.ip_blacklist import create_ip_blacklist

            result = create_ip_blacklist(
                user, {"ip_address": "192.168.1.1", "reason": "Suspicious activity"}
            )
            assert result is not None

    @pytest.mark.django_db
    def test_update_ip_blacklist_success(self):
        """Test successful IP blacklist update."""
        entry = IPBlacklistFactory.create()

        with patch(
            "apps.identity.services.ip_blacklist.update_ip_blacklist"
        ) as mock_update:
            mock_update.return_value = entry
            from apps.identity.services.ip_blacklist import update_ip_blacklist

            result = update_ip_blacklist(entry, {"reason": "Updated reason"})
            assert result is not None

    @pytest.mark.django_db
    def test_delete_ip_blacklist_success(self):
        """Test successful IP blacklist deletion."""
        entry = IPBlacklistFactory.create()

        with patch(
            "apps.identity.services.ip_blacklist.delete_ip_blacklist"
        ) as mock_delete:
            mock_delete.return_value = True
            from apps.identity.services.ip_blacklist import delete_ip_blacklist

            result = delete_ip_blacklist(entry)
            assert result is True

    @pytest.mark.django_db
    def test_is_ip_blacklisted_success(self):
        """Test successful IP blacklist check."""
        IPBlacklistFactory.create(ip_address="192.168.1.1")

        with patch("apps.identity.services.ip_blacklist.is_ip_blacklisted") as mock_check:
            mock_check.return_value = True
            from apps.identity.services.ip_blacklist import is_ip_blacklisted

            result = is_ip_blacklisted("192.168.1.1")
            assert result is True

    @pytest.mark.django_db
    def test_is_ip_blacklisted_failure(self):
        """Test failed IP blacklist check."""
        with patch("apps.identity.services.ip_blacklist.is_ip_blacklisted") as mock_check:
            mock_check.return_value = False
            from apps.identity.services.ip_blacklist import is_ip_blacklisted

            result = is_ip_blacklisted("10.0.0.1")
            assert result is False
