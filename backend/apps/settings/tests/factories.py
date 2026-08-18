# tests/factories.py
"""
Factory Boy factories for Settings application tests.
"""

from __future__ import annotations

import factory
from factory.django import DjangoModelFactory

from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import OrganizationFactory
from apps.settings.models.category import SettingCategory
from apps.settings.models.definition import SettingDefinition
from apps.settings.models.feature_flag import FeatureFlag
from apps.settings.models.localization import Localization
from apps.settings.models.organization import OrganizationSetting
from apps.settings.models.system import SystemSetting
from apps.settings.models.theme import Theme


class ThemeFactory(DjangoModelFactory):
    """Factory for Theme model."""

    class Meta:
        model = Theme

    code = factory.Sequence(lambda n: f"theme{n:03d}")
    name = factory.Sequence(lambda n: f"Theme {n}")
    description = factory.Faker("text", max_nb_chars=500)
    theme_type = factory.Faker("random_element", elements=["light", "dark", "custom"])
    organization = factory.SubFactory(OrganizationFactory)
    primary_color = factory.Faker("hex_color")
    secondary_color = factory.Faker("hex_color")
    accent_color = factory.Faker("hex_color")
    background_color = factory.Faker("hex_color")
    text_primary = factory.Faker("hex_color")
    text_secondary = factory.Faker("hex_color")
    font_family = factory.Faker("random_element", elements=["sans", "serif", "mono"])
    is_active = True


class CategoryFactory(DjangoModelFactory):
    """Factory for SettingCategory model."""

    class Meta:
        model = SettingCategory

    code = factory.Sequence(
        lambda n: SettingCategory.CATEGORY_CHOICES[
            n % len(SettingCategory.CATEGORY_CHOICES)
        ][0]
    )
    name = factory.Sequence(lambda n: f"Category {n}")
    description = factory.Faker("text", max_nb_chars=500)
    icon = factory.Faker("word")
    order = factory.Sequence(lambda n: n)
    is_active = True


class DefinitionFactory(DjangoModelFactory):
    """Factory for SettingDefinition model."""

    class Meta:
        model = SettingDefinition

    code = factory.Sequence(lambda n: f"setting{n:03d}")
    name = factory.Sequence(lambda n: f"Setting {n}")
    description = factory.Faker("text", max_nb_chars=500)
    data_type = factory.Faker(
        "random_element", elements=[t[0] for t in SettingDefinition.TYPE_CHOICES]
    )
    scope = factory.Faker(
        "random_element", elements=[s[0] for s in SettingDefinition.SCOPE_CHOICES]
    )
    category = factory.SubFactory(CategoryFactory)
    default_value = factory.Faker("text", max_nb_chars=500)
    is_required = False
    is_active = True


class FeatureFlagFactory(DjangoModelFactory):
    """Factory for FeatureFlag model."""

    class Meta:
        model = FeatureFlag

    code = factory.Sequence(lambda n: f"feature{n:03d}")
    name = factory.Sequence(lambda n: f"Feature {n}")
    description = factory.Faker("text", max_nb_chars=500)
    feature_type = factory.Faker(
        "random_element", elements=["boolean", "percentage", "scheduled", "rollout"]
    )
    status = factory.Faker(
        "random_element", elements=["enabled", "disabled", "scheduled", "expired"]
    )
    is_enabled = factory.Faker("boolean")
    percentage = factory.Faker("random_int", min=0, max=100)
    start_date = factory.Faker("date_time_this_year")
    end_date = factory.Faker("date_time_this_year")
    organization = factory.SubFactory(OrganizationFactory)


class LocalizationFactory(DjangoModelFactory):
    """Factory for Localization model."""

    class Meta:
        model = Localization

    code = factory.Sequence(lambda n: f"localization{n:03d}")
    name = factory.Sequence(lambda n: f"Localization {n}")
    language = factory.Faker(
        "random_element", elements=[l[0] for l in Localization.LANGUAGE_CHOICES]
    )
    timezone = factory.Faker(
        "random_element", elements=[t[0] for t in Localization.TIMEZONE_CHOICES]
    )
    date_format = factory.Faker(
        "random_element", elements=[d[0] for d in Localization.DATE_FORMAT_CHOICES]
    )
    time_format = factory.Faker(
        "random_element", elements=[t[0] for t in Localization.TIME_FORMAT_CHOICES]
    )
    number_format = factory.Faker(
        "random_element", elements=[n[0] for n in Localization.NUMBER_FORMAT_CHOICES]
    )
    currency_code = factory.Faker("currency_code")
    organization = factory.SubFactory(OrganizationFactory)
    is_active = True


class OrganizationSettingFactory(DjangoModelFactory):
    """Factory for OrganizationSetting model."""

    class Meta:
        model = OrganizationSetting

    setting = factory.SubFactory(DefinitionFactory)
    organization = factory.SubFactory(OrganizationFactory)
    value = factory.Faker("text", max_nb_chars=500)
    is_locked = False


class SystemSettingFactory(DjangoModelFactory):
    """Factory for SystemSetting model."""

    class Meta:
        model = SystemSetting

    setting = factory.SubFactory(DefinitionFactory)
    value = factory.Faker("text", max_nb_chars=500)
    is_locked = False
