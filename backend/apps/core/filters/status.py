import django_filters

from apps.core.choices.lifecycle import (
    LifecycleStatus,
)


class StatusFilterMixin:

    status = django_filters.ChoiceFilter(choices=LifecycleStatus.choices)
