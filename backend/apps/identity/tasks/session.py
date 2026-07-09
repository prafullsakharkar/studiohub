from celery import shared_task

from apps.identity.models import Session


@shared_task
def cleanup_expired_sessions():
    """
    Delete expired sessions.
    """
    queryset = Session.objects.expired()

    count = queryset.count()

    queryset.delete()

    return count
