"""
Organization test fixtures.
"""

from __future__ import annotations

import pytest

from apps.identity.tests.factories import UserFactory

from .factories import (
    APIKeyFactory,
    BrandingFactory,
    CalendarFactory,
    DepartmentFactory,
    GroupFactory,
    GroupMemberFactory,
    GroupRoleFactory,
    HolidayFactory,
    InvitationFactory,
    LoginHistoryFactory,
    OfficeFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
    OrganizationSettingsFactory,
    PermissionFactory,
    PersonalAccessTokenFactory,
    PersonFactory,
    PositionFactory,
    RoleFactory,
    RolePermissionFactory,
    TeamFactory,
    UserPreferenceFactory,
    UserRoleFactory,
    UserSessionFactory,
    WorkCalendarFactory,
    WorkHoursFactory,
)


@pytest.fixture
def user(db):
    """Create a user."""
    return UserFactory.create()


@pytest.fixture
def staff_user(db):
    """Create a staff user."""
    return UserFactory.create(is_staff=True)


@pytest.fixture
def admin_user(db):
    """Create a superuser."""
    return UserFactory.create(is_staff=True, is_superuser=True)


@pytest.fixture
def api_client():
    """Get an unauthenticated API client."""
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def authenticated_client(user):
    """Get an authenticated API client."""
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def staff_client(staff_user):
    """Get a staff API client."""
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client


@pytest.fixture
def admin_client(admin_user):
    """Get an admin API client."""
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def organization(db):
    """Create an organization."""
    return OrganizationFactory.create()


@pytest.fixture
def person(db):
    """Create a person."""
    return PersonFactory.create()


@pytest.fixture
def active_person(db):
    """Create an active person."""
    return PersonFactory.create(status="active")


@pytest.fixture
def inactive_person(db):
    """Create an inactive person."""
    return PersonFactory.create(status="inactive")


@pytest.fixture
def department(db):
    """Create a department."""
    return DepartmentFactory.create()


@pytest.fixture
def active_department(db):
    """Create an active department."""
    return DepartmentFactory.create(status="active")


@pytest.fixture
def group(db):
    """Create a group."""
    return GroupFactory.create()


@pytest.fixture
def active_group(db):
    """Create an active group."""
    return GroupFactory.create(status="active")


@pytest.fixture
def group_role(db):
    """Create a group role."""
    return GroupRoleFactory.create()


@pytest.fixture
def active_group_role(db):
    """Create an active group role."""
    return GroupRoleFactory.create(status="active")


@pytest.fixture
def group_member(db):
    """Create a group member."""
    return GroupMemberFactory.create()


@pytest.fixture
def active_group_member(db):
    """Create an active group member."""
    return GroupMemberFactory.create(status="active")


@pytest.fixture
def holiday(db):
    """Create a holiday."""
    return HolidayFactory.create()


@pytest.fixture
def active_holiday(db):
    """Create an active holiday."""
    return HolidayFactory.create(status="active")


@pytest.fixture
def invitation(db):
    """Create an invitation."""
    return InvitationFactory.create()


@pytest.fixture
def pending_invitation(db):
    """Create a pending invitation."""
    return InvitationFactory.create(status="pending")


@pytest.fixture
def accepted_invitation(db):
    """Create an accepted invitation."""
    return InvitationFactory.create(status="accepted")


@pytest.fixture
def expired_invitation(db):
    """Create an expired invitation."""
    return InvitationFactory.create(
        status="pending",
        expires_at=None,
    )


@pytest.fixture
def login_history(db):
    """Create a login history."""
    return LoginHistoryFactory.create()


@pytest.fixture
def successful_login(db):
    """Create a successful login."""
    return LoginHistoryFactory.create(status="success")


@pytest.fixture
def failed_login(db):
    """Create a failed login."""
    return LoginHistoryFactory.create(status="failed", failure_reason="Invalid password")


@pytest.fixture
def organization_membership(db):
    """Create an organization membership."""
    return OrganizationMembershipFactory.create()


@pytest.fixture
def active_organization_membership(db):
    """Create an active organization membership."""
    return OrganizationMembershipFactory.create(status="active")


