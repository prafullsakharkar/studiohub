from celery import shared_task

from apps.identity.models import UserSession


@shared_task
def cleanup_expired_sessions():
    """
    Delete expired sessions.
    """
    queryset = UserSession.objects.expired()

    count = queryset.count()

    queryset.delete()

    return count
