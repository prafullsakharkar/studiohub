"""Who may read which audit rows (TPN review TM-012)."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from rest_framework.test import APIClient

from apps.audit.selectors.activity import ActivitySelector
from apps.audit.selectors.api_request import APIRequestSelector
from apps.audit.selectors.audit_log import AuditLogSelector
from apps.audit.selectors.background_job import BackgroundJobSelector
from apps.audit.selectors.change_log import ChangeLogSelector
from apps.audit.selectors.error_log import ErrorLogSelector
from apps.audit.selectors.track import TrackSelector
from apps.audit.tests.factories import (
    ActivityFactory,
    APIRequestFactory,
    AuditLogFactory,
    BackgroundJobFactory,
    ChangeLogFactory,
    ErrorLogFactory,
    TrackFactory,
)
from apps.core import providers
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db


def _request(user):
    return SimpleNamespace(user=user)


def _member(project, **extra):
    user = UserFactory.create()
    ProjectMembership.objects.create(
        user=user, project=project, status="active", role="Artist", **extra
    )
    return user


@pytest.fixture
def world():
    project_a, project_b = ProjectFactory.create(), ProjectFactory.create()
    return SimpleNamespace(
        a=project_a,
        b=project_b,
        member_a=_member(project_a),
        admin=UserFactory.create(is_superuser=True),
    )


def _descriptions(queryset):
    return sorted(queryset.values_list("description", flat=True))


class TestProjectScopedTables:
    @pytest.mark.parametrize(
        ("selector", "factory"),
        [
            (AuditLogSelector, AuditLogFactory),
            (ActivitySelector, ActivityFactory),
        ],
    )
    def test_a_member_sees_only_the_rows_of_their_projects(self, world, selector, factory):
        factory(description="a", project_id=world.a.pk)
        factory(description="b", project_id=world.b.pk)
        factory(description="none", project_id=None)

        rows = selector.get_queryset(request=_request(world.member_a))

        assert _descriptions(rows) == ["a"]

    def test_the_change_log_is_scoped_the_same_way(self, world):
        # Creating the projects and memberships above is itself change-tracked, per project.
        mine = ChangeLogFactory(project_id=world.a.pk)
        theirs = ChangeLogFactory(project_id=world.b.pk)
        unscoped = ChangeLogFactory(project_id=None)

        rows = ChangeLogSelector.get_queryset(request=_request(world.member_a))

        pks = set(rows.values_list("pk", flat=True))
        assert mine.pk in pks
        assert theirs.pk not in pks
        assert unscoped.pk not in pks
        assert set(rows.values_list("project_id", flat=True)) == {world.a.pk}

    def test_a_platform_admin_sees_every_row_including_those_without_a_project(self, world):
        AuditLogFactory(description="a", project_id=world.a.pk)
        AuditLogFactory(description="b", project_id=world.b.pk)
        AuditLogFactory(description="none", project_id=None)

        rows = AuditLogSelector.get_queryset(request=_request(world.admin))

        assert _descriptions(rows) == ["a", "b", "none"]

    def test_a_signed_in_user_with_no_project_sees_nothing(self, world):
        AuditLogFactory(project_id=world.a.pk)

        rows = AuditLogSelector.get_queryset(request=_request(UserFactory.create()))

        assert rows.count() == 0

    def test_an_external_member_sees_no_audit_rows_of_the_project(self, world):
        AuditLogFactory(project_id=world.a.pk)
        vendor = _member(world.a, vendor_id="vendor-1")

        rows = AuditLogSelector.get_queryset(request=_request(vendor))

        assert rows.count() == 0

    def test_an_ended_membership_no_longer_shows_the_project(self, world):
        AuditLogFactory(project_id=world.a.pk)
        ProjectMembership.objects.filter(user=world.member_a).update(status="inactive")

        rows = AuditLogSelector.get_queryset(request=_request(world.member_a))

        assert rows.count() == 0

    def test_an_anonymous_caller_sees_nothing(self, world):
        AuditLogFactory(project_id=world.a.pk)
        anonymous = SimpleNamespace(user=SimpleNamespace(is_authenticated=False))

        assert AuditLogSelector.get_queryset(request=anonymous).count() == 0

    def test_internal_callers_without_a_request_are_not_narrowed(self, world):
        AuditLogFactory(project_id=world.b.pk)

        assert AuditLogSelector.get_queryset().count() == 1


class TestOwnRowTables:
    def test_telemetry_and_tracking_show_the_callers_own_rows_only(self, world):
        mine = APIRequestFactory(user=world.member_a)
        APIRequestFactory(user=UserFactory.create())
        my_track = TrackFactory(user=world.member_a)
        TrackFactory(user=UserFactory.create())

        requests = APIRequestSelector.get_queryset(request=_request(world.member_a))
        tracks = TrackSelector.get_queryset(request=_request(world.member_a))

        assert list(requests.values_list("pk", flat=True)) == [mine.pk]
        assert list(tracks.values_list("pk", flat=True)) == [my_track.pk]

    def test_a_platform_admin_sees_all_of_them(self, world):
        APIRequestFactory(user=world.member_a)
        APIRequestFactory(user=UserFactory.create())

        assert APIRequestSelector.get_queryset(request=_request(world.admin)).count() == 2


class TestAdminOnlyTables:
    def test_errors_and_jobs_are_for_platform_admins_only(self, world):
        ErrorLogFactory()
        BackgroundJobFactory()

        for selector in (ErrorLogSelector, BackgroundJobSelector):
            assert selector.get_queryset(request=_request(world.member_a)).count() == 0
            assert selector.get_queryset(request=_request(world.admin)).count() == 1


class TestWithoutProduction:
    @pytest.fixture(autouse=True)
    def _no_provider(self):
        from apps.production.providers import AUDIT_SCOPE, AuditScope

        providers.unregister(AUDIT_SCOPE)
        yield
        providers.register(AUDIT_SCOPE, AuditScope())

    def test_only_a_superuser_is_not_narrowed(self, world):
        AuditLogFactory(project_id=world.a.pk)

        assert AuditLogSelector.get_queryset(request=_request(world.admin)).count() == 1
        assert AuditLogSelector.get_queryset(request=_request(world.member_a)).count() == 0


class TestOverTheApi:
    def test_a_member_with_audit_view_reads_only_their_projects(self, world):
        AuditLogFactory(description="mine", project_id=world.a.pk)
        AuditLogFactory(description="theirs", project_id=world.b.pk)
        AuditLogFactory(description="platform", project_id=None)
        grant_permissions(world.member_a, "audit.view")
        client = APIClient()
        client.force_authenticate(user=world.member_a)

        response = client.get("/api/v1/audit/audit-logs/")

        assert response.status_code == 200, response.content[:300]
        payload = response.json()
        rows = payload["results"] if isinstance(payload, dict) else payload
        assert [row["description"] for row in rows] == ["mine"]

    def test_another_projects_row_is_a_404(self, world):
        other = AuditLogFactory(project_id=world.b.pk)
        grant_permissions(world.member_a, "audit.view")
        client = APIClient()
        client.force_authenticate(user=world.member_a)

        response = client.get(f"/api/v1/audit/audit-logs/{other.uuid}/")

        assert response.status_code == 404


class TestProjectIdHelpers:
    def test_as_project_id_parses_uuids_and_ignores_the_rest(self):
        from apps.audit.utils.project import as_project_id

        value = uuid.uuid4()
        assert as_project_id(value) == value
        assert as_project_id(str(value)) == value
        assert as_project_id("not-a-uuid") is None
        assert as_project_id(None) is None
        assert as_project_id("") is None

    def test_project_id_of_uses_the_pk_of_a_project_and_the_field_elsewhere(self, world):
        from apps.audit.utils.project import project_id_of

        assert project_id_of(world.a) == world.a.pk
        assert project_id_of(SimpleNamespace(project_id=world.b.pk)) == world.b.pk
        assert project_id_of(SimpleNamespace()) is None

    def test_the_scheduling_writer_takes_the_project_from_metadata(self, world):
        from apps.audit.models import AuditLog
        from apps.scheduling.services import audit as scheduling_audit

        scheduling_audit.record(
            actor=world.admin,
            action="create",
            target_id=uuid.uuid4(),
            target_name="x",
            description="d",
            metadata={"project_id": str(world.a.pk)},
        )

        assert AuditLog.objects.get(target_type=AuditLog.TARGET_SCHEDULING).project_id == world.a.pk
