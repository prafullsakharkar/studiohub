import django_filters
from django.db.models import Q


class SearchFilterMixin(django_filters.FilterSet):
    """
    Generic search support.

    Subclassing ``FilterSet`` (with an abstract ``Meta``) makes the declared
    ``search`` filter visible to django-filter's metaclass, which only
    inspects class attributes and bases that are themselves FilterSets.
    """

    search = django_filters.CharFilter(method="filter_search")

    search_fields = ()

    def filter_search(
        self,
        queryset,
        name,
        value,
    ):
        if not value or not self.search_fields:
            return queryset

        query = Q()

        for field in self.search_fields:
            query |= Q(**{f"{field}__icontains": value})

        return queryset.filter(query)

    class Meta:
        abstract = True
