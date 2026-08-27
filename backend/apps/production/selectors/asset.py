from django.db.models import QuerySet

from apps.production.models import Asset


class AssetSelector:
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        qs = Asset.objects.select_related("organization", "project", "department", "team", "assigned_artist").all()
        if request is not None:
            org_id = request.headers.get("X-Organization-Id") or request.headers.get("X-Organization") or getattr(request, "organization", None)
            if org_id:
                try:
                    org_pk = org_id.id if hasattr(org_id, "id") else org_id
                    qs = qs.filter(organization_id=org_pk)
                except Exception:
                    pass
        return qs
