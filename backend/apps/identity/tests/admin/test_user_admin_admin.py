"""
Identity user admin tests.
"""

from __future__ import annotations

import pytest
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory

from apps.identity.admin.user import UserAdmin
from apps.identity.models.user import User
from apps.identity.tests.factories import UserFactory


class TestUserAdmin:
    """Tests for UserAdmin."""

    @pytest.mark.django_db
    def test_user_admin_list_display(self):
        """Test user admin list display."""
        admin = UserAdmin(User, AdminSite())

        assert "email" in admin.list_display
        assert "is_active" in admin.list_display
        assert "is_staff" in admin.list_display
        assert "is_email_verified" in admin.list_display
        assert "last_seen" in admin.list_display

    @pytest.mark.django_db
    def test_user_admin_search_fields(self):
        """Test user admin search fields."""
        admin = UserAdmin(User, AdminSite())

        assert "email" in admin.search_fields

    @pytest.mark.django_db
    def test_user_admin_filter_horizontal(self):
        """Test user admin filter horizontal."""
        admin = UserAdmin(User, AdminSite())

        assert "groups" in admin.filter_horizontal
        assert "user_permissions" in admin.filter_horizontal

    @pytest.mark.django_db
    def test_user_admin_fieldsets(self):
        """Test user admin fieldsets."""
        admin = UserAdmin(User, AdminSite())

        assert len(admin.fieldsets) > 0

    @pytest.mark.django_db
    def test_user_admin_add_fieldsets(self):
        """Test user admin add fieldsets."""
        admin = UserAdmin(User, AdminSite())

        assert len(admin.add_fieldsets) > 0

    @pytest.mark.django_db
    def test_user_admin_get_queryset(self):
        """Test user admin get_queryset."""
        admin = UserAdmin(User, AdminSite())
        request = RequestFactory().get("/")
        request.user = UserFactory.create(is_staff=True, is_superuser=True)

        qs = admin.get_queryset(request)
        assert qs.count() == 1
        assert qs.first() == request.user

    @pytest.mark.django_db
    def test_user_admin_has_add_permission(self):
        """Test user admin has add permission."""
        admin = UserAdmin(User, AdminSite())
        request = RequestFactory().get("/")
        request.user = UserFactory.create(is_staff=True, is_superuser=True)

        assert admin.has_add_permission(request)

    @pytest.mark.django_db
    def test_user_admin_has_change_permission(self):
        """Test user admin has change permission."""
        admin = UserAdmin(User, AdminSite())
        request = RequestFactory().get("/")
        request.user = UserFactory.create(is_staff=True, is_superuser=True)

        assert admin.has_change_permission(request)

    @pytest.mark.django_db
    def test_user_admin_has_delete_permission(self):
        """Test user admin has delete permission."""
        admin = UserAdmin(User, AdminSite())
        request = RequestFactory().get("/")
        request.user = UserFactory.create(is_staff=True, is_superuser=True)

        assert admin.has_delete_permission(request)
