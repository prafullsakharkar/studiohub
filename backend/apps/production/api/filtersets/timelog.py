import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Timelog


class TimelogFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    task = django_filters.UUIDFilter(field_name="task_id")
    project = django_filters.UUIDFilter(field_name="project_id")
    person = django_filters.UUIDFilter(field_name="person_id")
    billable = django_filters.BooleanFilter(field_name="billable")
    date = django_filters.DateFilter(field_name="date")
    start_date = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    end_date = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Timelog
        fields = ["status", "task", "project", "person", "billable", "date"]

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(notes__icontains=value) |
            Q(task_code__icontains=value) |
            Q(task_title__icontains=value) |
            Q(person_name_annotated__icontains=value) |
            Q(project_code_annotated__icontains=value) |
            Q(task_title_annotated__icontains=value)
        )
