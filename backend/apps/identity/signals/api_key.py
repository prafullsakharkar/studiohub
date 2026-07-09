from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.identity.models import APIKey


@receiver(
    post_save,
    sender=APIKey,
)
def api_key_post_save(
    sender,
    instance,
    created,
    **kwargs,
):
    if created:
        return

    # placeholder
