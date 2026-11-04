"""``seed_catalog`` fills every catalog tab, once, without touching what is already there."""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command

from apps.masterdata.management.commands import seed_catalog as data
from apps.masterdata.models import (
    MasterAssetType,
    MasterFileType,
    MasterReviewType,
    MasterShotType,
    MasterStatus,
    MasterTaskType,
    Software,
    SoftwareVersion,
)

pytestmark = pytest.mark.django_db


def run(*args: str) -> str:
    out = StringIO()
    call_command("seed_catalog", *args, stdout=out)
    return out.getvalue()


def counts():
    return {
        model.__name__: model.objects.count()
        for model in (
            Software,
            SoftwareVersion,
            MasterStatus,
            MasterTaskType,
            MasterAssetType,
            MasterShotType,
            MasterReviewType,
            MasterFileType,
        )
    }


def test_it_fills_every_tab():
    before = counts()

    output = run()

    after = counts()
    assert after["Software"] - before["Software"] == len(data.SOFTWARE)
    assert after["SoftwareVersion"] - before["SoftwareVersion"] == len(data.SOFTWARE_VERSIONS)
    assert after["MasterStatus"] - before["MasterStatus"] == len(data.STATUSES)
    assert after["MasterTaskType"] - before["MasterTaskType"] == len(data.TASK_TYPES)
    assert after["MasterAssetType"] - before["MasterAssetType"] == len(data.ASSET_TYPES)
    assert after["MasterShotType"] - before["MasterShotType"] == len(data.SHOT_TYPES)
    assert after["MasterReviewType"] - before["MasterReviewType"] == len(data.REVIEW_TYPES)
    assert after["MasterFileType"] - before["MasterFileType"] == len(data.FILE_TYPES)
    assert "file types: created 17" in output


def test_running_again_creates_nothing():
    run()
    snapshot = counts()

    output = run()

    assert counts() == snapshot
    assert all(line.endswith("created 0") for line in output.strip().splitlines())


def test_dry_run_changes_nothing_and_counts():
    before = counts()

    output = run("--dry-run")

    assert counts() == before
    assert f"statuses: would create {len(data.STATUSES)}" in output


def test_seeded_rows_are_system_rows_and_have_one_default_status_per_entity_type():
    run()

    assert Software.objects.filter(code="maya", is_system=True).exists()
    assert SoftwareVersion.objects.get(software__code="maya", version="2026").code == "maya-2026"
    for entity_type in {spec[2] for spec in data.STATUSES}:
        defaults = MasterStatus.objects.filter(entity_type=entity_type, is_default=True)
        assert defaults.count() == 1, entity_type


def test_a_file_type_is_keyed_by_its_extension():
    run()

    exr = MasterFileType.objects.get(code="exr")
    assert exr.extension == "exr" and exr.mime_type == "image/x-exr"


def test_a_row_edited_by_hand_is_not_overwritten():
    run()
    Software.objects.filter(code="maya").update(name="Maya (studio build)", publisher="Us")

    run()

    maya = Software.objects.get(code="maya")
    assert (maya.name, maya.publisher) == ("Maya (studio build)", "Us")
    assert Software.all_objects.filter(code__iexact="maya").count() == 1


def test_a_row_deleted_by_hand_is_not_brought_back():
    run()
    MasterAssetType.objects.get(code="prop").delete()
    assert not MasterAssetType.objects.filter(code="prop").exists()

    run()

    assert not MasterAssetType.objects.filter(code="prop").exists()


def test_existing_statuses_from_init_platform_are_left_alone():
    MasterStatus.objects.create(
        code="approved", name="Approved", entity_type="Asset", is_default=True
    )

    run()

    assert MasterStatus.objects.filter(entity_type="Asset", code="approved").count() == 1
    assert MasterStatus.objects.filter(entity_type="Asset", is_default=True).count() == 1
