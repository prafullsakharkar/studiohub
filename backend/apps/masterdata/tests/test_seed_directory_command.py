"""``seed_directory`` fills the studio directory once, without touching what is already there."""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command

from apps.masterdata.management.commands import seed_directory as data
from apps.masterdata.models import Client, Department, Office, Position, Vendor

pytestmark = pytest.mark.django_db


def run(*args: str) -> str:
    out = StringIO()
    call_command("seed_directory", *args, stdout=out)
    return out.getvalue()


def test_it_creates_every_department_and_position():
    run()

    assert Department.objects.count() == len(data.DEPARTMENTS)
    assert Position.objects.count() == len(data.POSITIONS)


def test_every_position_has_its_department_and_a_level():
    run()

    for code, _name, department_code, level, managerial in data.POSITIONS:
        position = Position.objects.get(code=code)
        assert position.department is not None and position.department.code == department_code
        assert (position.level, position.is_managerial) == (level, managerial)


def test_running_again_creates_nothing():
    run()
    counts = (Department.objects.count(), Position.objects.count())

    output = run()

    assert (Department.objects.count(), Position.objects.count()) == counts
    assert "departments: created 0" in output and "positions: created 0" in output
    for kind in ("offices", "clients", "vendors"):
        assert f"{kind}: created 0" in output


def test_dry_run_changes_nothing_and_counts():
    output = run("--dry-run")

    assert Department.objects.count() == 0 and Position.objects.count() == 0
    assert f"departments: would create {len(data.DEPARTMENTS)}" in output
    assert f"positions: would create {len(data.POSITIONS)}" in output
    assert Office.objects.count() == Client.objects.count() == Vendor.objects.count() == 0
    assert f"offices: would create {len(data.OFFICES)}" in output
    assert f"clients: would create {len(data.CLIENTS)}" in output
    assert f"vendors: would create {len(data.VENDORS)}" in output


def test_rows_from_init_platform_are_kept_not_duplicated():
    call_command("init_platform", stdout=StringIO())
    seeded = Department.objects.filter(code="DEPT-COMP").get()

    run()

    assert Department.objects.filter(code__iexact="DEPT-COMP").count() == 1
    assert Department.objects.get(code="DEPT-COMP").pk == seeded.pk
    assert Position.objects.filter(code="POS-ARTIST").count() == 1  # init_platform's, not ours


def test_a_row_edited_by_hand_is_not_overwritten():
    run()
    Department.objects.filter(code="DEPT-PROD").update(name="Studio Production")

    run()

    assert Department.objects.get(code="DEPT-PROD").name == "Studio Production"
    assert Department.all_objects.filter(code__iexact="DEPT-PROD").count() == 1


def test_a_position_deleted_by_hand_is_not_brought_back():
    run()
    Position.objects.get(code="POS-EDITOR").delete()

    run()

    assert not Position.objects.filter(code="POS-EDITOR").exists()


def test_it_creates_every_office_client_and_vendor():
    run()

    assert set(Office.objects.values_list("code", flat=True)) == {o["code"] for o in data.OFFICES}
    assert set(Client.objects.values_list("code", flat=True)) == {c["code"] for c in data.CLIENTS}
    assert set(Vendor.objects.values_list("code", flat=True)) == {v["code"] for v in data.VENDORS}
    assert Vendor.objects.get(code="VEN-CNV").status == "Under Review"
    assert Client.objects.get(code="CLI-LAN").portal_access is False


def test_no_seeded_office_takes_the_headquarters():
    from apps.masterdata.services.organization import OfficeService

    headquarters = OfficeService.create(
        actor=None,
        data={
            "code": "OFF-HQ",
            "name": "Studio Headquarters",
            "office_type": "headquarters",
            "timezone": "Asia/Kolkata",
            "country": "India",
            "city": "Mumbai",
            "is_headquarters": True,
        },
    )

    run()

    assert list(Office.objects.filter(is_headquarters=True)) == [headquarters]


def test_an_office_already_there_by_code_is_kept():
    Office.objects.create(
        code="off-mum", name="Our Mumbai", office_type="branch", timezone="UTC",
        country="India", city="Mumbai",
    )  # fmt: skip

    run()

    assert Office.all_objects.filter(code__iexact="OFF-MUM").count() == 1
    assert Office.objects.get(code__iexact="OFF-MUM").name == "Our Mumbai"
