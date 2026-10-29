"""
Query-level access for viewsets (H1, DECISIONS D11).

Without the permission a caller must not be able to *probe* a hidden field:

* naming it in a filter or in ``ordering`` is refused with 403 (checked right
  after authentication and permissions, before any object lookup);
* ``search`` runs only over the fields the caller may see, so a search cannot be
  used to find out whether an e-mail address exists.
"""

from __future__ import annotations

from typing import Any, ClassVar

from rest_framework import filters
from rest_framework.exceptions import PermissionDenied

from apps.masterdata.permissions.access import can

_SEARCH_PREFIXES = "^=@$"


def _blocked_for(request: Any, gated: dict[str, tuple[str, ...]]) -> set[str]:
    return {
        field.lower()
        for code, fields in gated.items()
        if not can(request, code)
        for field in fields
    }


class GatedQueryMixin:
    #: ``{permission_code: (field, ...)}``; same shape as the serializer's ``gated_fields``.
    gated_query_fields: ClassVar[dict[str, tuple[str, ...]]] = {}

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)  # pyright: ignore[reportAttributeAccessIssue]
        blocked = _blocked_for(request, self.gated_query_fields)
        if not blocked:
            return
        named = {key.split("__")[0].lower() for key in request.query_params}
        ordering = request.query_params.get("ordering", "")
        named |= {
            part.strip().lstrip("-").split("__")[0].lower()
            for part in ordering.split(",")
            if part.strip()
        }
        used = sorted(named & blocked)
        if used:
            raise PermissionDenied(f"You may not filter or sort by: {', '.join(used)}.")


class GatedSearchFilter(filters.SearchFilter):
    def get_search_fields(self, view, request):
        fields = super().get_search_fields(view, request)
        gated = getattr(view, "gated_query_fields", {})
        blocked = _blocked_for(request, gated)
        if not fields or not blocked:
            return fields
        return [
            f for f in fields if f.lstrip(_SEARCH_PREFIXES).split("__")[0].lower() not in blocked
        ]
