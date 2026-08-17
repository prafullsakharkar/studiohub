"""
Tests for the Core API foundation.

Covers the public API building blocks provided by ``apps.core.api``:

- Response builders (``ResponseBuilder``, ``PaginationBuilder``)
- Global exception handler (``custom_exception_handler``)
- Base serializers (``BaseSerializer``, ``BaseModelSerializer``,
  ``BaseReadSerializer``, ``BaseWriteSerializer``, ``BaseNestedSerializer``)
- Base views (``BaseAPIView``)
- Base viewsets (``BaseViewSet``, ``ServiceModelViewSet``)
- Service mixin (``ServiceMixin``)
- API exceptions and their status codes
"""

from __future__ import annotations

import pytest
from django.core.exceptions import ImproperlyConfigured
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import JSONParser
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from apps.core.api.builders import PaginationBuilder, ResponseBuilder
from apps.core.api.exceptions import (
    BadRequestException,
    BaseAPIException,
    ConflictException,
    PermissionDeniedException,
    ResourceLockedException,
    ServiceUnavailableException,
    ValidationException,
    custom_exception_handler,
)
from apps.core.api.mixins.service import ServiceMixin
from apps.core.api.serializers import (
    BaseModelSerializer,
    BaseNestedSerializer,
    BaseReadSerializer,
    BaseSerializer,
    BaseWriteSerializer,
)
from apps.core.api.views import BaseAPIView
from apps.core.api.viewsets import BaseViewSet, ServiceModelViewSet

factory = APIRequestFactory()


# ---------------------------------------------------------------------------
# ResponseBuilder
# ---------------------------------------------------------------------------


class TestResponseBuilder:
    """Tests for the standardized success/error response payloads."""

    def test_success_defaults(self):
        payload = ResponseBuilder.success()

        assert payload["success"] is True
        assert payload["status_code"] == 200
        assert payload["message"] == "Success."
        assert payload["data"] is None
        assert payload["meta"] == {}
        assert payload["errors"] is None

    def test_success_with_data(self):
        payload = ResponseBuilder.success(data={"id": 1}, message="Created.")

        assert payload["success"] is True
        assert payload["data"] == {"id": 1}
        assert payload["message"] == "Created."

    def test_success_with_meta(self):
        payload = ResponseBuilder.success(meta={"count": 5})

        assert payload["meta"] == {"count": 5}

    def test_error_defaults(self):
        payload = ResponseBuilder.error()

        assert payload["success"] is False
        assert payload["status_code"] == 400
        assert payload["message"] == "Request failed."
        assert payload["data"] is None
        assert payload["meta"] == {}
        assert payload["errors"] is None

    def test_error_with_errors(self):
        payload = ResponseBuilder.error(
            message="Validation failed.",
            status_code=422,
            errors={"name": ["required"]},
        )

        assert payload["success"] is False
        assert payload["status_code"] == 422
        assert payload["message"] == "Validation failed."
        assert payload["errors"] == {"name": ["required"]}


# ---------------------------------------------------------------------------
# PaginationBuilder
# ---------------------------------------------------------------------------


class TestPaginationBuilder:
    """Tests for the standardized pagination metadata payload."""

    def test_build(self):
        payload = PaginationBuilder.build(
            page=2,
            page_size=10,
            total=25,
            pages=3,
            next_url="/api/items/?page=3",
            previous_url="/api/items/?page=1",
        )

        assert payload == {
            "page": 2,
            "page_size": 10,
            "total": 25,
            "pages": 3,
            "next": "/api/items/?page=3",
            "previous": "/api/items/?page=1",
        }

    def test_build_with_none_urls(self):
        payload = PaginationBuilder.build(
            page=1,
            page_size=10,
            total=5,
            pages=1,
            next_url=None,
            previous_url=None,
        )

        assert payload["next"] is None
        assert payload["previous"] is None


# ---------------------------------------------------------------------------
# custom_exception_handler
# ---------------------------------------------------------------------------


