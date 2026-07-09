from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.identity.models import Invitation


@receiver(
    post_save,
    sender=Invitation,
)
def invitation_post_save(
    sender,
    instance,
    created,
    **kwargs,
):
    if created:
        return

    # placeholder
