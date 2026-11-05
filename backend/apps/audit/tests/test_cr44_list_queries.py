"""CR-44: the audit lists read each row's user (and their profile) in a constant number of queries."""

from __future__ import annotations

import importlib

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import ProfileFactory, UserFactory

pytestmark = pytest.mark.django_db

F = "apps.audit.tests.factories"
# route, factory, the field that holds the user, the response keys that name them
CASES = [
    ("audit:activity-list", "ActivityFactory", "user", "user_email", "user_name"),
    ("audit:audit-log-list", "AuditLogFactory", "actor", "actor_email", "actor_name"),
    ("audit:change-log-list", "ChangeLogFactory", "user", "user_email", "user_name"),
    ("audit:error-log-list", "ErrorLogFactory", "user", "user_email", "user_name"),
    ("audit:track-list", "TrackFactory", "user", "user_email", "user_name"),
    ("audit:api-request-list", "APIRequestFactory", "user", "user_email", "user_name"),
]
IDS = [case[0] for case in CASES]


@pytest.fixture
def admin(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


def rows_of(response):
    body = response.json()
    return body["results"] if isinstance(body, dict) else body


@pytest.mark.parametrize(("route", "factory", "field", "email_key", "name_key"), CASES, ids=IDS)
class TestAuditLists:
    def test_one_row_and_six_cost_the_same(self, admin, route, factory, field, email_key, name_key):
        make = getattr(importlib.import_module(F), factory)
        url = reverse(f"api:v1:{route}")
        make.create()

        def queries() -> int:
            with CaptureQueriesContext(connection) as captured:
                assert admin.get(url).status_code == 200
            return len(captured)

        one = queries()
        for _ in range(5):
            make.create()
        assert queries() == one

    def test_names_are_unchanged(self, admin, route, factory, field, email_key, name_key):
        make = getattr(importlib.import_module(F), factory)
        named = UserFactory.create(email="named@example.com")
        ProfileFactory.create(user=named, first_name="Ada", last_name="Lovelace")
        bare = UserFactory.create(email="bare@example.com")  # no profile: shown by e-mail
        make.create(**{field: named})
        make.create(**{field: bare})

        rows = {
            str(row[field]): row
            for row in rows_of(admin.get(reverse(f"api:v1:{route}")))
            if row.get(field)
        }
        assert rows[str(named.pk)][email_key] == "named@example.com"
        assert rows[str(named.pk)][name_key] == "Ada Lovelace"
        assert rows[str(bare.pk)][email_key] == "bare@example.com"
        assert rows[str(bare.pk)][name_key] == "bare@example.com"
