from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.identity.models.user_preference import UserPreference


class UserPreferenceFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for UserPreference.
    """

    user = CharFilter(
        field_name="user__uuid",
    )

    language = CharFilter(
        field_name="language",
    )

    timezone = CharFilter(
        field_name="timezone",
    )

    theme = CharFilter(
        field_name="theme",
    )

    default_organization = CharFilter(
        field_name="default_organization__uuid",
    )

    email_notifications = BooleanFilter()

    desktop_notifications = BooleanFilter()

    push_notifications = BooleanFilter()

    class Meta:
        model = UserPreference

        fields = (
            "user",
            "language",
            "timezone",
            "theme",
            "default_organization",
            "email_notifications",
            "desktop_notifications",
            "push_notifications",
        )
