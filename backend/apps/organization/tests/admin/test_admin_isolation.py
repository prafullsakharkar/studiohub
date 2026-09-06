"""
Tests for organization isolation inside Django Admin.

Non-superuser staff only see rows from their own organizations;
superusers keep global access; users without memberships see nothing.
"""

from __future__ import annotations

import pytest
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory

from apps.audit.admin import AuditLogAdmin
from apps.audit.models import AuditLog
from apps.identity.tests.factories import UserFactory
from apps.organization.admin.client import ClientAdmin
from apps.organization.admin.role import RoleAdmin
from apps.organization.admin.team import TeamAdmin
from apps.organization.admin.user_role import UserRoleAdmin
from apps.organization.models import Client, Role, Team, UserRole
from apps.organization.tests.factories import (
    ClientFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
    RoleFactory,
    TeamFactory,
    UserRoleFactory,
)


def _request(user):
    request = RequestFactory().get("/admin/")
    request.user = user
    return request


def _staff_in(org):
    user = UserFactory.create(is_staff=True)
    OrganizationMembershipFactory.create(organization=org, user=user)
    return user


@pytest.mark.django_db
class TestDirectOrganizationScoping:
    def test_member_sees_only_own_org_teams(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        TeamFactory.create(organization=org_a)
        TeamFactory.create(organization=org_b)
        user = _staff_in(org_b)

        qs = TeamAdmin(Team, AdminSite()).get_queryset(_request(user))

        assert qs.count() == 1
        assert qs.first().organization_id == org_b.id

    def test_member_sees_only_own_org_clients(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        ClientFactory.create(organization=org_a)
        ClientFactory.create(organization=org_b)
        user = _staff_in(org_b)

        qs = ClientAdmin(Client, AdminSite()).get_queryset(_request(user))

        assert qs.count() == 1
        assert qs.first().organization_id == org_b.id

    def test_superuser_sees_everything(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        TeamFactory.create(organization=org_a)
        TeamFactory.create(organization=org_b)
        superuser = UserFactory.create(is_staff=True, is_superuser=True)

        qs = TeamAdmin(Team, AdminSite()).get_queryset(_request(superuser))

        assert qs.count() == 2

    def test_staff_without_membership_sees_nothing(self):
        org_a = OrganizationFactory.create()
        TeamFactory.create(organization=org_a)
        outsider = UserFactory.create(is_staff=True)

        qs = TeamAdmin(Team, AdminSite()).get_queryset(_request(outsider))

        assert qs.count() == 0


@pytest.mark.django_db
class TestNullableAndJunctionScoping:
    def test_global_roles_stay_visible(self):
        org = OrganizationFactory.create()
        RoleFactory.create(organization=org)
        RoleFactory.create(organization=None)
        user = _staff_in(org)

        qs = RoleAdmin(Role, AdminSite()).get_queryset(_request(user))

        assert qs.count() == 2

    def test_junction_rows_follow_parent_org(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        role_a = RoleFactory.create(organization=org_a)
        role_b = RoleFactory.create(organization=org_b)
        UserRoleFactory.create(role=role_a)
        UserRoleFactory.create(role=role_b)
        user = _staff_in(org_b)

        qs = UserRoleAdmin(UserRole, AdminSite()).get_queryset(_request(user))

        assert qs.count() == 1
        assert qs.first().role_id == role_b.id


@pytest.mark.django_db
class TestCrossAppScoping:
    def test_audit_log_scoped(self):
        from apps.audit.tests.factories import AuditLogFactory

        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        AuditLogFactory.create(organization=org_a)
        AuditLogFactory.create(organization=org_b)
        user = _staff_in(org_b)

        qs = AuditLogAdmin(AuditLog, AdminSite()).get_queryset(_request(user))

        assert qs.count() == 1
        assert qs.first().organization_id == org_b.id

    def test_organization_dropdown_scoped(self):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        user = _staff_in(org_b)

        model_admin = TeamAdmin(Team, AdminSite())
        field = Team._meta.get_field("organization")
        formfield = model_admin.formfield_for_foreignkey(field, _request(user))

        assert set(formfield.queryset.values_list("id", flat=True)) == {org_b.id}
        assert org_a.id not in set(formfield.queryset.values_list("id", flat=True))
