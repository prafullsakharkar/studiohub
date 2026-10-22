from celery import shared_task

from apps.identity.services.login_attempt import LoginAttemptService


@shared_task
def cleanup_login_attempts():
    """
    Delete login attempts past the retention window.
    """
    return LoginAttemptService.purge_expired()
