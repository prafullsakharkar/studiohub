"""
Deliveries test fixtures.
"""
from __future__ import annotations

import pytest


@pytest.fixture
def delivery_data():
    """Delivery data for testing."""
    return {
        "name": "Test Delivery",
        "code": "DEL-TEST-001",
        "delivery_method": "S3",
        "delivery_destination": "s3://bucket/path",
    }
