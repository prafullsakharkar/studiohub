"""
Organization test factories.
"""

from __future__ import annotations

import factory
from django.utils import timezone
from factory import LazyAttribute
from factory.django import DjangoModelFactory
from factory.fuzzy import FuzzyChoice, FuzzyDecimal

from apps.audit.models.login_history import LoginHistory
from apps.identity.tests.factories import UserFactory
from apps.organization.choices import OrganizationType
from apps.organization.models.api_key import APIKey
from apps.organization.models.branding import Branding
from apps.organization.models.calendar import Calendar
from apps.organization.models.department import Department
from apps.organization.models.group import Group
from apps.organization.models.group_member import GroupMember
from apps.organization.models.group_role import GroupRole
from apps.organization.models.holiday import Holiday
from apps.organization.models.invitation import Invitation
from apps.organization.models.membership import OrganizationMembership
from apps.organization.models.office import Office
from apps.organization.models.organization import Organization
from apps.organization.models.organization_settings import OrganizationSettings
from apps.organization.models.permission import Permission
from apps.organization.models.person import Person
from apps.organization.models.personal_access_token import PersonalAccessToken
from apps.organization.models.position import Position
from apps.organization.models.role import Role
from apps.organization.models.role_permission import RolePermission
from apps.organization.models.team import Team
from apps.organization.models.user_preference import UserPreference
from apps.organization.models.user_role import UserRole
from apps.organization.models.user_session import UserSession
from apps.organization.models.work_calendar import WorkCalendar
from apps.organization.models.work_hours import WorkHours


class PersonFactory(DjangoModelFactory):
    """Factory for Person model."""

    class Meta:
        model = Person
        django_get_or_create = ("user",)

    user = factory.SubFactory(UserFactory)
    organization = factory.SubFactory(
        "apps.organization.tests.factories.OrganizationFactory"
    )
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    email = factory.LazyAttribute(
        lambda o: f"{o.first_name.lower()}.{o.last_name.lower()}@organization.com"
    )
    phone = factory.Faker("phone_number")
    job_title = factory.Faker("job")
    department = factory.SubFactory("apps.organization.tests.factories.DepartmentFactory")
    office = factory.SubFactory("apps.organization.tests.factories.OfficeFactory")
    manager = None
    status = "active"
    date_of_birth = factory.Faker("date_of_birth", minimum_age=18, maximum_age=65)
    date_of_joining = factory.Faker("date_this_decade")
    date_of_leaving = None


class OrganizationFactory(DjangoModelFactory):
    """Factory for Organization model."""

    class Meta:
        model = Organization
        django_get_or_create = ("code",)

    code = factory.Sequence(lambda n: f"ORG{n:03d}")
    name = factory.Sequence(lambda n: f"Organization {n}")
    slug = LazyAttribute(lambda o: o.code.lower())
    organization_type = FuzzyChoice(
        choices=[c[0] for c in OrganizationType.choices]
    )
    email = factory.LazyAttribute(lambda o: f"contact@{o.slug}.com")
    phone = factory.Faker("phone_number")
    website = factory.Faker("url")
    country = "IN"
    language = "en"
    currency = "INR"
    timezone = "Asia/Kolkata"
    description = factory.Faker("text", max_nb_chars=500)
    status = "active"

    @classmethod
    def create_active(cls, **kwargs):
        """Create an active organization."""
        return cls.create(status="active", **kwargs)

    @classmethod
    def create_inactive(cls, **kwargs):
        """Create an inactive organization."""
        return cls.create(status="inactive", **kwargs)

    @classmethod
    def create_archived(cls, **kwargs):
        """Create an archived organization."""
        return cls.create(status="archived", **kwargs)


class BrandingFactory(DjangoModelFactory):
    """Factory for Branding model."""

    class Meta:
        model = Branding
        django_get_or_create = ("organization",)

    organization = factory.SubFactory(OrganizationFactory)
    logo = factory.django.FileField(filename="logo.png")
    favicon = factory.django.FileField(filename="favicon.ico")
    primary_color = "#007bff"
    secondary_color = "#6c757d"
    accent_color = "#17a2b8"
    background_color = "#ffffff"
    text_color = "#333333"
    font_family = "Arial, sans-serif"
    is_default = True


