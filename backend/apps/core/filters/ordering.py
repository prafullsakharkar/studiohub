import django_filters


class OrderingFilterMixin:

    ordering = django_filters.OrderingFilter()
