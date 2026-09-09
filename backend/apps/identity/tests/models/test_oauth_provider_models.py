"""
Identity OAuth provider model tests.
"""

from __future__ import annotations

import pytest
from django.db import IntegrityError

from apps.identity.models.oauth_provider import OAuthProvider


class TestOAuthProviderModel:
    """Tests for OAuthProvider model."""

    @pytest.mark.django_db
    def test_create_oauth_provider(self, oauth_provider):
        """Test creating an OAuth provider."""
        assert oauth_provider is not None
        assert oauth_provider.name is not None
        assert oauth_provider.client_id is not None
        assert oauth_provider.client_secret is not None

    @pytest.mark.django_db
    def test_oauth_provider_uuid_generation(self, oauth_provider):
        """Test UUID is generated on creation."""
        assert oauth_provider.uuid is not None
        assert len(str(oauth_provider.uuid)) == 36

    @pytest.mark.django_db
    def test_oauth_provider_audit_fields(self, oauth_provider):
        """Test audit fields are present."""
        assert oauth_provider.created_at is not None
        assert oauth_provider.updated_at is not None
        assert oauth_provider.created_by is None
        assert oauth_provider.updated_by is None

    @pytest.mark.django_db
    def test_oauth_provider_soft_delete(self, oauth_provider):
        """Test soft delete functionality."""
        assert oauth_provider.deleted_at is None
        oauth_provider.soft_delete()
        oauth_provider = type(oauth_provider).all_objects.get(pk=oauth_provider.pk)
        assert oauth_provider.deleted_at is not None

    @pytest.mark.django_db
    def test_oauth_provider_unique_name(self, oauth_provider):
        """Test name field is unique."""
        with pytest.raises(IntegrityError):
            OAuthProvider.objects.create(
                name=oauth_provider.name,
                client_id="new-client-id",
                client_secret="new-client-secret",
            )

    @pytest.mark.django_db
    def test_oauth_provider_str_representation(self, oauth_provider):
        """Test string representation."""
        assert str(oauth_provider) == oauth_provider.name

    @pytest.mark.django_db
    def test_oauth_provider_is_active(self, oauth_provider):
        """Test is_active field."""
        assert oauth_provider.is_active is True

    @pytest.mark.django_db
    def test_oauth_provider_scopes(self, oauth_provider):
        """Test scope field."""
        assert "openid" in oauth_provider.scope
        assert "profile" in oauth_provider.scope
        assert "email" in oauth_provider.scope

    @pytest.mark.django_db
    def test_oauth_provider_urls(self, oauth_provider):
        """Test URL fields."""
        assert oauth_provider.authorization_url is not None
        assert oauth_provider.token_url is not None
        assert oauth_provider.userinfo_url is not None

    @pytest.mark.django_db
    def test_oauth_provider_meta_db_table(self, oauth_provider):
        """Test database table name."""
        assert oauth_provider._meta.db_table == "identity_oauth_providers"
