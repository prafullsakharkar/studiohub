"""
Celery configuration.
"""

from celery.schedules import crontab

from config.env import settings

CELERY_BROKER_URL = settings.celery_broker_url

CELERY_RESULT_BACKEND = settings.celery_result_backend

CELERY_ACCEPT_CONTENT = ["json"]

CELERY_TASK_SERIALIZER = "json"

CELERY_RESULT_SERIALIZER = "json"

CELERY_TIMEZONE = settings.time_zone

CELERY_TASK_TRACK_STARTED = True

CELERY_TASK_TIME_LIMIT = 30 * 60

CELERY_RESULT_EXPIRES = 86400

CELERY_BEAT_SCHEDULE = {
    "identity-cleanup": {
        "task": "identity.cleanup",
        "schedule": crontab(hour=3, minute=15),
    },
    "audit-purge": {
        "task": "audit.purge",
        "schedule": crontab(hour=3, minute=45),
    },
}
