# tests/fixtures.py
"""
Test fixtures for Audit application.
"""

from __future__ import annotations

import pytest

from apps.audit.tests.factories import (
    ActivityFactory,
    APIRequestFactory,
    AuditLogFactory,
    BackgroundJobFactory,
    ChangeLogFactory,
    ErrorLogFactory,
    LoginHistoryFactory,
    TrackFactory,
)


@pytest.fixture
def audit_log(db) -> AuditLogFactory:
    """Create an audit log instance."""
    return AuditLogFactory()


@pytest.fixture
def activity(db) -> ActivityFactory:
    """Create an activity instance."""
    return ActivityFactory()


@pytest.fixture
def api_request(db) -> APIRequestFactory:
    """Create an API request instance."""
    return APIRequestFactory()


@pytest.fixture
def background_job(db) -> BackgroundJobFactory:
    """Create a background job instance."""
    return BackgroundJobFactory()


@pytest.fixture
def change_log(db) -> ChangeLogFactory:
    """Create a change log instance."""
    return ChangeLogFactory()


@pytest.fixture
def error_log(db) -> ErrorLogFactory:
    """Create an error log instance."""
    return ErrorLogFactory()


@pytest.fixture
def login_history(db) -> LoginHistoryFactory:
    """Create a login history instance."""
    return LoginHistoryFactory()


@pytest.fixture
def track(db) -> TrackFactory:
    """Create a track instance."""
    return TrackFactory()
