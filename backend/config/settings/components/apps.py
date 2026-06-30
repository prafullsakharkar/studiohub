"""
Installed applications.
"""

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "drf_spectacular",
    "django_filters",
    "corsheaders",
]

LOCAL_APPS = [
    "apps.common",
    # "apps.core",
    # Business Apps
    # "apps.identity",
    # "apps.organizations",
    # "apps.projects",
    # "apps.assets",
    # "apps.shots",
    # "apps.tasks",
    # "apps.reviews",
    # "apps.notifications",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS
