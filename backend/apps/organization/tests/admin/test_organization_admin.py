"""
Tests for organization admin.
"""

from __future__ import annotations

import pytest
from django.contrib import admin
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.test import RequestFactory

from apps.organization.admin import OrganizationAdmin
from apps.organization.models import Organization
from apps.organization.tests.factories import OrganizationFactory

User = get_user_model()


class TestOrganizationAdmin:
    """Tests for OrganizationAdmin."""

    @pytest.mark.django_db
    def test_admin_registered(self):
        """Test the admin is registered for Organization."""
        assert admin.site.is_registered(Organization)

    @pytest.mark.django_db
    def test_admin_list_display(self):
        """Test admin list display fields."""
        admin = OrganizationAdmin(Organization, AdminSite())

        assert "name" in admin.list_display
        assert "code" in admin.list_display
        assert "organization_type" in admin.list_display
        assert "status" in admin.list_display
        assert "country" in admin.list_display
        assert "created_at" in admin.list_display

    @pytest.mark.django_db
    def test_admin_list_filter(self):
        """Test admin list filter fields."""
        admin = OrganizationAdmin(Organization, AdminSite())

        assert "organization_type" in admin.list_filter
        assert "status" in admin.list_filter
        assert "country" in admin.list_filter

    @pytest.mark.django_db
    def test_admin_search_fields(self):
        """Test admin search fields."""
        admin = OrganizationAdmin(Organization, AdminSite())

        assert "name" in admin.search_fields
        assert "code" in admin.search_fields
        assert "slug" in admin.search_fields

    @pytest.mark.django_db
    def test_admin_readonly_fields(self):
        """Test admin readonly fields.

        Per the UUID lookup convention, the primary key is ``id`` and
        ``uuid`` is only a property alias, so readonly fields reference
        ``id``.
        """
        admin = OrganizationAdmin(Organization, AdminSite())

        assert "id" in admin.readonly_fields
        assert "slug" in admin.readonly_fields
        assert "created_at" in admin.readonly_fields
        assert "updated_at" in admin.readonly_fields

    @pytest.mark.django_db
    def test_admin_save_model(self):
        """Test admin save model persists the organization."""
        admin = OrganizationAdmin(Organization, AdminSite())
        request = RequestFactory().post("/admin/organization/organization/add/")
        request.user = User.objects.create_user(
            email="admin@example.com",
            password="testpass123",
        )

        organization = OrganizationFactory.build()

        admin.save_model(request, organization, form=None, change=False)

        assert organization is not None
        assert organization.uuid is not None