@pytest.fixture
def inactive_organization_membership(db):
    """Create an inactive organization membership."""
    return OrganizationMembershipFactory.create(status="inactive")


@pytest.fixture
def office(db):
    """Create an office."""
    return OfficeFactory.create()


@pytest.fixture
def active_office(db):
    """Create an active office."""
    return OfficeFactory.create(status="active")


@pytest.fixture
def organization_settings(db):
    """Create organization settings."""
    return OrganizationSettingsFactory.create()


@pytest.fixture
def permission(db):
    """Create a permission."""
    return PermissionFactory.create()


@pytest.fixture
def active_permission(db):
    """Create an active permission."""
    return PermissionFactory.create(status="active")


@pytest.fixture
def personal_access_token(db):
    """Create a personal access token."""
    return PersonalAccessTokenFactory.create()


@pytest.fixture
def active_token(db):
    """Create an active token."""
    return PersonalAccessTokenFactory.create(is_active=True)


@pytest.fixture
def expired_token(db):
    """Create an expired token."""
    return PersonalAccessTokenFactory.create(
        is_active=True,
        expires_at=None,
    )


@pytest.fixture
def position(db):
    """Create a position."""
    return PositionFactory.create()


@pytest.fixture
def active_position(db):
    """Create an active position."""
    return PositionFactory.create(status="active")


@pytest.fixture
def role(db):
    """Create a role."""
    return RoleFactory.create()


@pytest.fixture
def active_role(db):
    """Create an active role."""
    return RoleFactory.create(status="active")


@pytest.fixture
def system_role(db):
    """Create a system role."""
    return RoleFactory.create(is_system=True)


@pytest.fixture
def default_role(db):
    """Create a default role."""
    return RoleFactory.create(is_default=True)


@pytest.fixture
def role_permission(db):
    """Create a role permission."""
    return RolePermissionFactory.create()


@pytest.fixture
def granted_role_permission(db):
    """Create a granted role permission."""
    return RolePermissionFactory.create(is_granted=True)


@pytest.fixture
def denied_role_permission(db):
    """Create a denied role permission."""
    return RolePermissionFactory.create(is_granted=False)


@pytest.fixture
def team(db):
    """Create a team."""
    return TeamFactory.create()


@pytest.fixture
def active_team(db):
    """Create an active team."""
    return TeamFactory.create(status="active")


@pytest.fixture
def user_preference(db):
    """Create a user preference."""
    return UserPreferenceFactory.create()


@pytest.fixture
def user_role(db):
    """Create a user role."""
    return UserRoleFactory.create()


@pytest.fixture
def primary_user_role(db):
    """Create a primary user role."""
    return UserRoleFactory.create(is_primary=True)


@pytest.fixture
def user_session(db):
    """Create a user session."""
    return UserSessionFactory.create()


@pytest.fixture
def active_session(db):
    """Create an active session."""
    return UserSessionFactory.create(is_active=True)


@pytest.fixture
def expired_session(db):
    """Create an expired session."""
    return UserSessionFactory.create(
        is_active=True,
        expires_at=None,
    )


@pytest.fixture
def work_calendar(db):
    """Create a work calendar."""
    return WorkCalendarFactory.create()


@pytest.fixture
def default_work_calendar(db):
    """Create a default work calendar."""
    return WorkCalendarFactory.create(is_default=True)


@pytest.fixture
def work_hours(db):
    """Create work hours."""
    return WorkHoursFactory.create()


@pytest.fixture
def working_day_hours(db):
    """Create working day hours."""
    return WorkHoursFactory.create(is_working_day=True)


@pytest.fixture
def non_working_day_hours(db):
    """Create non-working day hours."""
    return WorkHoursFactory.create(is_working_day=False)


@pytest.fixture
def api_key(db):
    """Create an API key."""
    return APIKeyFactory.create()


@pytest.fixture
def active_api_key(db):
    """Create an active API key."""
    return APIKeyFactory.create(is_active=True)


@pytest.fixture
def branding(db):
    """Create branding."""
    return BrandingFactory.create()


@pytest.fixture
def calendar(db):
    """Create a calendar."""
    return CalendarFactory.create()


@pytest.fixture
def active_calendar(db):
    """Create an active calendar."""
    return CalendarFactory.create(status="active")