class TestCustomExceptionHandler:
    """Tests for the global DRF exception handler."""

    def test_handled_exception_is_standardized(self):
        exc = NotFound("Resource not found.")
        response = custom_exception_handler(exc, {})

        assert response is not None
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data["success"] is False
        assert response.data["status_code"] == status.HTTP_404_NOT_FOUND
        assert response.data["message"] == "Resource not found."
        assert response.data["data"] is None
        assert response.data["errors"] == {"detail": "Resource not found."}

    def test_validation_error_uses_non_field_errors(self):
        exc = ValidationError({"non_field_errors": ["Invalid combination."]})
        response = custom_exception_handler(exc, {})

        assert response.data["message"] == "Invalid combination."

    def test_validation_error_field_errors(self):
        exc = ValidationError({"name": ["This field is required."]})
        response = custom_exception_handler(exc, {})

        assert response.data["message"] == "Validation failed."
        assert response.data["errors"] == {"name": ["This field is required."]}

    def test_unhandled_exception_returns_500(self):
        response = custom_exception_handler(RuntimeError("boom"), {})

        assert response is not None
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.data["success"] is False
        assert response.data["message"] == "Internal server error."


# ---------------------------------------------------------------------------
# Base serializers
# ---------------------------------------------------------------------------


class TestBaseSerializer:
    """Tests for BaseSerializer request/user shortcuts."""

    def test_request_property(self):
        request = Request(factory.get("/"))
        serializer = BaseSerializer(context={"request": request})

        assert serializer.request is request

    def test_request_property_missing(self):
        serializer = BaseSerializer()

        assert serializer.request is None

    def test_user_property(self):
        request = Request(factory.get("/"))
        request.user = "some-user"
        serializer = BaseSerializer(context={"request": request})

        assert serializer.user == "some-user"

    def test_user_property_without_request(self):
        serializer = BaseSerializer()

        assert serializer.user is None


class TestBaseModelSerializer:
    """Tests for BaseModelSerializer request/user shortcuts."""

    def test_request_property(self):
        request = Request(factory.get("/"))
        serializer = BaseModelSerializer(context={"request": request})

        assert serializer.request is request

    def test_user_property(self):
        request = Request(factory.get("/"))
        request.user = "some-user"
        serializer = BaseModelSerializer(context={"request": request})

        assert serializer.user == "some-user"


class TestBaseWriteSerializer:
    """Tests for BaseWriteSerializer persistence delegation."""

    def test_create_raises_not_implemented(self):
        serializer = BaseWriteSerializer()

        with pytest.raises(NotImplementedError):
            serializer.create({})

    def test_update_raises_not_implemented(self):
        serializer = BaseWriteSerializer()

        with pytest.raises(NotImplementedError):
            serializer.update(None, {})


class TestSerializerHierarchy:
    """Tests that the serializer hierarchy is wired correctly."""

    def test_base_read_serializer_is_model_serializer(self):
        assert issubclass(BaseReadSerializer, BaseModelSerializer)

    def test_base_write_serializer_is_model_serializer(self):
        assert issubclass(BaseWriteSerializer, BaseModelSerializer)

    def test_base_nested_serializer_is_read_serializer(self):
        assert issubclass(BaseNestedSerializer, BaseReadSerializer)


# ---------------------------------------------------------------------------
# BaseAPIView
# ---------------------------------------------------------------------------


class _SampleSerializer(serializers.Serializer):
    name = serializers.CharField()


class _SampleAPIView(BaseAPIView):
    serializer_class = _SampleSerializer


class TestBaseAPIView:
    """Tests for BaseAPIView serializer helpers."""

    def test_default_permission_classes(self):
        from rest_framework.permissions import IsAuthenticated

        assert BaseAPIView.permission_classes == (IsAuthenticated,)

    def test_get_serializer_class(self):
        view = _SampleAPIView()

        assert view.get_serializer_class() is _SampleSerializer

    def test_get_serializer_class_asserts_when_none(self):
        view = BaseAPIView()

        with pytest.raises(AssertionError):
            view.get_serializer_class()

    def test_get_serializer_context(self):
        request = Request(factory.get("/"))
        view = _SampleAPIView()
        view.request = request

        context = view.get_serializer_context()

        assert context["request"] is request
        assert context["view"] is view

    def test_get_serializer_injects_context(self):
        request = Request(factory.get("/"))
        view = _SampleAPIView()
        view.request = request

        serializer = view.get_serializer(data={"name": "x"})

        assert isinstance(serializer, _SampleSerializer)
        assert serializer.context["request"] is request
        assert serializer.context["view"] is view


# ---------------------------------------------------------------------------
# BaseViewSet
# ---------------------------------------------------------------------------


