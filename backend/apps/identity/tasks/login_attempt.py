from celery import shared_task

from apps.identity.models import LoginAttempt


@shared_task
def cleanup_login_attempts():
    """
    Remove expired login attempts.
    """
    queryset = LoginAttempt.objects.expired()

    count = queryset.count()

    queryset.delete()

    return count
