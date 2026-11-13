from uuid import UUID

import django_filters
from django.db.models import Exists, OuterRef
from django_filters.rest_framework import FilterSet

from apps.production.models import Playlist, PlaylistEntry


# The REST-framework FilterSet (not BaseFilterSet) on purpose: ``status``, ``project`` and ``client_only``
# are generated exactly as the former ``filterset_fields`` made them, so those three are unchanged.
class PlaylistFilterSet(FilterSet):
    #: the playlists holding this version (a live ``PlaylistEntry``); unknown or malformed: no rows, never a 400 (C-RP-04)
    version_id = django_filters.CharFilter(method="filter_version")

    class Meta:
        model = Playlist
        fields = ["status", "project", "client_only", "version_id"]

    def filter_version(self, queryset, name, value):
        if not value:
            return queryset
        try:
            key = UUID(str(value))
        except ValueError:
            return queryset.none()
        entries = PlaylistEntry.objects.filter(
            playlist=OuterRef("pk"), version_id=key, is_deleted=False
        )
        return queryset.filter(Exists(entries))