class TestBaseViewSet:
    """Tests for BaseViewSet permission resolution."""

    def test_default_permission_classes(self):
        from rest_framework.permissions import IsAuthenticated

        assert BaseViewSet.permission_classes == (IsAuthenticated,)

    def test_get_permission_required_returns_none_when_empty(self):
        view = BaseViewSet()
        view.action = "list"

        assert view.get_permission_required() is None

    def test_get_permission_required_returns_first(self):
        class _ViewSet(BaseViewSet):
            permission_map = {
                "create": ("org.create", "org.manage"),
            }

        view = _ViewSet()
        view.action = "create"

        assert view.get_permission_required() == "org.create"

    def test_get_permission_required_unknown_action(self):
        class _ViewSet(BaseViewSet):
            permission_map = {
                "create": ("org.create",),
            }

        view = _ViewSet()
        view.action = "destroy"

        assert view.get_permission_required() is None


# ---------------------------------------------------------------------------
# ServiceModelViewSet
# ---------------------------------------------------------------------------


class TestServiceModelViewSet:
    """Tests for the declarative service-driven ViewSet."""

    def test_get_selector_raises_without_selector_class(self):
        view = ServiceModelViewSet()

        with pytest.raises(ImproperlyConfigured):
            view.get_selector()

    def test_get_selector_returns_configured_selector(self):
        class _Selector:
            @classmethod
            def get_queryset(cls, *, request, view):
                return []

        class _ViewSet(ServiceModelViewSet):
            selector_class = _Selector

        view = _ViewSet()

        assert view.get_selector() is _Selector

    def test_get_serializer_class_resolves_by_action(self):
        class _ReadSerializer(serializers.Serializer):
            pass

        class _WriteSerializer(serializers.Serializer):
            pass

        class _ViewSet(ServiceModelViewSet):
            serializer_map = {
                "list": _ReadSerializer,
                "create": _WriteSerializer,
            }

        view = _ViewSet()
        view.action = "list"

        assert view.get_serializer_class() is _ReadSerializer

        view.action = "create"

        assert view.get_serializer_class() is _WriteSerializer

    def test_get_serializer_class_falls_back_to_default(self):
        class _DefaultSerializer(serializers.Serializer):
            pass

        class _ViewSet(ServiceModelViewSet):
            default_serializer_class = _DefaultSerializer

        view = _ViewSet()
        view.action = "retrieve"

        assert view.get_serializer_class() is _DefaultSerializer


# ---------------------------------------------------------------------------
# ServiceMixin
# ---------------------------------------------------------------------------


class TestServiceMixin:
    """Tests for ServiceMixin service resolution."""

    def test_get_service_raises_without_service_class(self):
        mixin = ServiceMixin()

        with pytest.raises(NotImplementedError):
            mixin.get_service()

    def test_get_service_returns_configured_service(self):
        class _Service:
            pass

        class _Mixin(ServiceMixin):
            service_class = _Service

        assert _Mixin().get_service() is _Service


# ---------------------------------------------------------------------------
# API exceptions
# ---------------------------------------------------------------------------


class TestAPIExceptions:
    """Tests for the API exception status codes."""

    def test_base_api_exception(self):
        assert BaseAPIException.status_code == status.HTTP_400_BAD_REQUEST

    def test_bad_request(self):
        assert BadRequestException.status_code == status.HTTP_400_BAD_REQUEST

    def test_validation(self):
        assert ValidationException.status_code == status.HTTP_400_BAD_REQUEST

    def test_permission_denied(self):
        assert PermissionDeniedException.status_code == status.HTTP_403_FORBIDDEN

    def test_not_found(self):
        from apps.core.api.exceptions.api import NotFoundException

        assert NotFoundException.status_code == status.HTTP_404_NOT_FOUND

    def test_conflict(self):
        assert ConflictException.status_code == status.HTTP_409_CONFLICT

    def test_resource_locked(self):
        assert ResourceLockedException.status_code == status.HTTP_423_LOCKED

    def test_service_unavailable(self):
        assert (
            ServiceUnavailableException.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        )

    def test_exceptions_are_api_exceptions(self):
        assert issubclass(ValidationException, BaseAPIException)
        assert issubclass(PermissionDeniedException, BaseAPIException)


# ---------------------------------------------------------------------------
# Bulk serializers
# ---------------------------------------------------------------------------


