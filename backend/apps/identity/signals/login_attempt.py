from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.identity.models import LoginAttempt


@receiver(
    post_save,
    sender=LoginAttempt,
)
def login_attempt_post_save(
    sender,
    instance,
    created,
    **kwargs,
):
    if created:
        return

    # placeholder
