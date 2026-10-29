"""
Keep a linked person's name and e-mail in step with Identity (DOM-MD-PER-03).

After commit, on every save of a ``User`` or ``Profile`` that touches a field Identity owns
for the person. Saves that touch only other fields (``last_login`` on every login) do
nothing and cost no query.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction
from django.db.models.signals import post_save

from apps.masterdata.services.identity_link import refresh_person_for_user

_USER_FIELDS = frozenset({"email"})
_PROFILE_FIELDS = frozenset({"first_name", "last_name", "display_name"})


def _relevant(update_fields: Any, owned: frozenset[str]) -> bool:
    return update_fields is None or bool(owned & set(update_fields))


def _user_saved(sender, instance, created, update_fields=None, **kwargs) -> None:
    if created or not _relevant(update_fields, _USER_FIELDS):
        return
    user_id = instance.pk
    transaction.on_commit(lambda: refresh_person_for_user(user_id))


def _profile_saved(sender, instance, created, update_fields=None, **kwargs) -> None:
    if not _relevant(update_fields, _PROFILE_FIELDS):
        return
    user_id = instance.user_id
    transaction.on_commit(lambda: refresh_person_for_user(user_id))


def connect() -> None:
    from django.contrib.auth import get_user_model

    from apps.identity.models import Profile

    post_save.connect(
        _user_saved, sender=get_user_model(), dispatch_uid="masterdata.person_sync.user"
    )
    post_save.connect(_profile_saved, sender=Profile, dispatch_uid="masterdata.person_sync.profile")