class TestBulkSerializers:
    """Tests for bulk create/update serializer support."""

    def test_base_list_serializer_is_list_serializer(self):
        from apps.core.api.serializers import BaseListSerializer

        assert issubclass(BaseListSerializer, serializers.ListSerializer)

    def test_bulk_model_serializer_uses_list_serializer(self):
        from apps.core.api.serializers import BaseListSerializer, BulkModelSerializer

        assert BulkModelSerializer.Meta.list_serializer_class is BaseListSerializer

    def test_base_list_serializer_create_delegates_to_child(self):
        from apps.core.api.serializers import BaseListSerializer

        created = []

        class _Child(serializers.Serializer):
            def create(self, validated_data):
                created.append(validated_data)
                return validated_data

        list_serializer = BaseListSerializer(child=_Child())
        result = list_serializer.create([{"name": "a"}, {"name": "b"}])

        assert len(created) == 2
        assert result == [{"name": "a"}, {"name": "b"}]

    def test_base_list_serializer_update_requires_bulk_update(self):
        from apps.core.api.serializers import BaseListSerializer

        class _Child(serializers.Serializer):
            pass

        list_serializer = BaseListSerializer(child=_Child())

        with pytest.raises(NotImplementedError):
            list_serializer.update([], [])

    def test_base_list_serializer_update_delegates_to_child_bulk_update(self):
        from apps.core.api.serializers import BaseListSerializer

        updated = []

        class _Child(serializers.Serializer):
            def bulk_update(self, instance_list, validated_data):
                updated.append((instance_list, validated_data))
                return instance_list

        list_serializer = BaseListSerializer(child=_Child())
        result = list_serializer.update(["i1", "i2"], [{"name": "a"}])

        assert len(updated) == 1
        assert result == ["i1", "i2"]


# ---------------------------------------------------------------------------
# Bulk viewsets
# ---------------------------------------------------------------------------


class TestBulkViewSets:
    """Tests for bulk create/update ViewSet support."""

    def test_bulk_create_mixin_creates_many(self):
        from apps.core.api.viewsets import BulkCreateModelMixin

        created = []

        class _Serializer(serializers.Serializer):
            name = serializers.CharField()

            def create(self, validated_data):
                created.append(validated_data)
                return validated_data

        class _ViewSet(BulkCreateModelMixin):
            def get_serializer(self, *args, **kwargs):
                return _Serializer(*args, **kwargs)

            def get_success_headers(self, data):
                return {}

        request = Request(
            factory.post(
                "/",
                data=[{"name": "a"}, {"name": "b"}],
                content_type="application/json",
            ),
            parsers=[JSONParser()],
        )
        response = _ViewSet().create(request)

        assert response.status_code == status.HTTP_201_CREATED
        assert len(created) == 2

    def test_bulk_update_mixin_updates_many(self):
        from apps.core.api.serializers import BaseListSerializer
        from apps.core.api.viewsets import BulkUpdateModelMixin

        updated = []

        class _Serializer(serializers.Serializer):
            name = serializers.CharField()

            class Meta:
                list_serializer_class = BaseListSerializer

            def bulk_update(self, instance_list, validated_data):
                updated.append((instance_list, validated_data))
                return instance_list

        class _ViewSet(BulkUpdateModelMixin):
            def filter_queryset(self, queryset):
                return queryset

            def get_queryset(self):
                return [{"name": "i1"}, {"name": "i2"}]

            def get_serializer(self, *args, **kwargs):
                return _Serializer(*args, **kwargs)

        request = Request(
            factory.put(
                "/",
                data=[{"name": "a"}, {"name": "b"}],
                content_type="application/json",
            ),
            parsers=[JSONParser()],
        )
        response = _ViewSet().update(request)

        assert response.status_code == status.HTTP_200_OK
        assert len(updated) == 1

    def test_bulk_model_view_set_inherits_crud(self):
        from apps.core.api.viewsets import BulkModelViewSet

        assert hasattr(BulkModelViewSet, "create")
        assert hasattr(BulkModelViewSet, "list")
        assert hasattr(BulkModelViewSet, "retrieve")
        assert hasattr(BulkModelViewSet, "update")
        assert hasattr(BulkModelViewSet, "partial_update")
        assert hasattr(BulkModelViewSet, "destroy")
