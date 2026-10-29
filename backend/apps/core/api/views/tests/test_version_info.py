"""Tests for the public version endpoint."""

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


class TestVersionInfo:
    def test_version_endpoint_returns_version_and_environment(self, api_client, db):
        res = api_client.get("/api/v1/info/version/")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data["version"], str) and data["version"]
        assert isinstance(data["environment"], str) and data["environment"]
