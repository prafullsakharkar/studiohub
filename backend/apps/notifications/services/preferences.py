"""Reading and saving a person's muted kinds (docs/review-pipeline RP-11, C-RP-30)."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.notifications.constants import MUTABLE_KINDS, Kind
from apps.notifications.models import NotificationPreference


class PreferenceService:
    @staticmethod
    def muted(user: Any) -> list[str]:
        """What ``user`` muted, in the kinds' order (nothing without a saved row)."""
        row = NotificationPreference.objects.filter(user=user).first()
        stored = set(row.muted_kinds or []) if row else set()
        return [kind for kind in MUTABLE_KINDS if kind in stored]

    @staticmethod
    def save(user: Any, kinds: Iterable[str]) -> list[str]:
        """Replace what ``user`` muted; an unknown kind or one that cannot be muted is a 400."""
        wanted = list(dict.fromkeys(kinds))
        for kind in wanted:
            if kind not in Kind.values:
                raise ValidationError({"muted_kinds": [f"Unknown kind: {kind}."]})
            if kind not in MUTABLE_KINDS:
                raise ValidationError({"muted_kinds": [f"{kind} cannot be muted."]})
        ordered = [kind for kind in MUTABLE_KINDS if kind in wanted]
        NotificationPreference.objects.update_or_create(
            user=user, defaults={"muted_kinds": ordered, "updated_at": timezone.now()}
        )
        return ordered

    @staticmethod
    def muting(user_ids: Iterable[Any], kinds: Iterable[str]) -> set[tuple[str, str]]:
        """``(user_id, kind)`` pairs among ``user_ids`` x ``kinds`` that are muted: one query."""
        wanted = set(kinds)
        rows = NotificationPreference.objects.filter(user_id__in=list(user_ids)).values_list(
            "user_id", "muted_kinds"
        )
        return {
            (str(user_id), kind)
            for user_id, muted in rows
            for kind in (muted or [])
            if kind in wanted
        }
