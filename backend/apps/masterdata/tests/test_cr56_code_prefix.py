"""CR-56: a NEW studio record's code starts with its kind's prefix (DEPT-, TEAM-, POS-, OFF-, CLI-, VEN-).

The rule is checked on create only, in the shared create path (``DirectoryService._require_code_prefix``), before the
uniqueness check. Update and restore do not check it, so a record made before the rule stays editable.
"""

from __future__ import annotations

from typing import Any

import pytest
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import MasterdataPermissions as P
from apps.masterdata.services.directory import DirectoryService
from apps.masterdata.services.organization import (
    DepartmentService,
    OfficeService,
    PositionService,
    TeamService,
)
from apps.masterdata.services.partner import ClientService, VendorService
from apps.masterdata.tests.factories import (
    ClientFactory,
    DepartmentFactory,
    OfficeFactory,
    PositionFactory,
    TeamFactory,
    VendorFactory,
)

pytestmark = pytest.mark.django_db

API = "/api/v1"

OFFICE = {"office_type": "studio", "timezone": "Asia/Kolkata", "country": "India", "city": "Pune"}

#: (service, route, prefix, what else a create needs, factory, the code's length limit)
KINDS: list[tuple[type[DirectoryService[Any]], str, str, Any, Any, int]] = [
    (DepartmentService, "departments", "DEPT-", lambda: {"department_type": "creative"}, DepartmentFactory, 30),
    (TeamService, "teams", "TEAM-", lambda: {"department": DepartmentFactory()}, TeamFactory, 30),
    (PositionService, "positions", "POS-", dict, PositionFactory, 30),
    (OfficeService, "offices", "OFF-", lambda: dict(OFFICE), OfficeFactory, 30),
    (ClientService, "clients", "CLI-", dict, ClientFactory, 20),
    (VendorService, "vendors", "VEN-", dict, VendorFactory, 20),
]  # fmt: skip
IDS = [k[1] for k in KINDS]


def create(service, extra, code, name="Studio record"):
    return service.create(actor=None, data={"code": code, "name": name, **extra()})


def message(service, prefix):
    return [f"{service.label} codes start with {prefix}."]


@pytest.mark.parametrize(
    ("service", "route", "prefix", "extra", "factory", "limit"), KINDS, ids=IDS
)
class TestCreate:
    def test_a_bare_code_is_refused(self, service, route, prefix, extra, factory, limit):
        with pytest.raises(ValidationError) as caught:
            create(service, extra, "LGT")
        assert caught.value.message_dict == {"code": message(service, prefix)}
        assert not service.model.objects.filter(name="Studio record").exists()

    def test_the_prefix_alone_is_refused(self, service, route, prefix, extra, factory, limit):
        with pytest.raises(ValidationError) as caught:
            create(service, extra, prefix)
        assert caught.value.message_dict == {"code": message(service, prefix)}

    def test_a_prefixed_code_in_any_case_is_kept_as_written(
        self, service, route, prefix, extra, factory, limit
    ):
        row = create(service, extra, f" {prefix.lower()}lgt ")
        assert row.code == f"{prefix.lower()}lgt"

    def test_only_the_full_prefix_counts(self, service, route, prefix, extra, factory, limit):
        with pytest.raises(ValidationError):
            create(service, extra, f"{prefix[:-1]}LGT")  # no hyphen: DEPTLGT

    def test_the_prefix_counts_towards_the_length(
        self, service, route, prefix, extra, factory, limit
    ):
        fits = f"{prefix}{'X' * (limit - len(prefix))}"
        assert create(service, extra, fits).code == fits
        with pytest.raises(ValidationError) as caught:
            create(service, extra, f"{fits}X", name="Too long")
        assert "code" in caught.value.message_dict

    def test_the_prefix_is_checked_before_the_duplicate(
        self, service, route, prefix, extra, factory, limit
    ):
        factory(code="LGT")  # made before the rule
        with pytest.raises(ValidationError) as caught:
            create(service, extra, "lgt")
        assert caught.value.message_dict["code"] == message(service, prefix)


@pytest.mark.parametrize(
    ("service", "route", "prefix", "extra", "factory", "limit"), KINDS, ids=IDS
)
class TestExistingRecords:
    def test_a_record_made_before_the_rule_stays_editable(
        self, service, route, prefix, extra, factory, limit
    ):
        row = factory(code="OLD")
        service.update(actor=None, instance=row, data={"name": "Renamed"})
        service.update(actor=None, instance=row, data={"code": "OLD2"})
        row.refresh_from_db()
        assert (row.name, row.code) == ("Renamed", "OLD2")

    def test_a_record_made_before_the_rule_can_be_restored(
        self, service, route, prefix, extra, factory, limit
    ):
        row = factory(code="OLD")
        service.soft_delete(actor=None, instance=row)
        restored = service.restore(actor=None, instance=service.model.all_objects.get(pk=row.pk))
        assert restored.code == "OLD" and not restored.is_deleted


@pytest.mark.parametrize(
    ("service", "route", "prefix", "extra", "factory", "limit"), KINDS, ids=IDS
)
def test_the_api_answers_400_on_the_code(service, route, prefix, extra, factory, limit):
    user = UserFactory.create()
    grant_permissions(user, P.DIRECTORY_MANAGE, P.PARTNER_VIEW)
    api = APIClient(raise_request_exception=False)
    api.force_authenticate(user=user)
    body = {key: getattr(value, "pk", value) for key, value in extra().items()}

    bare = api.post(f"{API}/{route}/", {"code": "LGT", "name": "Bare", **body}, format="json")
    assert bare.status_code == 400, bare.content
    assert bare.json()["code"] == message(service, prefix)

    made = api.post(
        f"{API}/{route}/", {"code": f"{prefix}LGT", "name": "Prefixed", **body}, format="json"
    )
    assert made.status_code == 201, made.content
    assert made.json()["code"] == f"{prefix}LGT"
