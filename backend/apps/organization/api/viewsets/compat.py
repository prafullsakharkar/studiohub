"""
Shared compatibility mixins for frontend-contract viewsets.

Moved from ``legacy.py`` to be reused by canonical viewsets across all
route trees (flat, nested, namespaced).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, ClassVar

from django.http import Http404


class IdOrCodeDetailMixin:
    """Detail lookup by UUID id or ``code`` (case-insensitive).

    Degrades gracefully to id-only lookup for models without a ``code``
    field. Used by the flat/nested frontend-contract aliases.
    """

    # Mixin contract: provided by the viewset this mixin is combined with.
    # Annotations only, no runtime effect.
    kwargs: ClassVar[Any]
    lookup_url_kwarg: ClassVar[str | None]
    lookup_field: ClassVar[str]
    request: ClassVar[Any]
    selector_class: ClassVar[Any]
    service_class: ClassVar[Any]
    filter_queryset: ClassVar[Callable[..., Any]]
    get_queryset: ClassVar[Callable[..., Any]]
    check_object_permissions: ClassVar[Callable[..., None]]

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        queryset = self.filter_queryset(self.get_queryset())
        try:
            obj = queryset.filter(id=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        except (ValueError, TypeError, Exception):
            pass
        model = getattr(getattr(self, "selector_class", None), "model", None) or getattr(
            getattr(self, "service_class", None), "model", None
        )
        if model is not None:
            try:
                model._meta.get_field("code")
            except Exception:  # noqa: BLE001
                model = None
        if model is not None:
            try:
                obj = queryset.filter(code__iexact=lookup).first()
                if obj:
                    self.check_object_permissions(self.request, obj)
                    return obj
            except Exception:  # noqa: BLE001
                pass
        raise Http404


class FrontendStatusCompatMixin:
    """Map frontend status words to backend values (compat aliases only).

    - ``frontend_status_map``: same-field value mapping applied to incoming
      ``status`` (e.g. invitations ``revoked`` -> ``cancelled``).
    - ``frontend_status_target`` + ``frontend_status_target_map``: map
      incoming ``status`` onto a different field (e.g. api keys
      ``status`` -> ``is_active`` boolean).
    - ``frontend_status_output``: ``{source: {backend_value: frontend_word}}``
      applied to list/retrieve payloads. ``source`` is either a payload key
      (value mapping) or ``"is_active"`` (boolean mapping).
    """

    frontend_status_map: ClassVar[dict[str, str]] = {}
    frontend_status_target: ClassVar[str | None] = None
    frontend_status_target_map: ClassVar[dict[str, Any]] = {}
    frontend_status_output: ClassVar[dict[str, dict[Any, str]]] = {}
    # Mixin contract: provided by the viewset this mixin is combined with.
    # Annotations only, no runtime effect.
    request: ClassVar[Any]

    def _rewrite_status_input(self):
        data = getattr(self.request, "data", None)
        if not isinstance(data, dict):
            return
        raw = data.get("status")
        if not isinstance(raw, str):
            return
        key = raw.strip().lower()
        if self.frontend_status_target and key in self.frontend_status_target_map:
            data[self.frontend_status_target] = self.frontend_status_target_map[key]
            data.pop("status", None)
        elif key in self.frontend_status_map:
            data["status"] = self.frontend_status_map[key]

    def update(self, request, *args, **kwargs):
        self._rewrite_status_input()
        # reportAttributeAccessIssue: super() is the combined DRF viewset.
        response = super().update(request, *args, **kwargs)  # pyright: ignore[reportAttributeAccessIssue]
        response.data = self._inject_status_output(response.data)
        return response

    def partial_update(self, request, *args, **kwargs):
        self._rewrite_status_input()
        # reportAttributeAccessIssue: super() is the combined DRF viewset.
        response = super().partial_update(request, *args, **kwargs)  # pyright: ignore[reportAttributeAccessIssue]
        response.data = self._inject_status_output(response.data)
        return response

    def _inject_status_output(self, payload):
        if isinstance(payload, dict) and isinstance(payload.get("results"), list):
            for item in payload["results"]:
                self._inject_item_status(item)
            return payload
        if isinstance(payload, list):
            for item in payload:
                self._inject_item_status(item)
            return payload
        if isinstance(payload, dict):
            self._inject_item_status(payload)
        return payload

    def _inject_item_status(self, item):
        if not isinstance(item, dict):
            return
        for source, mapping in self.frontend_status_output.items():
            if source == "is_active":
                item["status"] = mapping.get(bool(item.get("is_active")), item.get("status"))
            elif source in item:
                item[source] = mapping.get(item[source], item[source])

    def list(self, request, *args, **kwargs):
        # reportAttributeAccessIssue: super() is the combined DRF viewset.
        response = super().list(request, *args, **kwargs)  # pyright: ignore[reportAttributeAccessIssue]
        response.data = self._inject_status_output(response.data)
        return response

    def retrieve(self, request, *args, **kwargs):
        # reportAttributeAccessIssue: super() is the combined DRF viewset.
        response = super().retrieve(request, *args, **kwargs)  # pyright: ignore[reportAttributeAccessIssue]
        response.data = self._inject_status_output(response.data)
        return response