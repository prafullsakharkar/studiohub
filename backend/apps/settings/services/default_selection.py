"""
"The one" theme or localization: exactly one row of a model is the default, it is always active, and only
``make_default`` moves it. Shared by ThemeService and LocalizationService (and the serializers' create).
"""

from __future__ import annotations

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError


def make_default(model, instance):
    """Make ``instance`` the default: the previous one is cleared first, in one transaction."""
    if instance.is_deleted:
        raise ValidationError({"detail": "A deleted row cannot be the default."})
    if not instance.is_active:
        raise ValidationError({"detail": "Activate it first: the default is always an active one."})
    with transaction.atomic():
        model.objects.filter(is_default=True).exclude(pk=instance.pk).update(is_default=False)
        if not instance.is_default:
            instance.is_default = True
            instance.save(update_fields=["is_default"])
    return instance


def adopt_if_first(model, instance):
    """The first active row becomes the default, so that there is one whenever there is any to choose from."""
    if (
        instance.is_default
        or not instance.is_active
        or model.objects.filter(is_default=True).exists()
    ):
        return instance
    try:
        with transaction.atomic():
            instance.is_default = True
            instance.save(update_fields=["is_default"])
    except IntegrityError:
        # Another request took the place a moment ago; this one stays an ordinary row.
        instance.is_default = False
    return instance


def refuse_if_default(instance, what: str, reason: str):
    """The default may be neither deactivated nor deleted: make another row the default first."""
    if instance.is_default:
        raise ValidationError(
            {
                "detail": f"This {what} is the default and cannot be {reason}. Make another one the default first."
            }
        )
