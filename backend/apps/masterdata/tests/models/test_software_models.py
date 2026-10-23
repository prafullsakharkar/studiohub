"""DB-level rules of Software and SoftwareVersion (DOM-MD-SW-01..07)."""

from __future__ import annotations

import datetime

import pytest
from django.db import IntegrityError, models, transaction

from apps.masterdata.models import CatalogStatus, Software, SoftwareVersion
from apps.masterdata.tests.factories import SoftwareFactory, SoftwareVersionFactory

pytestmark = pytest.mark.django_db


def D(y, m=1, d=1):
    return datetime.date(y, m, d)


class TestSoftware:
    def test_code_is_unique_case_insensitively(self):
        SoftwareFactory(code="Maya", name="Maya")
        with pytest.raises(IntegrityError), transaction.atomic():
            SoftwareFactory(code="MAYA", name="Another")

    def test_name_is_unique_case_insensitively(self):
        SoftwareFactory(code="a", name="Nuke")
        with pytest.raises(IntegrityError), transaction.atomic():
            SoftwareFactory(code="b", name="NUKE")

    def test_a_soft_deleted_code_can_be_reused(self):
        SoftwareFactory(code="hou", name="Houdini").delete()
        SoftwareFactory(code="hou", name="Houdini")

    def test_status_outside_the_enum_is_rejected(self):
        with pytest.raises(IntegrityError), transaction.atomic():
            SoftwareFactory(status="banana")

    def test_defaults(self):
        row = SoftwareFactory()
        assert (row.status, row.is_system, row.sort_order) == (CatalogStatus.ACTIVE, False, 0)

    def test_the_version_count_property_is_gone(self):
        """It issued one query per row; the selector annotates it instead."""
        assert not hasattr(Software, "version_count")


class TestVersionUniqueness:
    def test_version_is_unique_per_software_case_insensitively(self):
        software = SoftwareFactory()
        SoftwareVersionFactory(software=software, version="2025A")
        with pytest.raises(IntegrityError), transaction.atomic():
            SoftwareVersionFactory(software=software, version="2025a")

    def test_the_same_version_may_exist_under_two_softwares(self):
        SoftwareVersionFactory(version="2025")
        SoftwareVersionFactory(version="2025")

    def test_code_and_name_are_unique_per_software_not_globally(self):
        a, b = SoftwareFactory(), SoftwareFactory()
        SoftwareVersionFactory(software=a, code="v1", name="Release 1")
        SoftwareVersionFactory(software=b, code="V1", name="release 1")  # other software: fine
        with pytest.raises(IntegrityError), transaction.atomic():
            SoftwareVersionFactory(software=a, code="V1", name="Other")
        with pytest.raises(IntegrityError), transaction.atomic():
            SoftwareVersionFactory(software=a, code="v2", name="RELEASE 1")

    def test_a_soft_deleted_version_does_not_block_its_slot(self):
        software = SoftwareFactory()
        SoftwareVersionFactory(software=software, version="1", code="c", name="n").delete()
        SoftwareVersionFactory(software=software, version="1", code="c", name="n")


class TestVersionRules:
    def test_end_of_support_cannot_precede_release(self):
        with pytest.raises(IntegrityError), transaction.atomic():
            SoftwareVersionFactory(release_date=D(2025), end_of_support=D(2024))

    @pytest.mark.parametrize(
        ("release", "support"),
        [(D(2025), D(2025)), (D(2025), D(2027)), (D(2025), None), (None, D(2020)), (None, None)],
    )
    def test_valid_date_combinations(self, release, support):
        SoftwareVersionFactory(release_date=release, end_of_support=support)

    def test_a_software_with_versions_cannot_be_hard_deleted(self):
        version = SoftwareVersionFactory()
        with pytest.raises(models.ProtectedError):
            models.Model.delete(version.software)

    def test_status_outside_the_enum_is_rejected(self):
        with pytest.raises(IntegrityError), transaction.atomic():
            SoftwareVersionFactory(status="banana")

    def test_is_system_and_sort_order_exist_with_defaults(self):
        row = SoftwareVersionFactory()
        assert (row.is_system, row.sort_order) == (False, 0)


class TestVersionKeyAndOrdering:
    def test_the_key_follows_the_version_on_create_and_update(self):
        row = SoftwareVersionFactory(version="10")
        assert row.version_key == "000000000010"
        row.version = "9"
        row.save(update_fields=["version"])
        row.refresh_from_db()
        assert row.version_key == "000000000009"

    def test_default_order_is_newest_release_then_undated_in_natural_order(self):
        software = SoftwareFactory()
        for version, release in [
            ("9", None),
            ("10", None),
            ("2024", D(2024)),
            ("2025", D(2025)),
            ("2025.2", D(2025)),
            ("2025.10", D(2025)),
        ]:
            SoftwareVersionFactory(software=software, version=version, release_date=release)

        ordered = list(
            SoftwareVersion.objects.filter(software=software).values_list("version", flat=True)
        )

        # Undated rows come last (not first, as a bare DESC sort would put them).
        assert ordered == ["2025.10", "2025.2", "2025", "2024", "10", "9"]


class TestDeprecation:
    def test_active_version_without_an_end_date_is_not_deprecated(self):
        assert SoftwareVersionFactory().is_deprecated is False

    def test_past_end_of_support_is_deprecated(self):
        assert SoftwareVersionFactory(end_of_support=D(2000)).is_deprecated is True

    def test_future_end_of_support_is_not_deprecated(self):
        future = datetime.date.today() + datetime.timedelta(days=365)
        assert SoftwareVersionFactory(end_of_support=future).is_deprecated is False

    def test_an_archived_version_is_deprecated(self):
        assert SoftwareVersionFactory(status="archived").is_deprecated is True
