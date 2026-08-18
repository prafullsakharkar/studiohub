# tests/factories.py
"""
Factory Boy factories for Audit application tests.
"""

from __future__ import annotations

import factory
from factory.django import DjangoModelFactory

from apps.audit.models.activity import Activity
from apps.audit.models.api_request import APIRequest
from apps.audit.models.audit_log import AuditLog
from apps.audit.models.background_job import BackgroundJob
from apps.audit.models.change_log import ChangeLog
from apps.audit.models.error_log import ErrorLog
from apps.audit.models.login_history import LoginHistory
from apps.audit.models.track import Track
from apps.identity.tests.factories import UserFactory
from apps.organization.tests.factories import OrganizationFactory


class AuditLogFactory(DjangoModelFactory):
    """Factory for AuditLog model."""

    class Meta:
        model = AuditLog

    organization = factory.SubFactory(OrganizationFactory)
    actor = factory.SubFactory(UserFactory)
    action = factory.Faker(
        "random_element",
        elements=[
            AuditLog.ACTION_CREATE,
            AuditLog.ACTION_UPDATE,
            AuditLog.ACTION_DELETE,
            AuditLog.ACTION_LOGIN,
            AuditLog.ACTION_LOGOUT,
        ],
    )
    target_type = factory.Faker("word")
    target_id = factory.Faker("uuid4")
    target_name = factory.Faker("word")
    description = factory.Faker("text", max_nb_chars=200)
    ip_address = factory.Faker("ipv4")
    user_agent = factory.Faker("user_agent")
    metadata = factory.Faker("json")


class ActivityFactory(DjangoModelFactory):
    """Factory for Activity model."""

    class Meta:
        model = Activity

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    activity_type = factory.Faker(
        "random_element",
        elements=[
            Activity.TYPE_PAGE_VIEW,
            Activity.TYPE_FEATURE_USAGE,
            Activity.TYPE_INTERACTION,
        ],
    )
    status = factory.Faker(
        "random_element",
        elements=[Activity.STATUS_SUCCESS, Activity.STATUS_FAILED],
    )
    description = factory.Faker("text", max_nb_chars=200)
    ip_address = factory.Faker("ipv4")
    user_agent = factory.Faker("user_agent")
    duration_seconds = factory.Faker("random_int", min=1, max=600)
    metadata = factory.Faker("json")


class APIRequestFactory(DjangoModelFactory):
    """Factory for APIRequest model."""

    class Meta:
        model = APIRequest

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    method = factory.Faker(
        "random_element", elements=["GET", "POST", "PUT", "PATCH", "DELETE"]
    )
    path = factory.Faker("uri_path")
    status_code = factory.Faker("random_int", min=100, max=599)
    response_time_ms = factory.Faker("random_int", min=1, max=10000)
    ip_address = factory.Faker("ipv4")
    user_agent = factory.Faker("user_agent")
    api_version = factory.Faker("word")
    request_body = factory.Faker("json")
    response_body = factory.Faker("json")
    error_message = factory.Faker("text", max_nb_chars=200)


class BackgroundJobFactory(DjangoModelFactory):
    """Factory for BackgroundJob model."""

    class Meta:
        model = BackgroundJob

    organization = factory.SubFactory(OrganizationFactory)
    job_type = factory.Faker(
        "random_element",
        elements=["email", "sms", "push", "report", "cleanup", "sync"],
    )
    status = factory.Faker(
        "random_element",
        elements=[
            BackgroundJob.STATUS_QUEUED,
            BackgroundJob.STATUS_COMPLETED,
            BackgroundJob.STATUS_FAILED,
        ],
    )
    job_id = factory.Faker("uuid4")
    progress = factory.Faker("random_int", min=0, max=100)
    started_at = factory.Faker("date_time_this_year")
    completed_at = factory.Faker("date_time_this_year")
    result_data = factory.Faker("json")
    error_message = factory.Faker("text", max_nb_chars=200)


class ChangeLogFactory(DjangoModelFactory):
    """Factory for ChangeLog model."""

    class Meta:
        model = ChangeLog

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    change_type = factory.Faker(
        "random_element",
        elements=[
            ChangeLog.CHANGE_CREATE,
            ChangeLog.CHANGE_UPDATE,
            ChangeLog.CHANGE_DELETE,
        ],
    )
    target_type = factory.Faker("word")
    target_id = factory.Faker("uuid4")
    target_name = factory.Faker("word")
    before_values = factory.Faker("json")
    after_values = factory.Faker("json")
    changed_fields = factory.Faker("json")
    description = factory.Faker("text", max_nb_chars=200)


class ErrorLogFactory(DjangoModelFactory):
    """Factory for ErrorLog model."""

    class Meta:
        model = ErrorLog

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    error_type = factory.Faker(
        "random_element",
        elements=["validation", "permission", "not_found", "server", "timeout"],
    )
    severity = factory.Faker(
        "random_element",
        elements=[
            ErrorLog.SEVERITY_INFO,
            ErrorLog.SEVERITY_WARNING,
            ErrorLog.SEVERITY_ERROR,
            ErrorLog.SEVERITY_CRITICAL,
        ],
    )
    message = factory.Faker("text", max_nb_chars=500)
    stack_trace = factory.Faker("text", max_nb_chars=2000)
    ip_address = factory.Faker("ipv4")
    user_agent = factory.Faker("user_agent")
    request_path = factory.Faker("uri_path")
    request_method = factory.Faker(
        "random_element", elements=["GET", "POST", "PUT", "PATCH", "DELETE"]
    )
    context_data = factory.Faker("json")
    resolved = False
    error_code = factory.Faker("word")


class LoginHistoryFactory(DjangoModelFactory):
    """Factory for LoginHistory model."""

    class Meta:
        model = LoginHistory

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    login_type = factory.Faker(
        "random_element",
        elements=[
            LoginHistory.TYPE_LOGIN,
            LoginHistory.TYPE_LOGOUT,
            LoginHistory.TYPE_DEVICE_LOGIN,
        ],
    )
    login_method = factory.Faker(
        "random_element", elements=["password", "oauth", "sso", "api_key"]
    )
    status = factory.Faker(
        "random_element",
        elements=[
            LoginHistory.STATUS_SUCCESS,
            LoginHistory.STATUS_FAILED,
            LoginHistory.STATUS_EXPIRED,
        ],
    )
    ip_address = factory.Faker("ipv4")
    user_agent = factory.Faker("user_agent")
    mfa_enabled = factory.Faker("boolean")
    failure_reason = factory.Faker("text", max_nb_chars=200)
    session_id = factory.Faker("uuid4")
    browser = factory.Faker("word")


class TrackFactory(DjangoModelFactory):
    """Factory for Track model."""

    class Meta:
        model = Track

    organization = factory.SubFactory(OrganizationFactory)
    user = factory.SubFactory(UserFactory)
    event_type = factory.Faker(
        "random_element",
        elements=[
            Track.EVENT_PAGE_VIEW,
            Track.EVENT_CLICK,
            Track.EVENT_FORM_SUBMIT,
        ],
    )
    event_name = factory.Faker("word")
    session_id = factory.Faker("uuid4")
    page_url = factory.Faker("uri")
    page_title = factory.Faker("word")
    element_id = factory.Faker("uuid4")
    element_text = factory.Faker("word")
    metadata = factory.Faker("json")
