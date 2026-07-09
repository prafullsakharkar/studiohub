from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.identity.models import Session


@receiver(
    post_save,
    sender=Session,
)
def session_post_save(
    sender,
    instance,
    created,
    **kwargs,
):
    if created:
        return

    # placeholder
