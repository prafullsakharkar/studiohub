from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.identity.models import UserMFA


@receiver(
    post_save,
    sender=UserMFA,
)
def mfa_device_post_save(
    sender,
    instance,
    created,
    **kwargs,
):
    if created:
        return

    # placeholder
