import django_filters

from apps.core.choices.lifecycle import (
    LifecycleStatus,
)


class StatusFilterMixin(django_filters.FilterSet):
    """
    Generic status filtering based on ``LifecycleStatus``.

    Subclassing ``FilterSet`` (with an abstract ``Meta``) makes the declared
    ``status`` filter visible to django-filter's metaclass, which only
    inspects class attributes and bases that are themselves FilterSets.
    """

    status = django_filters.ChoiceFilter(choices=LifecycleStatus.choices)

    class Meta:
        abstract = True
