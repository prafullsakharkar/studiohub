"""
Scheduled audit retention (Celery beat ``audit-purge``; the ``audit_purge`` command does the same).
"""

from celery import shared_task

from apps.audit.services.retention import purge_expired


@shared_task(name="audit.purge")
def audit_purge():
    return purge_expired()
