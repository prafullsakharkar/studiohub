"""
Custom test runner that preserves the database.
This allows tests to run against a pre-created test database without requiring CREATEDB privilege.
"""

from django.conf import settings
from django.db import connection
from django.test.runner import DiscoverRunner


class PreserveDatabaseTestRunner(DiscoverRunner):
    """
    A test runner that preserves the test database.

    This runner skips the database creation and destruction steps,
    allowing tests to run against a pre-created database.

    Usage:
    1. Create the test database manually: createdb test_cricketiq
    2. Run migrations on the test database: python manage.py migrate --database=default
    3. Run tests with: DJANGO_SETTINGS_MODULE=config.settings.testing pytest or manage.py test
    """

    def setup_databases(self, **kwargs):
        """
        Skip database creation - assume the test database already exists.
        """
        # Verify the database exists
        db_name = settings.DATABASES["default"]["NAME"]
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", [db_name])
            if not cursor.fetchone():
                raise RuntimeError(
                    f"Test database '{db_name}' does not exist. "
                    "Please create it first with: createdb {db_name}"
                )

        # Return None to skip the default database setup
        return None

    def teardown_databases(self, old_config, **kwargs):
        """
        Skip database destruction - preserve the test database.
        """
        # Do nothing - preserve the database
        pass

    def setup_test_environment(self, **kwargs):
        """
        Set up the test environment.
        """
        super().setup_test_environment(**kwargs)

    def teardown_test_environment(self, **kwargs):
        """
        Tear down the test environment.
        """
        super().teardown_test_environment(**kwargs)
