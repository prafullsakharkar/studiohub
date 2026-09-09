"""
Pytest configuration for Django.
This file ensures Django is properly configured before any tests are run.
"""

import os

import pytest

# Set the Django environment BEFORE any imports to ensure correct .env file is loaded
os.environ.setdefault("DJANGO_ENV", "testing")

# Set the Django settings module before any Django imports
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.testing")

# Initialize Django at module load time to ensure models can be imported
import django

django.setup()


@pytest.fixture(autouse=True)
def _clear_django_cache():
    """Clear Django app registry cache between tests."""
    from django.apps import apps

    # Clear the app registry to ensure clean state between tests
    apps.clear_cache()
