"""
Identity OAuth account model tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.oauth_account import OAuthAccount


class TestOAuthAccountModel:
    """Tests for OAuthAccount model."""

    @pytest.mark.django_db
    def test_create_oauth_account(self, oauth_account):
        """Test creating an OAuth account."""
        assert oauth_account is not None
        assert oauth_account.user is not None
        assert oauth_account.provider is not None
        assert oauth_account.provider_id is not None

    @pytest.mark.django_db
    def test_oauth_account_uuid_generation(self, oauth_account):
        """Test UUID is generated on creation."""
        assert oauth_account.uuid is not None
        assert len(str(oauth_account.uuid)) == 36

    @pytest.mark.django_db
    def test_oauth_account_audit_fields(self, oauth_account):
        """Test audit fields are present."""
        assert oauth_account.created_at is not None
        assert oauth_account.updated_at is not None
        assert oauth_account.created_by is None
        assert oauth_account.updated_by is None

    @pytest.mark.django_db
    def test_oauth_account_soft_delete(self, oauth_account):
        """Test soft delete functionality."""
        assert oauth_account.deleted_at is None
        oauth_account.soft_delete()
        oauth_account = type(oauth_account).all_objects.get(pk=oauth_account.pk)
        assert oauth_account.deleted_at is not None

    @pytest.mark.django_db
    def test_oauth_account_unique_constraint(self, oauth_account):
        """Test unique constraint on provider, provider_account_id."""
        with pytest.raises(Exception):
            OAuthAccount.objects.create(
                user=oauth_account.user,
                provider=oauth_account.provider,
                provider_account_id=oauth_account.provider_account_id,
                access_token="new-token",
                refresh_token="new-refresh-token",
            )

    @pytest.mark.django_db
    def test_oauth_account_str_representation(self, oauth_account):
        """Test string representation."""
        expected = f"{oauth_account.user.email} - {oauth_account.provider.name}"
        assert str(oauth_account) == expected

    @pytest.mark.django_db
    def test_oauth_account_access_token(self, oauth_account):
        """Test access_token field."""
        assert oauth_account.access_token is not None

    @pytest.mark.django_db
    def test_oauth_account_refresh_token(self, oauth_account):
        """Test refresh_token field."""
        assert oauth_account.refresh_token is not None

    @pytest.mark.django_db
    def test_oauth_account_expires_at(self, oauth_account):
        """Test expires_at field."""
        assert oauth_account.expires_at is not None

    @pytest.mark.django_db
    def test_oauth_account_extra_data(self, oauth_account):
        """Test metadata field."""
        assert oauth_account.metadata == {}

    @pytest.mark.django_db
    def test_oauth_account_meta_db_table(self, oauth_account):
        """Test database table name."""
        assert oauth_account._meta.db_table == "identity_oauth_accounts"
