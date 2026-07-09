from celery import shared_task

from apps.identity.models import User


@shared_task
def update_last_seen():
    """
    Placeholder for user maintenance jobs.
    """
    return User.objects.count()
