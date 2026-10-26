from django.db.models import QuerySet

from apps.production.models import Playlist
from apps.production.selectors.base import ProductionBaseSelector


class PlaylistSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Playlist]:
        return (
            Playlist.objects.select_related("project").prefetch_related("entry_rows__version").all()
        )
