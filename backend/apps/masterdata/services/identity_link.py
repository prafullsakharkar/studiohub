"""
What Identity owns about a linked person (DOM-MD-PER-03, DECISIONS D4).

While a person is linked to a user, ``name`` and ``email`` come from Identity:
``User.email`` and the profile's display name (else first + last name). They are
copied when the link is made and refreshed after commit whenever the user or the
profile is saved (``signals/identity_sync.py``).
"""

from __future__ import annotations

from typing import Any

from apps.core.logging.logger import get_logger

logger = get_logger("masterdata")


def identity_values(user: Any) -> dict[str, str]:
    """``{"name": ..., "email": ...}`` from Identity; a blank value is left out."""
    values: dict[str, str] = {}
    email = (getattr(user, "email", "") or "").strip().lower()
    if email:
        values["email"] = email
    profile = getattr(user, "profile", None) if user is not None else None
    name = ""
    if profile is not None:
        name = (profile.display_name or "").strip() or " ".join(
            part
            for part in ((profile.first_name or "").strip(), (profile.last_name or "").strip())
            if part
        )
    if name:
        values["name"] = name[:255]
    return values


def refresh_person_for_user(user_id: Any) -> bool:
    """Copy Identity's name and e-mail onto the person linked to ``user_id``.

    Returns whether anything changed. Never raises: a failure here must not
    undo or fail the Identity write that triggered it.
    """
    from django.contrib.auth import get_user_model

    from apps.masterdata.events import records
    from apps.masterdata.models import Person

    try:
        person = Person.objects.filter(user_id=user_id).first()
        if person is None:
            return False
        user = get_user_model().objects.filter(pk=user_id).first()
        values = identity_values(user)
        changes = {k: v for k, v in values.items() if getattr(person, k) != v}
        if not changes:
            return False
        if "email" in changes and (
            Person.objects.filter(email__iexact=changes["email"]).exclude(pk=person.pk).exists()
        ):
            logger.warning(
                "person_email_sync_skipped", person_id=str(person.pk), reason="duplicate"
            )
            changes.pop("email")
        if not changes:
            return False
        # A queryset update on purpose: no ChangeLog row, no signal loop.
        Person.objects.filter(pk=person.pk).update(**changes)
        records.MasterdataRecordUpdated.dispatch(
            model=Person._meta.label,
            id=str(person.pk),
            code=None,
            name=None,
            actor_id=None,
            changed=sorted(changes),
        )
        return True
    except Exception:  # noqa: BLE001
        logger.exception("person_identity_sync_failed", user_id=str(user_id))
        return False
