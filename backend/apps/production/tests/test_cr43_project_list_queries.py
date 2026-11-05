"""CR-43: the project list reads every supervisor's and coordinator's profile in a constant number of queries."""

from __future__ import annotations

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.identity.tests.factories import ProfileFactory, UserFactory
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

PROJECTS = "/api/v1/projects/"


@pytest.fixture
def admin(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


def make_projects(count: int) -> None:
    for _ in range(count):
        ProjectFactory.create(supervisor=UserFactory.create(), coordinator=UserFactory.create())


def list_queries(client) -> int:
    with CaptureQueriesContext(connection) as queries:
        response = client.get(PROJECTS)
    assert response.status_code == 200
    return len(queries)


class TestQueryCount:
    def test_one_project_and_six_cost_the_same(self, admin):
        make_projects(1)
        one = list_queries(admin)
        make_projects(5)
        assert list_queries(admin) == one

    def test_no_query_is_made_per_profile(self, admin):
        make_projects(4)
        with CaptureQueriesContext(connection) as queries:
            admin.get(PROJECTS)
        # The profiles come with the projects (one join), not one query per person.
        own = [q for q in queries.captured_queries if 'FROM "identity_profiles"' in q["sql"]]
        assert own == []


class TestNamesAreUnchanged:
    def test_display_name_then_email_then_empty(self, admin):
        named = UserFactory.create(email="named@example.com")
        ProfileFactory.create(user=named, display_name="Ada Lovelace")
        unnamed = UserFactory.create(email="unnamed@example.com")
        ProfileFactory.create(user=unnamed, display_name="")
        ProjectFactory.create(code="WITH", supervisor=named, coordinator=unnamed)
        ProjectFactory.create(code="NONE", supervisor=None, coordinator=None)

        rows = {row["code"]: row for row in admin.get(PROJECTS).json()["results"]}
        assert rows["WITH"]["supervisor_name"] == "Ada Lovelace"
        assert rows["WITH"]["coordinator_name"] == "unnamed@example.com"
        assert rows["NONE"]["supervisor_name"] == ""
        assert rows["NONE"]["coordinator_name"] == ""

    def test_a_user_without_a_profile_shows_the_email(self, admin):
        bare = UserFactory.create(email="bare@example.com")  # no signal makes a profile
        ProjectFactory.create(code="BARE", supervisor=bare, coordinator=bare)
        row = next(r for r in admin.get(PROJECTS).json()["results"] if r["code"] == "BARE")
        assert row["supervisor_name"] == "bare@example.com"
