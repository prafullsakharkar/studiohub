"""
Authorization matrix for the automation endpoints (analysis finding F-C1, WP A1).

Rules and execution logs need an ``automation.*`` permission code AND a
membership of the rule's project. Out-of-scope rules answer 404 like unknown
ids. Rules without a project are platform-global: platform admins only.
"""

from __future__ import annotations

import uuid

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.choices.rbac import RolePriority
from apps.identity.services.permission_cache import PermissionCacheService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import AutomationRule, ProjectMembership, Workflow
from apps.production.services.automation import log_execution
from apps.production.tests.factories import ProjectFactory

RULES_URL = reverse("api:v1:production:automation-rules-list")
LOGS_URL = reverse("api:v1:production:automation-audit-logs")

ALL_CODES = ("automation.view", "automation.create", "automation.update", "automation.delete")

pytestmark = pytest.mark.django_db


def _detail(rule):
    return reverse("api:v1:production:automation-rules-detail", kwargs={"pk": str(rule.id)})


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _member(user, project):
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")


def _body(data):
    """Response body without the per-request ``error.request_id`` envelope."""
    return {key: value for key, value in data.items() if key != "error"}


def _payload(**overrides):
    data = {
        "name": "Rule",
        "trigger": {"event": "review.approved", "entity_type": "Review", "filters": {}},
        "conditions": [],
        "actions": [],
    }
    data.update(overrides)
    return data


@pytest.fixture
def project_a():
    return ProjectFactory.create(code="AUTHA")


@pytest.fixture
def project_b():
    return ProjectFactory.create(code="AUTHB")


@pytest.fixture
def rule_a(project_a):
    return AutomationRule.objects.create(project=project_a, name="Rule A")


@pytest.fixture
def rule_b(project_b):
    return AutomationRule.objects.create(project=project_b, name="Rule B")


@pytest.fixture
def global_rule():
    return AutomationRule.objects.create(project=None, name="Global rule")


@pytest.fixture
def editor(project_a):
    """Member of project A holding every automation code."""
    user = UserFactory.create()
    grant_permissions(user, *ALL_CODES)
    _member(user, project_a)
    return user


@pytest.fixture
def viewer(project_a):
    user = UserFactory.create()
    grant_permissions(user, "automation.view")
    _member(user, project_a)
    return user


@pytest.fixture
def platform_admin():
    user = UserFactory.create()
    role = grant_permissions(user, *ALL_CODES)
    role.priority = RolePriority.ADMIN
    role.save(update_fields=["priority"])
    PermissionCacheService.invalidate(user=user)
    return user


class TestPermissionCodes:
    def test_anonymous_is_401(self, rule_a):
        client = APIClient()
        assert client.get(RULES_URL).status_code == status.HTTP_401_UNAUTHORIZED
        assert client.get(LOGS_URL).status_code == status.HTTP_401_UNAUTHORIZED
        assert client.delete(_detail(rule_a)).status_code == status.HTTP_401_UNAUTHORIZED

    def test_member_without_codes_is_403_everywhere(self, project_a, rule_a):
        user = UserFactory.create()
        _member(user, project_a)
        client = _client(user)

        assert client.get(RULES_URL).status_code == status.HTTP_403_FORBIDDEN
        assert client.get(LOGS_URL).status_code == status.HTTP_403_FORBIDDEN
        assert client.get(_detail(rule_a)).status_code == status.HTTP_403_FORBIDDEN
        assert (
            client.post(
                RULES_URL, _payload(project_id=str(project_a.id)), format="json"
            ).status_code
            == 403
        )
        assert client.patch(_detail(rule_a), {"is_active": False}, format="json").status_code == 403
        assert client.delete(_detail(rule_a)).status_code == status.HTTP_403_FORBIDDEN
        rule_a.refresh_from_db()
        assert rule_a.is_active is True

    def test_view_code_does_not_allow_writes(self, viewer, project_a, rule_a):
        client = _client(viewer)

        assert client.get(RULES_URL).status_code == status.HTTP_200_OK
        assert (
            client.post(
                RULES_URL, _payload(project_id=str(project_a.id)), format="json"
            ).status_code
            == 403
        )
        assert client.patch(_detail(rule_a), {"is_active": False}, format="json").status_code == 403
        assert client.put(_detail(rule_a), _payload(), format="json").status_code == 403
        assert client.delete(_detail(rule_a)).status_code == status.HTTP_403_FORBIDDEN
        assert AutomationRule.objects.filter(id=rule_a.id, is_active=True).exists()


