from django.test import SimpleTestCase

from rest_framework import serializers, viewsets

from apps.core.api.serializers.base import (
    BaseModelSerializer,
    BaseReadSerializer,
    BaseWriteSerializer,
    BaseNestedSerializer,
)
from apps.core.api.viewsets.base import BaseViewSet, ServiceModelViewSet
from apps.core.api.builders.response import ResponseBuilder
from apps.core.api.pagination.base import BaseAPIPagination


class TestAPIFoundation(SimpleTestCase):
    def test_base_serializers_exist_and_are_serializers(self):
        self.assertTrue(issubclass(BaseModelSerializer, serializers.ModelSerializer))
        self.assertTrue(issubclass(BaseReadSerializer, BaseModelSerializer))
        self.assertTrue(issubclass(BaseWriteSerializer, BaseModelSerializer))
        self.assertTrue(issubclass(BaseNestedSerializer, BaseModelSerializer))

    def test_base_viewsets_exist(self):
        self.assertTrue(issubclass(BaseViewSet, viewsets.GenericViewSet))
        self.assertTrue(issubclass(ServiceModelViewSet, BaseViewSet))

    def test_response_builder_shapes(self):
        ok = ResponseBuilder.success(data={"x": 1}, message="ok", status_code=200)
        self.assertIsInstance(ok, dict)
        self.assertTrue(ok.get("success"))
        self.assertEqual(ok.get("status_code"), 200)
        self.assertEqual(ok.get("message"), "ok")
        self.assertIn("data", ok)
        self.assertIn("errors", ok)

        err = ResponseBuilder.error(message="bad", status_code=400, errors={"a": "b"})
        self.assertIsInstance(err, dict)
        self.assertFalse(err.get("success"))
        self.assertEqual(err.get("status_code"), 400)
        self.assertEqual(err.get("message"), "bad")
        self.assertEqual(err.get("errors"), {"a": "b"})

    def test_pagination_base_exists(self):
        # BaseAPIPagination is a lightweight DRF pagination helper in core
        self.assertTrue(hasattr(BaseAPIPagination, "paginate_queryset"))
        self.assertTrue(hasattr(BaseAPIPagination, "get_paginated_response"))
