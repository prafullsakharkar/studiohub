"""Q-22: exactly one theme and one localization is the default (the one the app uses)."""

from __future__ import annotations

import importlib

import pytest
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from apps.settings.models.localization import Localization
from apps.settings.models.theme import Theme
from apps.settings.tests.factories import LocalizationFactory, ThemeFactory

pytestmark = pytest.mark.django_db

S = "/api/v1/settings/"
KINDS = [
    pytest.param("themes", Theme, ThemeFactory, {"code": "mine", "name": "Mine"}, id="theme"),
    pytest.param(
        "localizations",
        Localization,
        LocalizationFactory,
        {"code": "mine", "name": "Mine", "language": "en"},
        id="localization",
    ),
]


def defaults(model):
    return list(model.objects.filter(is_default=True).values_list("pk", flat=True))


@pytest.mark.parametrize(("path", "model", "factory", "body"), KINDS)
class TestOneDefault:
    def test_the_first_active_one_made_through_the_api_becomes_the_default_and_later_ones_do_not(
        self, admin_client, path, model, factory, body
    ):
        first = admin_client.post(f"{S}{path}/", body, format="json")
        assert first.status_code == 201, first.content
        assert first.json()["is_default"] is True
        second = admin_client.post(
            f"{S}{path}/", {**body, "code": "other", "name": "Other"}, format="json"
        )
        assert second.json()["is_default"] is False
        assert defaults(model) == [model.objects.get(code="mine").pk]

    def test_an_inactive_first_one_is_not_the_default(
        self, admin_client, path, model, factory, body
    ):
        row = admin_client.post(f"{S}{path}/", {**body, "is_active": False}, format="json")
        assert row.json()["is_default"] is False
        assert defaults(model) == []

    def test_is_default_cannot_be_written(self, admin_client, path, model, factory, body):
        taken = factory(is_active=True, is_default=True)
        other = factory(is_active=True)
        assert (
            admin_client.patch(
                f"{S}{path}/{other.id}/", {"is_default": True}, format="json"
            ).status_code
            == 200
        )
        created = admin_client.post(f"{S}{path}/", {**body, "is_default": True}, format="json")
        assert created.json()["is_default"] is False
        assert defaults(model) == [taken.pk]

    def test_set_default_moves_it_and_leaves_exactly_one(
        self, admin_client, path, model, factory, body
    ):
        old = factory(is_active=True, is_default=True)
        new = factory(is_active=True)
        response = admin_client.post(f"{S}{path}/{new.id}/set-default/")
        assert response.status_code == 200 and response.json() == {"status": "default"}
        assert defaults(model) == [new.pk]
        old.refresh_from_db()
        assert old.is_default is False and old.is_active is True  # still available

    def test_set_default_is_idempotent(self, admin_client, path, model, factory, body):
        row = factory(is_active=True, is_default=True)
        assert admin_client.post(f"{S}{path}/{row.id}/set-default/").status_code == 200
        assert defaults(model) == [row.pk]

    def test_an_inactive_one_cannot_be_made_the_default(
        self, admin_client, path, model, factory, body
    ):
        keep = factory(is_active=True, is_default=True)
        idle = factory(is_active=False)
        assert admin_client.post(f"{S}{path}/{idle.id}/set-default/").status_code == 400
        assert defaults(model) == [keep.pk]

    def test_the_default_cannot_be_deactivated_or_deleted_until_another_is_made_the_default(
        self, admin_client, path, model, factory, body
    ):
        row = factory(is_active=True, is_default=True)
        for refused in (
            admin_client.post(f"{S}{path}/{row.id}/deactivate/"),
            admin_client.patch(f"{S}{path}/{row.id}/", {"is_active": False}, format="json"),
            admin_client.delete(f"{S}{path}/{row.id}/"),
        ):
            assert refused.status_code == 400, refused.content
        row.refresh_from_db()
        assert row.is_active is True and row.is_default is True and not row.is_deleted
        other = factory(is_active=True)
        admin_client.post(f"{S}{path}/{other.id}/set-default/")
        assert admin_client.post(f"{S}{path}/{row.id}/deactivate/").status_code == 200
        assert admin_client.delete(f"{S}{path}/{row.id}/").status_code == 204

    def test_an_ordinary_row_can_still_be_deactivated_and_deleted(
        self, admin_client, path, model, factory, body
    ):
        factory(is_active=True, is_default=True)
        spare = factory(is_active=True)
        assert admin_client.post(f"{S}{path}/{spare.id}/deactivate/").status_code == 200
        assert admin_client.delete(f"{S}{path}/{spare.id}/").status_code == 204

    def test_the_database_allows_one_default(self, path, model, factory, body):
        factory(is_active=True, is_default=True)
        with pytest.raises(IntegrityError), transaction.atomic():
            factory(is_active=True, is_default=True)

    def test_the_list_filters_on_is_default(self, staff_client, path, model, factory, body):
        keep = factory(is_active=True, is_default=True)
        factory(is_active=True)
        rows = staff_client.get(f"{S}{path}/", {"is_default": "true"}).json()
        rows = rows["results"] if isinstance(rows, dict) else rows
        assert [row["id"] for row in rows] == [str(keep.id)]

    def test_only_a_manager_sets_the_default(
        self, authenticated_client, path, model, factory, body
    ):
        row = factory(is_active=True)
        assert authenticated_client.post(f"{S}{path}/{row.id}/set-default/").status_code == 403
        assert defaults(model) == []


