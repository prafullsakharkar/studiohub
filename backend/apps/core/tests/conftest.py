"""
Pytest configuration for Core module tests.

This file configures Django for pytest tests and provides fixtures.
"""

import os

import django
from django.conf import settings


def pytest_configure():
    """Configure Django settings before tests run."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.testing")
    django.setup()
