import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.organization.models import Permission, Role
from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)


@pytest.mark.django_db
def test_probe_role_crud():
    user = UserFactory.create(is_staff=True, is_superuser=True)
    org = OrganizationFactory.create()
    OrganizationMembershipFactory.create(user=user, organization=org)
    Permission.objects.get_or_create(code="projects:read", defaults={"name": "pr", "module": "projects", "action": "read"})
    Permission.objects.get_or_create(code="shots:read", defaults={"name": "sr", "module": "shots", "action": "read"})
    client = APIClient()
    client.force_authenticate(user=user)
    hdr = {"HTTP_X_ORGANIZATION_ID": str(org.id)}
    r = client.post("/api/v1/roles/", {"name": "Probe Role", "permissions": ["projects:read"]}, format="json", **hdr)
    print("\nCREATE ->", r.status_code, str(getattr(r, "data", ""))[:200])
    if r.status_code == 201:
        rid = r.data["id"]
        r2 = client.patch(f"/api/v1/roles/{rid}/", {"permissions": ["shots:read"]}, format="json", **hdr)
        print("PATCH ->", r2.status_code, str(getattr(r2, "data", ""))[:200])
        role = Role.objects.get(pk=rid)
        print("GRANTS:", sorted(role.role_permissions.values_list("permission__code", flat=True)))
