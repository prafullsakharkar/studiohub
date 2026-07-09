from celery import shared_task

from apps.identity.models import Invitation


@shared_task
def expire_invitations():
    """
    Expire pending invitations.
    """
    queryset = Invitation.objects.expired()

    count = queryset.count()

    queryset.update(
        is_active=False,
    )

    return count