class DepartmentFactory(DjangoModelFactory):
    """Factory for Department model."""

    class Meta:
        model = Department
        django_get_or_create = ("code", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    code = factory.Sequence(lambda n: f"DEPT{n:03d}")
    name = factory.Sequence(lambda n: f"Department {n}")
    description = factory.Faker("text", max_nb_chars=200)
    manager = factory.SubFactory(PersonFactory)
    parent = None
    status = "active"
    budget = FuzzyDecimal(10000, 1000000)
    budget_currency = "INR"


class HolidayFactory(DjangoModelFactory):
    """Factory for Holiday model."""

    class Meta:
        model = Holiday
        django_get_or_create = ("name", "date", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Faker("sentence", nb_words=3)
    description = factory.Faker("text", max_nb_chars=200)
    date = factory.Faker("date_this_year")
    holiday_type = FuzzyChoice(choices=["PUBLIC", "COMPANY", "REGIONAL", "RELIGIOUS"])
    is_paid = True
    status = "active"


class LoginHistoryFactory(DjangoModelFactory):
    """Factory for LoginHistory model (canonical audit app)."""

    class Meta:
        model = LoginHistory

    user = factory.SubFactory(UserFactory)
    organization = factory.SubFactory(OrganizationFactory)
    email = factory.LazyAttribute(lambda o: o.user.email)
    ip_address = factory.Faker("ipv4")
    user_agent = factory.Faker("user_agent")
    status = "success"
    failure_reason = ""


class OrganizationMembershipFactory(DjangoModelFactory):
    """Factory for OrganizationMembership model."""

    class Meta:
        model = OrganizationMembership
        django_get_or_create = ("user", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    department = None
    team = None
    office = None
    role = factory.SubFactory("apps.organization.tests.factories.RoleFactory")
    joined_at = factory.Faker("date_this_year")
    left_at = None
    status = "active"


class RoleFactory(DjangoModelFactory):
    """Factory for Role model."""

    class Meta:
        model = Role
        django_get_or_create = ("name", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    code = factory.Sequence(lambda n: f"ROLE{n:03d}")
    name = factory.Sequence(lambda n: f"Role {n}")
    description = factory.Faker("text", max_nb_chars=200)
    priority = factory.Sequence(lambda n: n)
    is_active = True


class UserSessionFactory(DjangoModelFactory):
    """Factory for UserSession model."""

    class Meta:
        model = UserSession

    user = factory.SubFactory(UserFactory)
    organization = factory.SubFactory(OrganizationFactory)
    session_key = factory.Faker("uuid4")
    ip_address = factory.Faker("ipv4")
    user_agent = factory.Faker("user_agent")
    status = "active"
    started_at = factory.Faker("date_time_this_year")
    last_activity = factory.Faker("date_time_this_year")
    expires_at = factory.LazyFunction(lambda: timezone.now() + timezone.timedelta(days=30))
    logged_out_at = None


class APIKeyFactory(DjangoModelFactory):
    """Factory for APIKey model."""

    class Meta:
        model = APIKey
        django_get_or_create = ("name", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"API Key {n}")
    key = factory.Sequence(lambda n: f"api_key_{n:08d}")
    created_by = factory.SubFactory(UserFactory)
    status = "active"


class CalendarFactory(DjangoModelFactory):
    """Factory for Calendar model."""

    class Meta:
        model = Calendar
        django_get_or_create = ("name", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Calendar {n}")
    description = factory.Faker("text", max_nb_chars=200)
    is_active = True
    calendar_type = "general"


class GroupFactory(DjangoModelFactory):
    """Factory for Group model."""

    class Meta:
        model = Group
        django_get_or_create = ("name", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Group {n}")
    description = factory.Faker("text", max_nb_chars=200)
    is_active = True


class GroupMemberFactory(DjangoModelFactory):
    """Factory for GroupMember model."""

    class Meta:
        model = GroupMember
        django_get_or_create = ("group", "person")

    group = factory.SubFactory(GroupFactory)
    person = factory.SubFactory(PersonFactory)
    joined_at = factory.Faker("date_this_year")
    status = "active"


class GroupRoleFactory(DjangoModelFactory):
    """Factory for GroupRole model."""

    class Meta:
        model = GroupRole
        django_get_or_create = ("group", "role")

    group = factory.SubFactory(GroupFactory)
    role = factory.SubFactory(RoleFactory)


class InvitationFactory(DjangoModelFactory):
    """Factory for Invitation model."""

    class Meta:
        model = Invitation
        django_get_or_create = ("email", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    email = factory.LazyAttribute(lambda o: f"invite{o.organization.code}@example.com")
    invitation_type = "membership"
    invitation_status = "pending"
    invited_by = factory.SubFactory(UserFactory)


class OfficeFactory(DjangoModelFactory):
    """Factory for Office model."""

    class Meta:
        model = Office
        django_get_or_create = ("code", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    code = factory.Sequence(lambda n: f"OFFICE{n:03d}")
    name = factory.Sequence(lambda n: f"Office {n}")
    address = factory.Faker("address")
    city = factory.Faker("city")
    state = factory.Faker("state")
    country = "IN"
    pincode = factory.Faker("postcode")
    is_active = True


class OrganizationSettingsFactory(DjangoModelFactory):
    """Factory for OrganizationSettings model."""

    class Meta:
        model = OrganizationSettings
        django_get_or_create = ("organization",)

    organization = factory.SubFactory(OrganizationFactory)
    default_currency = "INR"
    default_timezone = "Asia/Kolkata"
    default_language = "en"
    enable_notifications = True
    enable_audit_log = True


class PermissionFactory(DjangoModelFactory):
    """Factory for Permission model."""

    class Meta:
        model = Permission
        django_get_or_create = ("name", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Permission {n}")
    code = factory.Sequence(lambda n: f"perm_{n:04d}")
    description = factory.Faker("text", max_nb_chars=200)
    category = "general"
    is_active = True


class PersonalAccessTokenFactory(DjangoModelFactory):
    """Factory for PersonalAccessToken model."""

    class Meta:
        model = PersonalAccessToken
        django_get_or_create = ("name", "user")

    user = factory.SubFactory(UserFactory)
    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Token {n}")
    token = factory.Sequence(lambda n: f"pat_{n:08d}")
    expires_at = factory.Faker("date_time_this_year")
    is_active = True


class PositionFactory(DjangoModelFactory):
    """Factory for Position model."""

    class Meta:
        model = Position
        django_get_or_create = ("name", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Position {n}")
    description = factory.Faker("text", max_nb_chars=200)
    level = factory.Sequence(lambda n: n)
    is_active = True


class RolePermissionFactory(DjangoModelFactory):
    """Factory for RolePermission model."""

    class Meta:
        model = RolePermission
        django_get_or_create = ("role", "permission")

    role = factory.SubFactory(RoleFactory)
    permission = factory.SubFactory(PermissionFactory)


class TeamFactory(DjangoModelFactory):
    """Factory for Team model."""

    class Meta:
        model = Team
        django_get_or_create = ("code", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    code = factory.Sequence(lambda n: f"TEAM{n:03d}")
    name = factory.Sequence(lambda n: f"Team {n}")
    description = factory.Faker("text", max_nb_chars=200)
    is_active = True


class UserPreferenceFactory(DjangoModelFactory):
    """Factory for UserPreference model."""

    class Meta:
        model = UserPreference
        django_get_or_create = ("user", "organization")

    user = factory.SubFactory(UserFactory)
    organization = factory.SubFactory(OrganizationFactory)
    theme = "light"
    language = "en"
    timezone = "Asia/Kolkata"
    date_format = "YYYY-MM-DD"
    time_format = "HH:mm"


class UserRoleFactory(DjangoModelFactory):
    """Factory for UserRole model."""

    class Meta:
        model = UserRole
        django_get_or_create = ("user", "role", "organization")

    user = factory.SubFactory(UserFactory)
    role = factory.SubFactory(RoleFactory)
    organization = factory.SubFactory(OrganizationFactory)
    assigned_at = factory.Faker("date_this_year")
    expires_at = None


class WorkCalendarFactory(DjangoModelFactory):
    """Factory for WorkCalendar model."""

    class Meta:
        model = WorkCalendar
        django_get_or_create = ("name", "organization")

    organization = factory.SubFactory(OrganizationFactory)
    name = factory.Sequence(lambda n: f"Work Calendar {n}")
    description = factory.Faker("text", max_nb_chars=200)
    is_active = True


class WorkHoursFactory(DjangoModelFactory):
    """Factory for WorkHours model."""

    class Meta:
        model = WorkHours
        django_get_or_create = ("calendar", "day_of_week")

    calendar = factory.SubFactory(WorkCalendarFactory)
    day_of_week = FuzzyChoice(
        choices=[
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
            "SUNDAY",
        ]
    )
    is_working_day = True
    start_time = "09:00:00"
    end_time = "18:00:00"
    break_start_time = "12:00:00"
    break_end_time = "13:00:00"
    status = "active"