class TestProjectScope:
    def test_list_only_returns_member_project_rules(self, editor, rule_a, rule_b, global_rule):
        resp = _client(editor).get(RULES_URL)

        assert resp.status_code == status.HTTP_200_OK
        assert [row["id"] for row in resp.data] == [str(rule_a.id)]

    def test_cross_project_rule_is_404_for_every_method(self, editor, rule_b):
        client = _client(editor)

        assert client.get(_detail(rule_b)).status_code == status.HTTP_404_NOT_FOUND
        assert client.patch(_detail(rule_b), {"is_active": False}, format="json").status_code == 404
        assert (
            client.put(_detail(rule_b), _payload(name="Hijacked"), format="json").status_code == 404
        )
        assert client.delete(_detail(rule_b)).status_code == status.HTTP_404_NOT_FOUND
        rule_b.refresh_from_db()
        assert (rule_b.name, rule_b.is_active, rule_b.is_deleted) == ("Rule B", True, False)

    def test_foreign_rule_looks_like_unknown_rule(self, editor, rule_b):
        client = _client(editor)

        foreign = client.get(_detail(rule_b))
        unknown = client.get(
            reverse("api:v1:production:automation-rules-detail", kwargs={"pk": str(uuid.uuid4())})
        )
        assert foreign.status_code == unknown.status_code == status.HTTP_404_NOT_FOUND
        assert _body(foreign.data) == _body(unknown.data)

    def test_global_rule_is_hidden_from_members(self, editor, global_rule):
        client = _client(editor)

        assert client.get(RULES_URL).data == []
        assert client.get(_detail(global_rule)).status_code == status.HTTP_404_NOT_FOUND
        assert client.delete(_detail(global_rule)).status_code == status.HTTP_404_NOT_FOUND

    def test_member_updates_and_deletes_own_project_rule(self, editor, rule_a):
        client = _client(editor)

        patched = client.patch(_detail(rule_a), {"is_active": False}, format="json")
        assert patched.status_code == status.HTTP_200_OK
        rule_a.refresh_from_db()
        assert rule_a.is_active is False
        assert rule_a.updated_by_id == editor.id

        assert client.delete(_detail(rule_a)).status_code == status.HTTP_204_NO_CONTENT
        assert not AutomationRule.objects.filter(id=rule_a.id).exists()

    def test_membership_revocation_revokes_access(self, editor, project_a, rule_a):
        client = _client(editor)
        assert client.get(_detail(rule_a)).status_code == status.HTTP_200_OK

        ProjectMembership.objects.filter(user=editor, project=project_a).delete()

        assert client.get(_detail(rule_a)).status_code == status.HTTP_404_NOT_FOUND


class TestCreate:
    def test_create_in_member_project_sets_creator(self, editor, project_a):
        resp = _client(editor).post(
            RULES_URL, _payload(project_id=str(project_a.id)), format="json"
        )

        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        rule = AutomationRule.objects.get(id=resp.data["id"])
        assert rule.project_id == project_a.id
        assert rule.created_by_id == editor.id

    def test_create_in_foreign_project_is_rejected_like_unknown(self, editor, project_b):
        client = _client(editor)

        foreign = client.post(RULES_URL, _payload(project_id=str(project_b.id)), format="json")
        unknown = client.post(RULES_URL, _payload(project_id=str(uuid.uuid4())), format="json")

        assert foreign.status_code == unknown.status_code == status.HTTP_400_BAD_REQUEST
        assert _body(foreign.data) == _body(unknown.data)
        assert not AutomationRule.objects.filter(project=project_b).exists()

    def test_member_cannot_create_global_rule(self, editor):
        resp = _client(editor).post(RULES_URL, _payload(), format="json")

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "project_id" in resp.data
        assert not AutomationRule.objects.exists()

    def test_workflow_of_another_project_is_rejected(self, editor, project_a, project_b):
        workflow_b = Workflow.objects.create(name="B flow", code="BFLOW", project=project_b)

        resp = _client(editor).post(
            RULES_URL,
            _payload(project_id=str(project_a.id), workflow_id=str(workflow_b.id)),
            format="json",
        )

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "workflow_id" in resp.data
        assert not AutomationRule.objects.exists()

    def test_workflow_of_another_project_cannot_be_linked_on_update(
        self, editor, rule_a, project_b
    ):
        workflow_b = Workflow.objects.create(name="B flow", code="BFLOW", project=project_b)
        client = _client(editor)

        patch = client.patch(_detail(rule_a), {"workflow_id": str(workflow_b.id)}, format="json")
        put = client.put(_detail(rule_a), _payload(workflow_id=str(workflow_b.id)), format="json")

        assert patch.status_code == put.status_code == status.HTTP_400_BAD_REQUEST
        rule_a.refresh_from_db()
        assert rule_a.workflow_id is None

    def test_workflow_alone_sets_the_project(self, editor, project_a):
        workflow = Workflow.objects.create(name="A flow", code="AFLOW", project=project_a)

        resp = _client(editor).post(
            RULES_URL, _payload(workflow_id=str(workflow.id)), format="json"
        )

        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        assert AutomationRule.objects.get(id=resp.data["id"]).project_id == project_a.id


class TestPlatformAdmin:
    def test_sees_and_manages_every_rule(self, platform_admin, rule_a, rule_b, global_rule):
        client = _client(platform_admin)

        listed = {row["id"] for row in client.get(RULES_URL).data}
        assert listed == {str(rule_a.id), str(rule_b.id), str(global_rule.id)}
        assert client.patch(_detail(rule_b), {"is_active": False}, format="json").status_code == 200
        assert client.delete(_detail(global_rule)).status_code == status.HTTP_204_NO_CONTENT

    def test_creates_global_rule(self, platform_admin):
        resp = _client(platform_admin).post(RULES_URL, _payload(), format="json")

        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        assert AutomationRule.objects.get(id=resp.data["id"]).project_id is None


class TestAuditLogs:
    def test_logs_are_scoped_to_member_projects(self, viewer, rule_a, rule_b, global_rule):
        for rule in (rule_a, rule_b, global_rule):
            log_execution(rule=rule, entity_type="Review", status="success")

        resp = _client(viewer).get(LOGS_URL)

        assert resp.status_code == status.HTTP_200_OK
        assert [row["rule_id"] for row in resp.data] == [str(rule_a.id)]

    def test_platform_admin_sees_all_logs(self, platform_admin, rule_a, rule_b, global_rule):
        for rule in (rule_a, rule_b, global_rule):
            log_execution(rule=rule, entity_type="Review", status="success")

        assert len(_client(platform_admin).get(LOGS_URL).data) == 3
