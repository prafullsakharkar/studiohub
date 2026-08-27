from django.db.models import QuerySet

from apps.production.models import Project


class ProjectSelector:
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        qs = Project.objects.select_related("organization", "supervisor", "coordinator").all()
        # Scope by organization if header present (frontend sends X-Organization-Id)
        if request is not None:
            org_id = request.headers.get("X-Organization-Id") or request.headers.get("X-Organization") or getattr(request, "organization", None)
            if org_id:
                # org_id may be Organization instance or string
                try:
                    org_pk = org_id.id if hasattr(org_id, "id") else org_id
                    qs = qs.filter(organization_id=org_pk)
                except Exception:
                    pass
        return qs
