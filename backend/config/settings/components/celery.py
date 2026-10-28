"""
Celery configuration.
"""

import ssl

from celery.schedules import crontab

from config.env import settings

CELERY_BROKER_URL = settings.celery_broker_url

CELERY_RESULT_BACKEND = settings.celery_result_backend


def _tls_options() -> dict[str, object]:
    """TLS options for a ``rediss://`` broker / result backend: verify the server against our CA."""
    options: dict[str, object] = {"ssl_cert_reqs": ssl.CERT_REQUIRED}
    if settings.redis_ca_cert:
        options["ssl_ca_certs"] = settings.redis_ca_cert
    return options


# False: plain redis://. A rediss:// URL is verified against REDIS_CA_CERT (TPN review TM-009).
CELERY_BROKER_USE_SSL = _tls_options() if CELERY_BROKER_URL.startswith("rediss://") else False

CELERY_REDIS_BACKEND_USE_SSL = (
    _tls_options() if CELERY_RESULT_BACKEND.startswith("rediss://") else False
)

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
