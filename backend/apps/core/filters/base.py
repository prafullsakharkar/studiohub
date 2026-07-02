import django_filters


class BaseFilterSet(django_filters.FilterSet):
    """
    Base filter set for all application filter sets.
    """

    class Meta:
        abstract = True
