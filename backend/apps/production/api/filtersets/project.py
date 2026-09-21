import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Project


class ProjectFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    type = django_filters.CharFilter(field_name="type", lookup_expr="iexact")
    code = django_filters.CharFilter(field_name="code", lookup_expr="iexact")
    name = django_filters.CharFilter(field_name="name", lookup_expr="icontains")
    # Frontend-contract alias: useProjects sends `organization_id`. Resolved
    # server-side and applied as an additional constraint inside the already
    # header-scoped queryset — never trusted for authorization. Unresolvable
    # or foreign values yield no rows (fail closed).
    organization_id = django_filters.CharFilter(method="filter_organization_id")

    class Meta:
        model = Project
        fields = ["status", "type", "code", "name", "organization_id"]

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(name__icontains=value) |
            Q(code__icontains=value) |
            Q(description__icontains=value) |
            Q(client_name__icontains=value)
        )

    def filter_organization_id(self, queryset, name, value):
        if not value:
            return queryset
        from apps.organization.selectors.organization import OrganizationSelector

        org = OrganizationSelector.resolve_by_lookup(value)
        if org is None:
            return queryset.none()
        return queryset.filter(organization=org)
