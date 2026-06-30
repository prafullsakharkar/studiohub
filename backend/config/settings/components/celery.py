"""
Celery configuration.
"""

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
