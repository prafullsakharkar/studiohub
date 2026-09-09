"""
Tests for the global DRF exception handler and the JSON 500 view.
"""

from __future__ import annotations

import json

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.test import RequestFactory

from apps.core.api.exceptions.handlers import custom_exception_handler
from apps.core.exceptions.base import DuplicateException
from config.urls import server_error


def _context():
    return {"request": RequestFactory().get("/")}


class TestCustomExceptionHandler:
    def test_django_validation_error_maps_to_400(self):
        response = custom_exception_handler(
            DjangoValidationError("Expiry date cannot be earlier."),
            _context(),
        )

        assert response.status_code == 400
        assert "non_field_errors" in response.data

    def test_integrity_error_maps_to_409(self):
        response = custom_exception_handler(
            IntegrityError('duplicate key value violates unique constraint "uq_x"'),
            _context(),
        )

        assert response.status_code == 409
        assert "detail" in response.data

    def test_duplicate_exception_maps_to_409(self):
        response = custom_exception_handler(
            DuplicateException(model_name="Role", field="code", value="X"),
            _context(),
        )

        assert response.status_code == 409
        assert "X" in response.data["detail"]

    def test_unknown_exception_maps_to_500_json(self):
        response = custom_exception_handler(ValueError("boom"), _context())

        assert response.status_code == 500
        assert response.data == {"detail": "Internal server error."}


class TestServerErrorView:
    def test_handler500_returns_json(self):
        response = server_error(RequestFactory().get("/"))

        assert response.status_code == 500
        assert json.loads(response.content) == {"detail": "Internal server error."}
