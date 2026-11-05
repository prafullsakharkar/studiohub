"""CR-44: the user list reads every user's profile in a constant number of queries."""

from __future__ import annotations

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import ProfileFactory, UserFactory

pytestmark = pytest.mark.django_db

URL = "identity:user-list"


@pytest.fixture
def admin(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


def test_one_user_and_six_cost_the_same(admin):
    def queries() -> int:
        with CaptureQueriesContext(connection) as captured:
            assert admin.get(reverse(f"api:v1:{URL}")).status_code == 200
        return len(captured)

    UserFactory.create()
    one = queries()
    for _ in range(5):
        ProfileFactory.create()
    assert queries() == one


def test_names_are_unchanged(admin):
    named = UserFactory.create(email="named@example.com")
    ProfileFactory.create(user=named, first_name="Ada", last_name="Lovelace", display_name="Ada L.")
    UserFactory.create(email="bare@example.com")  # no profile

    body = admin.get(reverse(f"api:v1:{URL}")).json()
    rows = {row["email"]: row for row in (body["results"] if isinstance(body, dict) else body)}
    assert rows["named@example.com"]["full_name"] == "Ada Lovelace"
    assert rows["named@example.com"]["display_name"] == "Ada L."
    assert rows["bare@example.com"]["full_name"] == "bare@example.com"