@pytest.mark.parametrize(("path", "model", "factory", "body"), KINDS)
class TestReadingTheDefault:
    def test_anyone_signed_in_reads_it(self, authenticated_client, path, model, factory, body):
        row = factory(is_active=True, is_default=True)
        factory(is_active=True)
        response = authenticated_client.get(f"{S}{path}/default/")
        assert response.status_code == 200
        assert response.json()["id"] == str(row.id) and response.json()["is_default"] is True

    def test_it_is_a_404_when_none_was_made(self, authenticated_client, path, model, factory, body):
        factory(is_active=True)
        assert authenticated_client.get(f"{S}{path}/default/").status_code == 404

    def test_a_signed_out_caller_is_refused(self, path, model, factory, body):
        assert APIClient().get(f"{S}{path}/default/").status_code in (401, 403)

    def test_the_rest_of_the_list_stays_a_manager_s(
        self, authenticated_client, path, model, factory, body
    ):
        assert authenticated_client.get(f"{S}{path}/").status_code == 403


class TestTheMigrationChoosesOne:
    def test_the_earliest_active_row_of_each_kind_becomes_the_default_when_none_is(self):
        migration = importlib.import_module(
            "apps.settings.migrations.0002_theme_localization_default"
        )
        from django.apps import apps

        old, newer = ThemeFactory(is_active=True), ThemeFactory(is_active=True)
        ThemeFactory(is_active=False)
        LocalizationFactory(is_active=False)  # nothing active: nothing chosen
        Theme.objects.filter(pk=old.pk).update(created_at="2020-01-01T00:00:00Z")
        migration.choose_the_default(apps, None)
        assert defaults(Theme) == [old.pk] and newer.pk not in defaults(Theme)
        assert defaults(Localization) == []

    def test_a_default_that_exists_is_left_alone(self):
        migration = importlib.import_module(
            "apps.settings.migrations.0002_theme_localization_default"
        )
        from django.apps import apps

        older = ThemeFactory(is_active=True)
        keep = ThemeFactory(is_active=True, is_default=True)
        Theme.objects.filter(pk=older.pk).update(created_at="2020-01-01T00:00:00Z")
        migration.choose_the_default(apps, None)
        assert defaults(Theme) == [keep.pk]  # not the older row


class TestTwoRequestsRacing:
    def test_when_another_request_took_the_place_first_the_new_row_stays_an_ordinary_one(self):
        from unittest import mock

        from apps.settings.services.default_selection import adopt_if_first

        taken = ThemeFactory(is_active=True, is_default=True)
        late = ThemeFactory(is_active=True)
        # The check that "there is none yet" was made a moment before the other request committed.
        with mock.patch.object(
            Theme.objects, "filter", return_value=mock.Mock(exists=lambda: False)
        ):
            result = adopt_if_first(Theme, late)
        assert result.is_default is False
        assert defaults(Theme) == [taken.pk]
