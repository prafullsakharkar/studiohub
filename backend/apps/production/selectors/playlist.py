from django.db.models import QuerySet
from apps.production.models import Playlist
class PlaylistSelector:
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        qs = Playlist.objects.select_related("organization", "project").all()
        if request is not None:
            org_id = request.headers.get("X-Organization-Id") or request.headers.get("X-Organization") or getattr(request, "organization", None)
            if org_id:
                try:
                    org_pk = org_id.id if hasattr(org_id, "id") else org_id
                    qs = qs.filter(organization_id=org_pk)
                except Exception:
                    pass
        return qs
