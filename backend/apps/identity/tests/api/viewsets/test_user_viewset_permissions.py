"""
User lifecycle + IP blacklist action permission tests.

Lifecycle/admin mutations require explicit permissions (staff bypasses);
member-directory reads (list/retrieve/me) stay open to any authenticated
user by deliberate contract decision (see permission_map note in UserViewSet).
"""

from __future__ import annotations

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.identity.tests.factories import IPBlacklistFactory, UserFactory


@pytest.mark.django_db
class TestUserLifecyclePermissions:
    @pytest.mark.parametrize(
        "action",
        ["activate", "deactivate", "archive", "restore"],
    )
    def test_lifecycle_actions_forbidden_for_regular_user(
        self, authenticated_client, action
    ):
        user = UserFactory.create()
        response = authenticated_client.post(
            reverse(
                f"api:v1:identity:user-{action}",
                kwargs={"pk": user.id},
            ),
        )
        assert response.status_code == 403

    @pytest.mark.parametrize(
        "action",
        ["activate", "deactivate", "archive", "restore"],
    )
    def test_lifecycle_actions_allowed_for_staff(self, staff_client, action):
        user = UserFactory.create()
        response = staff_client.post(
            reverse(
                f"api:v1:identity:user-{action}",
                kwargs={"pk": user.id},
            ),
        )
        assert response.status_code == 200

    def test_user_list_open_to_authenticated(self, authenticated_client):
        response = authenticated_client.get(reverse("api:v1:identity:user-list"))
        assert response.status_code == 200


@pytest.mark.django_db
class TestIPBlacklistActionPermissions:
    @pytest.mark.parametrize(
        "action",
        ["activate", "deactivate", "expire"],
    )
    def test_blacklist_actions_forbidden_for_regular_user(
        self, authenticated_client, action
    ):
        entry = IPBlacklistFactory.create()
        response = authenticated_client.post(
            reverse(
                f"api:v1:identity:ip-blacklist-{action}",
                kwargs={"pk": entry.id},
            ),
            {"expires_at": timezone.now().isoformat()},
        )
        assert response.status_code == 403

    def test_blacklist_activate_allowed_for_staff(self, staff_client):
        entry = IPBlacklistFactory.create()
        response = staff_client.post(
            reverse(
                "api:v1:identity:ip-blacklist-activate",
                kwargs={"pk": entry.id},
            ),
        )
        assert response.status_code == 200

    def test_blacklist_deactivate_allowed_for_staff(self, staff_client):
        entry = IPBlacklistFactory.create()
        response = staff_client.post(
            reverse(
                "api:v1:identity:ip-blacklist-deactivate",
                kwargs={"pk": entry.id},
            ),
        )
        assert response.status_code == 200

    def test_blacklist_expire_allowed_for_staff(self, staff_client):
        entry = IPBlacklistFactory.create()
        response = staff_client.post(
            reverse(
                "api:v1:identity:ip-blacklist-expire",
                kwargs={"pk": entry.id},
            ),
            {"expires_at": timezone.now().isoformat()},
        )
        assert response.status_code == 200

        entry.refresh_from_db()
        assert entry.expires_at is not None
