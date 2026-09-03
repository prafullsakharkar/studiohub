"""
Security tests for organization context resolution.

Malformed organization identifiers (e.g. a non-UUID ``X-Organization-Id``
header) must resolve to no organization context instead of raising a
server error.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.test import RequestFactory, TestCase

from apps.identity.tests.factories import UserFactory
from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)


class OrganizationContextResolutionTests(TestCase):
    """Tests for resolve_organization_context robustness."""

    def setUp(self) -> None:
        self.factory = RequestFactory()
        self.user = UserFactory.create()
        self.organization = OrganizationFactory.create()
        OrganizationMembershipFactory.create(
            organization=self.organization,
            user=self.user,
        )

    def _request(self, org_id: str | None):
        headers = {} if org_id is None else {"HTTP_X_ORGANIZATION_ID": org_id}
        request = self.factory.get("/api/v1/projects/", **headers)
        request.user = self.user
        return request

    def test_valid_header_resolves_organization(self) -> None:
        request = self._request(str(self.organization.id))

        resolved = resolve_organization_context(request)
        assert resolved == self.organization
        assert request.organization == self.organization
        assert request.membership is not None

    def test_malformed_header_resolves_to_no_organization(self) -> None:
        for value in ("Organization 0", "not-a-uuid", "'; DROP TABLE x"):
            with self.subTest(value=value):
                request = self._request(value)

                assert resolve_organization_context(request) is None
                assert request.organization is None
                assert request.membership is None

    def test_unknown_uuid_resolves_to_no_organization(self) -> None:
        request = self._request(
            "00000000-0000-0000-0000-000000000000"
        )

        assert resolve_organization_context(request) is None

    def test_missing_header_resolves_to_no_organization(self) -> None:
        request = self._request(None)

        assert resolve_organization_context(request) is None

    def test_unauthenticated_user_resolves_to_no_organization(self) -> None:
        from django.contrib.auth.models import AnonymousUser

        request = self.factory.get(
            "/", HTTP_X_ORGANIZATION_ID=str(self.organization.id)
        )
        request.user = AnonymousUser()

        assert resolve_organization_context(request) is None

    def test_validation_error_from_lookup_is_contained(self) -> None:
        """A UUIDField ValidationError must not propagate to callers."""
        request = self._request("12345")

        try:
            result = resolve_organization_context(request)
        except ValidationError:
            self.fail("ValidationError leaked out of context resolution")
        assert result is None
