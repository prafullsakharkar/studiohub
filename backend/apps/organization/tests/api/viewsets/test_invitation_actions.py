"""
Invitation accept/decline authorization: invitee self-service vs admin flow.
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.constants.permissions import InvitationPermissions
from apps.organization.tests.factories import (
    InvitationFactory,
    OrganizationFactory,
    OrganizationMembershipFactory,
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
)
from apps.organization.tests.rbac_helpers import grant_permissions


def _hdr(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _accept_url(invitation):
    return reverse(
        "api:v1:organization:invitation-accept",
        kwargs={"uuid": str(invitation.id)},
    )


def _decline_url(invitation):
    return reverse(
        "api:v1:organization:invitation-decline",
        kwargs={"uuid": str(invitation.id)},
    )


def _grant_invite_update(user, org):
    role = RoleFactory.create(organization=org)
    permission = PermissionFactory.create(code=InvitationPermissions.UPDATE)
    RolePermissionFactory.create(role=role, permission=permission, granted=True)
    OrganizationMembershipFactory.create(user=user, organization=org, role=role)


@pytest.mark.django_db
class TestInvitationAcceptDecline:
    def test_invitee_can_accept_own_invitation(self):
        org = OrganizationFactory.create()
        invitee = UserFactory.create(email="invitee@example.com")
        invitation = InvitationFactory.create(
            organization=org, email="invitee@example.com", status="pending"
        )
        client = _client_for(invitee)
        response = client.post(_accept_url(invitation), **_hdr(org))
        assert response.status_code == 200, response.data
        invitation.refresh_from_db()
        assert invitation.status == "accepted"

    def test_invitee_can_decline_own_invitation(self):
        org = OrganizationFactory.create()
        invitee = UserFactory.create(email="decliner@example.com")
        invitation = InvitationFactory.create(
            organization=org, email="decliner@example.com", status="pending"
        )
        client = _client_for(invitee)
        response = client.post(_decline_url(invitation), **_hdr(org))
        assert response.status_code == 200, response.data
        invitation.refresh_from_db()
        assert invitation.status == "declined"

    def test_member_without_update_grant_forbidden(self):
        from apps.organization.tests.factories import OrganizationMembershipFactory

        org = OrganizationFactory.create()
        member = UserFactory.create(email="member@example.com")
        OrganizationMembershipFactory.create(user=member, organization=org)
        invitation = InvitationFactory.create(
            organization=org, email="someone@example.com", status="pending"
        )
        client = _client_for(member)
        # Visible via organization scope, but neither invitee nor grant holder.
        response = client.post(_accept_url(invitation), **_hdr(org))
        assert response.status_code == 403, response.data
        invitation.refresh_from_db()
        assert invitation.status == "pending"

    def test_stranger_without_grant_cannot_accept(self):
        org = OrganizationFactory.create()
        stranger = UserFactory.create(email="stranger@example.com")
        invitation = InvitationFactory.create(
            organization=org, email="someone@example.com", status="pending"
        )
        client = _client_for(stranger)
        response = client.post(_accept_url(invitation), **_hdr(org))
        # Non-invitees cannot even see the invitation (existence concealed).
        assert response.status_code == 404, response.data
        invitation.refresh_from_db()
        assert invitation.status == "pending"

    def test_admin_with_update_grant_can_accept(self):
        org = OrganizationFactory.create()
        admin = UserFactory.create(email="admin@example.com")
        _grant_invite_update(admin, org)
        invitation = InvitationFactory.create(
            organization=org, email="member@example.com", status="pending"
        )
        client = _client_for(admin)
        response = client.post(_accept_url(invitation), **_hdr(org))
        assert response.status_code == 200, response.data

    def test_helper_grant_path(self):
        org = OrganizationFactory.create()
        admin = UserFactory.create(email="helper@example.com")
        grant_permissions(admin, InvitationPermissions.UPDATE, organization=org)
        invitation = InvitationFactory.create(
            organization=org, email="other@example.com", status="pending"
        )
        client = _client_for(admin)
        response = client.post(_decline_url(invitation), **_hdr(org))
        assert response.status_code == 200, response.data
