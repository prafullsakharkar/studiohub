from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.identity.models import UserSession


@receiver(
    post_save,
    sender=UserSession,
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
