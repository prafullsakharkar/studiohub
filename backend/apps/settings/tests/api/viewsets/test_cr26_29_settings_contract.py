"""CR-26 to CR-29: settings lists filter, select choices are objects, writes are validated, a flag is on by its status."""

from __future__ import annotations

import pytest

from apps.settings.models.feature_flag import FeatureFlag
from apps.settings.models.localization import Localization
from apps.settings.models.theme import Theme
from apps.settings.tests.factories import (
    CategoryFactory,
    DefinitionFactory,
    FeatureFlagFactory,
    LocalizationFactory,
    SystemSettingFactory,
    ThemeFactory,
)

pytestmark = pytest.mark.django_db

S = "/api/v1/settings/"


def ids(response):
    assert response.status_code == 200, response.content
    body = response.json()
    rows = body["results"] if isinstance(body, dict) else body
    return {row["id"] for row in rows}


class TestListsFilter:
    """CR-26: each list answers its filters (they used to answer every row)."""

    def test_categories(self, staff_client):
        live = CategoryFactory(is_active=True)
        archived = CategoryFactory(is_active=False)
        assert ids(staff_client.get(f"{S}categories/", {"is_active": "false"})) == {
            str(archived.id)
        }
        assert ids(staff_client.get(f"{S}categories/", {"is_active": "true"})) == {str(live.id)}

    def test_definitions(self, staff_client):
        one = DefinitionFactory(data_type="integer")
        DefinitionFactory(data_type="string")
        assert ids(staff_client.get(f"{S}definitions/", {"data_type": "integer"})) == {str(one.id)}
        assert ids(staff_client.get(f"{S}definitions/", {"category": str(one.category_id)})) == {
            str(one.id)
        }

    def test_system_settings(self, staff_client):
        one = SystemSettingFactory(value="1")
        SystemSettingFactory(value="2")
        assert ids(staff_client.get(f"{S}system-settings/", {"setting": str(one.setting_id)})) == {
            str(one.id)
        }

    def test_feature_flags(self, staff_client):
        on = FeatureFlagFactory(status="enabled")
        FeatureFlagFactory(status="disabled")
        assert ids(staff_client.get(f"{S}feature-flags/", {"status": "enabled"})) == {str(on.id)}

    def test_themes(self, staff_client):
        dark = ThemeFactory(theme_type="dark")
        ThemeFactory(theme_type="light")
        assert ids(staff_client.get(f"{S}themes/", {"theme_type": "dark"})) == {str(dark.id)}

    def test_localizations(self, staff_client):
        fr = LocalizationFactory(language="fr")
        LocalizationFactory(language="en")
        assert ids(staff_client.get(f"{S}localizations/", {"language": "fr"})) == {str(fr.id)}

    def test_an_unknown_value_does_not_become_a_500(self, staff_client):
        FeatureFlagFactory(status="enabled")
        assert staff_client.get(f"{S}feature-flags/", {"status": "banana"}).status_code in (
            200,
            400,
        )


