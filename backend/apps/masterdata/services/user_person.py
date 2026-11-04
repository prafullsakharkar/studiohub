"""
Every user has a person (DOM-MD-PER-10): created and linked after commit when the user is created,
and by ``manage.py link_users_to_people`` for users that existed before the rule.
"""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from apps.core.logging.logger import get_logger
from apps.masterdata.models import Person
from apps.masterdata.services.identity_link import identity_values
from apps.masterdata.services.person import PersonService

logger = get_logger("masterdata")


def ensure_person_for_user(user_id: Any, *, actor: Any = None) -> str:
    """
    Give ``user_id`` a Person (DOM-MD-PER-10): every user is linked to one.

    Returns ``"exists"`` (already linked), ``"linked"`` (an unlinked person with the user's e-mail
    was adopted), ``"created"`` or ``"failed"``. Never raises: a failure here must not undo or
    fail the Identity write that triggered it (``manage.py link_users_to_people`` catches up).
    """
    try:
        user = get_user_model().objects.filter(pk=user_id).first()
        if user is None:
            return "failed"
        if Person.objects.filter(user_id=user.pk).exists():
            return "exists"
        values = identity_values(user)
        email = values.get("email")
        adoptable = (
            Person.objects.filter(email__iexact=email, user__isnull=True).first() if email else None
        )
        if adoptable is not None:
            PersonService.link_user(actor=actor, person=adoptable, user=user)
            return "linked"
        # A name is required; a user with no profile name is shown by the part of the e-mail before "@".
        values.setdefault("name", (email or str(user.pk)).split("@")[0][:255])
        person = PersonService.create(actor=actor, data=values)
        PersonService.link_user(actor=actor, person=person, user=user)
        return "created"
    except Exception:  # noqa: BLE001
        logger.exception("person_for_user_failed", user_id=str(user_id))
        return "failed"
