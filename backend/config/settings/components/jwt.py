from datetime import timedelta

from config.env import settings

# A session ends this long after it started, however often it is refreshed.
SESSION_MAX_ABSOLUTE_LIFETIME_DAYS = 30

# No authenticated request for this long (minutes): the session cannot be refreshed. 0 = off.
SESSION_IDLE_TIMEOUT_MINUTES = settings.session_idle_timeout_minutes

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}
