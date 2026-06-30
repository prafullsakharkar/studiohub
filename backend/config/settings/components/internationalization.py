"""
Internationalization.
"""

from config.env import BASE_DIR, settings

LANGUAGE_CODE = settings.language_code

TIME_ZONE = settings.time_zone

USE_I18N = settings.use_i18n

USE_TZ = settings.use_tz

LOCALE_PATHS = [
    BASE_DIR / "locale",
]
