"""CR-44: the setting definition and system setting lists read each row's category / definition in a constant number of queries."""

from __future__ import annotations

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from apps.settings.tests.factories import CategoryFactory, DefinitionFactory, SystemSettingFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


def queries(client, route: str) -> int:
    with CaptureQueriesContext(connection) as captured:
        assert client.get(reverse(f"api:v1:{route}")).status_code == 200
    return len(captured)


def rows_of(response):
    body = response.json()
    return body["results"] if isinstance(body, dict) else body


class TestDefinitions:
    def test_one_row_and_six_cost_the_same(self, admin):
        DefinitionFactory.create()
        one = queries(admin, "settings:setting-definition-list")
        for _ in range(5):
            DefinitionFactory.create()
        assert queries(admin, "settings:setting-definition-list") == one

    def test_category_names_are_unchanged(self, admin):
        category = CategoryFactory.create(name="Display", code="display-cr44")
        definition = DefinitionFactory.create(category=category)
        row = next(
            r
            for r in rows_of(admin.get(reverse("api:v1:settings:setting-definition-list")))
            if r["id"] == str(definition.pk)
        )
        assert row["category_name"] == "Display"
        assert row["category_code"] == "display-cr44"


class TestSystemSettings:
    def test_one_row_and_six_cost_the_same(self, admin):
        SystemSettingFactory.create()
        one = queries(admin, "settings:system-setting-list")
        for _ in range(5):
            SystemSettingFactory.create()
        assert queries(admin, "settings:system-setting-list") == one

    def test_setting_names_are_unchanged(self, admin):
        definition = DefinitionFactory.create(name="Studio name", code="studio-name-cr44")
        stored = SystemSettingFactory.create(setting=definition)
        row = next(
            r
            for r in rows_of(admin.get(reverse("api:v1:settings:system-setting-list")))
            if r["id"] == str(stored.pk)
        )
        assert row["setting_name"] == "Studio name"
        assert row["setting_code"] == "studio-name-cr44"
