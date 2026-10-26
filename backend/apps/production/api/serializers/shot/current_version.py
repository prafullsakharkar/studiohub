"""A shot's derived current version in responses (D-16). Never writable; see ``selectors/rollups.py``."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.production.selectors.rollups import ShotCurrentVersionSelector


class ShotCurrentVersionMixin(serializers.Serializer[Any]):
    current_version = serializers.SerializerMethodField()
    current_version_id = serializers.SerializerMethodField()

    def get_current_version(self, obj) -> str:
        return ShotCurrentVersionSelector.of(obj)[0]

    def get_current_version_id(self, obj) -> str | None:
        version_id = ShotCurrentVersionSelector.of(obj)[1]
        return str(version_id) if version_id else None

    def current_value(self, name):
        if name == "current_version":
            instance = getattr(self, "instance", None)
            return ShotCurrentVersionSelector.of(instance)[0] if instance is not None else ""
        return super().current_value(name)  # pyright: ignore[reportAttributeAccessIssue]

    def _changes(self, name, raw) -> bool:
        # A new shot has no versions; the old default and an empty value are not a change.
        is_new = getattr(self, "instance", None) is None
        if name == "current_version" and is_new and str(raw or "").strip() in ("", "v001"):
            return False
        return super()._changes(name, raw)  # pyright: ignore[reportAttributeAccessIssue]