class TestSelectChoices:
    """CR-27: a definition's choices are validated when it is saved, so a value never reaches a 500."""

    def body(self, category, **extra):
        return {
            "code": "pick-one",
            "name": "Pick one",
            "category": str(category.id),
            "data_type": "select",
            "scope": "system",
            **extra,
        }

    def test_plain_strings_are_a_400_naming_the_field(self, admin_client):
        category = CategoryFactory()
        response = admin_client.post(
            f"{S}definitions/", self.body(category, choices=["Deadline", "Tractor"]), format="json"
        )
        assert response.status_code == 400
        assert "choices" in response.json()

    def test_a_select_without_choices_is_a_400(self, admin_client):
        category = CategoryFactory()
        response = admin_client.post(f"{S}definitions/", self.body(category), format="json")
        assert response.status_code == 400
        assert "choices" in response.json()

    def test_a_choice_needs_a_label_and_values_are_unique(self, admin_client):
        category = CategoryFactory()
        no_label = [{"value": "a"}]
        twice = [{"value": "a", "label": "A"}, {"value": "a", "label": "Again"}]
        assert (
            admin_client.post(
                f"{S}definitions/", self.body(category, choices=no_label), format="json"
            ).status_code
            == 400
        )
        assert (
            admin_client.post(
                f"{S}definitions/", self.body(category, choices=twice), format="json"
            ).status_code
            == 400
        )

    def test_objects_are_accepted_and_a_value_checks_against_them(self, admin_client):
        category = CategoryFactory()
        choices = [
            {"value": "Deadline", "label": "Deadline"},
            {"value": "Tractor", "label": "Tractor"},
        ]
        created = admin_client.post(
            f"{S}definitions/", self.body(category, choices=choices), format="json"
        )
        assert created.status_code == 201, created.content
        definition_id = created.json()["id"]
        ok = admin_client.post(
            f"{S}system-settings/", {"setting": definition_id, "value": "Tractor"}, format="json"
        )
        assert ok.status_code == 201, ok.content
        bad = admin_client.post(
            f"{S}system-settings/", {"setting": definition_id, "value": "Banana"}, format="json"
        )
        assert bad.status_code == 400

    def test_another_type_may_have_no_choices(self, admin_client):
        category = CategoryFactory()
        body = self.body(category, data_type="string")
        assert admin_client.post(f"{S}definitions/", body, format="json").status_code == 201


class TestFeatureFlagRules:
    """CR-29: percentage and schedule are checked, and ``status`` is the one source of truth for "on"."""

    def body(self, **extra):
        return {"code": "new-flag", "name": "New flag", "feature_type": "boolean", **extra}

    def test_percentage_is_0_to_100(self, admin_client):
        for bad in (150, -1):
            response = admin_client.post(
                f"{S}feature-flags/",
                self.body(feature_type="percentage", percentage=bad),
                format="json",
            )
            assert response.status_code == 400, bad
            assert "percentage" in response.json()
        ok = admin_client.post(
            f"{S}feature-flags/",
            self.body(feature_type="percentage", percentage=100),
            format="json",
        )
        assert ok.status_code == 201

    def test_end_must_follow_start_on_save(self, admin_client):
        response = admin_client.post(
            f"{S}feature-flags/",
            self.body(start_date="2026-12-02T00:00:00Z", end_date="2026-12-01T00:00:00Z"),
            format="json",
        )
        assert response.status_code == 400
        assert "end_date" in response.json()

    def test_schedule_needs_both_dates_with_a_zone_and_end_after_start(self, admin_client):
        flag = FeatureFlagFactory(status="disabled", start_date=None, end_date=None)
        url = f"{S}feature-flags/{flag.id}/schedule/"
        assert admin_client.post(url, {}, format="json").status_code == 400
        only_start = admin_client.post(url, {"start_date": "2026-12-01T00:00:00Z"}, format="json")
        assert "end_date" in only_start.json()
        naive = admin_client.post(
            url,
            {"start_date": "2026-12-01T00:00:00", "end_date": "2026-12-02T00:00:00Z"},
            format="json",
        )
        assert naive.status_code == 400 and "start_date" in naive.json()
        junk = admin_client.post(
            url, {"start_date": "soon", "end_date": "2026-12-02T00:00:00Z"}, format="json"
        )
        assert junk.status_code == 400 and "start_date" in junk.json()
        reversed_ = admin_client.post(
            url,
            {"start_date": "2026-12-02T00:00:00Z", "end_date": "2026-12-01T00:00:00Z"},
            format="json",
        )
        assert reversed_.status_code == 400 and "end_date" in reversed_.json()
        flag.refresh_from_db()
        assert flag.status == "disabled"  # nothing was saved by the refusals
        ok = admin_client.post(
            url,
            {"start_date": "2026-12-01T00:00:00Z", "end_date": "2026-12-02T00:00:00Z"},
            format="json",
        )
        assert ok.status_code == 200
        flag.refresh_from_db()
        assert flag.status == "scheduled" and flag.start_date and flag.end_date

    def test_is_enabled_follows_status_and_cannot_be_written(self, admin_client):
        created = admin_client.post(f"{S}feature-flags/", self.body(is_enabled=True), format="json")
        assert created.status_code == 201
        assert created.json()["status"] == "disabled" and created.json()["is_enabled"] is False
        flag_id = created.json()["id"]
        assert admin_client.post(f"{S}feature-flags/{flag_id}/enable/").status_code == 200
        assert admin_client.get(f"{S}feature-flags/{flag_id}/").json()["is_enabled"] is True
        patched = admin_client.patch(
            f"{S}feature-flags/{flag_id}/",
            {"status": "disabled", "is_enabled": True},
            format="json",
        )
        assert patched.status_code == 200 and patched.json()["is_enabled"] is False
        made_on = admin_client.patch(
            f"{S}feature-flags/{flag_id}/", {"status": "enabled"}, format="json"
        )
        assert made_on.json()["is_enabled"] is True
        assert admin_client.post(f"{S}feature-flags/{flag_id}/disable/").status_code == 200
        assert FeatureFlag.objects.get(pk=flag_id).is_enabled is False

    def test_an_enabled_boolean_flag_is_on_for_a_user(self, user):
        flag = FeatureFlagFactory(feature_type="boolean", status="enabled", is_enabled=False)
        assert flag.is_enabled_for_user(user) is True
        flag.status = "disabled"
        assert flag.is_enabled_for_user(user) is False

    def test_a_scheduled_flag_without_a_start_is_off_not_an_error(self, user):
        flag = FeatureFlagFactory(
            feature_type="boolean", status="scheduled", start_date=None, end_date=None
        )
        assert flag.is_enabled_for_user(user) is False


