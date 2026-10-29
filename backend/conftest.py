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


@pytest.fixture(autouse=True)
def _clear_permission_cache():
    """Clear the cache between tests.

    Permission resolution is cached (1h TTL); without this, grants created in
    one test leak into another when user PKs collide across rolled-back tests.
    """
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


def _seeded_platform(django_db_setup, django_db_blocker):
    """
    ``init_platform`` run once for a group of tests instead of once per test.

    The seed runs in a transaction that stays open for the group and is rolled back at its end,
    like Django's ``TestCase.setUpTestData``. Each test's own ``db`` transaction nests inside it as
    a savepoint, so a test can change the seeded rows and the next test still sees the pristine
    seed. Nothing is committed. Only request it from tests that start from a fresh seed: a test
    that needs rows to exist *before* the first run, or an empty database, must not use it.
    """
    from io import StringIO

    from django.core.management import call_command
    from django.db import transaction

    with django_db_blocker.unblock():
        outer = transaction.atomic()
        outer.__enter__()
        try:
            call_command("init_platform", stdout=StringIO())
        except BaseException:
            transaction.set_rollback(True)
            outer.__exit__(None, None, None)
            raise
    try:
        yield
    finally:
        with django_db_blocker.unblock():
            transaction.set_rollback(True)
            outer.__exit__(None, None, None)


#: the seed for every test in a module / for every test in a class
seeded_platform_module = pytest.fixture(scope="module")(_seeded_platform)
seeded_platform_class = pytest.fixture(scope="class")(_seeded_platform)
