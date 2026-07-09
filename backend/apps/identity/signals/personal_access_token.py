from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.identity.models import (
    PersonalAccessToken,
)


@receiver(
    post_save,
    sender=PersonalAccessToken,
)
def personal_access_token_post_save(
    sender,
    instance,
    created,
    **kwargs,
):
    if created:
        return

    # placeholder
