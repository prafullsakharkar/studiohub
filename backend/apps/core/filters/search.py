import django_filters


class SearchFilterMixin:
    """
    Generic search support.
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

        from django.db.models import Q

        query = Q()

        for field in self.search_fields:
            query |= Q(**{f"{field}__icontains": value})

        return queryset.filter(query)