class TestLocalizationAndThemeRules:
    def test_week_start_is_0_or_1(self, admin_client):
        row = LocalizationFactory(week_start=1)
        for bad in (9, 2, -1):
            response = admin_client.patch(
                f"{S}localizations/{row.id}/", {"week_start": bad}, format="json"
            )
            assert response.status_code == 400, bad
            assert "week_start" in response.json()
        assert (
            admin_client.patch(
                f"{S}localizations/{row.id}/", {"week_start": 0}, format="json"
            ).status_code
            == 200
        )
        assert Localization.objects.get(pk=row.pk).week_start == 0

    def test_colours_are_hex(self, admin_client):
        theme = ThemeFactory(primary_color="#3B82F6")
        response = admin_client.patch(
            f"{S}themes/{theme.id}/",
            {"primary_color": "red", "accent_color": "#GGGGGG"},
            format="json",
        )
        assert response.status_code == 400
        assert {"primary_color", "accent_color"} <= set(response.json())
        assert (
            admin_client.patch(
                f"{S}themes/{theme.id}/", {"primary_color": "#112233"}, format="json"
            ).status_code
            == 200
        )
        assert Theme.objects.get(pk=theme.pk).primary_color == "#112233"

    def test_the_last_active_theme_cannot_be_deleted(self, admin_client):
        only = ThemeFactory(is_active=True)
        ThemeFactory(is_active=False)
        response = admin_client.delete(f"{S}themes/{only.id}/")
        assert response.status_code == 400
        assert Theme.objects.filter(pk=only.pk).exists()
        other = ThemeFactory(is_active=True)
        assert admin_client.delete(f"{S}themes/{only.id}/").status_code == 204
        assert Theme.objects.filter(pk=other.pk).exists()

    def test_an_inactive_theme_can_always_be_deleted(self, admin_client):
        ThemeFactory(is_active=True)
        spare = ThemeFactory(is_active=False)
        assert admin_client.delete(f"{S}themes/{spare.id}/").status_code == 204
