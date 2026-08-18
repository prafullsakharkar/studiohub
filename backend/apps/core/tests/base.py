"""
Core test base classes.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.test import TestCase

if TYPE_CHECKING:
    from django.contrib.auth import get_user_model

    User = get_user_model()


class BaseTestCase(TestCase):
    """
    Base test case for all tests.

    Provides common setup and utility methods.
    """

    def setUp(self):
        """Set up test data."""
        pass

    def tearDown(self):
        """Tear down test data."""
        pass

    def assertDictContains(self, expected: dict, actual: dict):
        """Assert that expected dict is contained in actual dict."""
        for key, value in expected.items():
            self.assertIn(key, actual)
            self.assertEqual(value, actual[key])

    def assertDictNotContains(self, expected: dict, actual: dict):
        """Assert that expected dict is not contained in actual dict."""
        for key, value in expected.items():
            if key in actual:
                self.assertNotEqual(value, actual[key])

    def assertListContains(self, expected: list, actual: list):
        """Assert that expected list is contained in actual list."""
        for item in expected:
            self.assertIn(item, actual)

    def assertListNotContains(self, expected: list, actual: list):
        """Assert that expected list is not contained in actual list."""
        for item in expected:
            self.assertNotIn(item, actual)

    def assertQuerySetContains(self, expected, queryset):
        """Assert that queryset contains all expected objects."""
        for obj in expected:
            self.assertTrue(queryset.filter(pk=obj.pk).exists())

    def assertQuerySetNotContains(self, expected, queryset):
        """Assert that queryset does not contain any expected objects."""
        for obj in expected:
            self.assertFalse(queryset.filter(pk=obj.pk).exists())

    def assertCountEqual(self, first, second, msg=None):
        """Assert that two iterables have the same elements, ignoring order."""
        return super().assertCountEqual(first, second, msg)

    def assertJSONResponse(self, response, expected_data=None):
        """Assert that response is a valid JSON response."""
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")

        if expected_data is not None:
            self.assertDictContains(expected_data, response.json())

    def assertCreatedResponse(self, response, expected_data=None):
        """Assert that response is a 201 Created response."""
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response["Content-Type"], "application/json")

        if expected_data is not None:
            self.assertDictContains(expected_data, response.json())

    def assertNoContentResponse(self, response):
        """Assert that response is a 204 No Content response."""
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b"")

    def assertBadRequestResponse(self, response):
        """Assert that response is a 400 Bad Request response."""
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response["Content-Type"], "application/json")

    def assertUnauthorizedResponse(self, response):
        """Assert that response is a 401 Unauthorized response."""
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response["Content-Type"], "application/json")

    def assertForbiddenResponse(self, response):
        """Assert that response is a 403 Forbidden response."""
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response["Content-Type"], "application/json")

    def assertNotFoundResponse(self, response):
        """Assert that response is a 404 Not Found response."""
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response["Content-Type"], "application/json")

    def assertConflictResponse(self, response):
        """Assert that response is a 409 Conflict response."""
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response["Content-Type"], "application/json")

    def assertValidationError(self, response, field=None):
        """Assert that response is a validation error."""
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response["Content-Type"], "application/json")

        data = response.json()
        if field:
            self.assertIn(field, data)

    def assertPublished(self, obj):
        """Assert that an object is published."""
        obj.refresh_from_db()
        self.assertTrue(obj.is_published)

    def assertNotPublished(self, obj):
        """Assert that an object is not published."""
        obj.refresh_from_db()
        self.assertFalse(obj.is_published)


class BaseAPITestCase(BaseTestCase):
    """
    Base test case for API tests.

    Provides common setup for API testing.
    """

    def setUp(self):
        """Set up test data."""
        super().setUp()
        self.path = None

    def get_url(self, *args, **kwargs):
        """Get the URL for the current path."""
        from django.urls import reverse

        return reverse(self.path, args=args, kwargs=kwargs)

    def get_detail_url(self, uuid):
        """Get the detail URL for an object."""
        return self.get_url(str(uuid))
