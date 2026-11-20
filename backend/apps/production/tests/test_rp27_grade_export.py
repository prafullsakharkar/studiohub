"""
Review-pipeline RP-27: exporting shot grades (docs/review-pipeline/CONTRACTS.md C-RP-62; Q-RP-121 to
Q-RP-124 = A).

WP 27.1: ``cdl.write_collection``, a ``.ccc`` that ``cdl.parse`` reads back to the same grades.
WP 27.2: ``GET projects/{id}/grades/export/``, the graded live shots the caller reads, or one
sequence's, as an attachment. WP 27.3: one ``export`` audit row per file.
"""

from __future__ import annotations

import xml.etree.ElementTree as ElementTree
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.audit.models import AuditLog
from apps.production.models import Shot
from apps.production.tests.factories import (
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
    TaskFactory,
)
from apps.production.tests.test_rp14_remake import _api, _user
from apps.production.transcode import cdl

pytestmark = pytest.mark.django_db

READER = ("project.view", "shot.view")
WRITER = ("project.view", "shot.view", "shot.update")
WARM = {
    "slope": [1.1, 1.0, 0.9],
    "offset": [0.012345, 0.0, -0.01],
    "power": [1.0, 1.0, 1.05],
    "saturation": 0.9,
}
COOL = {
    "slope": [0.9, 1.0, 1.1],
    "offset": [0.0, 0.0, 0.0],
    "power": [1.0, 1.0, 1.0],
    "saturation": 1.0,
}
NS = "{urn:ASC:CDL:v1.01}"


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPTWOSEVEN")


@pytest.fixture
def shots(project):
    """Two graded shots in SQ010, one graded in SQ020, one ungraded, one archived and graded."""
    one = SequenceFactory.create(project=project, code="RPTWOSEVEN_SQ010")
    two = SequenceFactory.create(project=project, code="RPTWOSEVEN_SQ020")

    def shot(code, sequence, grade=None, source="", **extra):
        return ShotFactory.create(
            project=project, code=code, sequence=sequence, grade=grade, grade_source=source, **extra
        )

    return {
        "sq010": one,
        "sq020": two,
        "a": shot("RPTWOSEVEN_SH010", one, WARM, 'reel1.ccc: SH010 & "A" <cut>'),
        "b": shot("RPTWOSEVEN_SH020", one, COOL),
        "c": shot("RPTWOSEVEN_SH030", two, WARM, "dailies.ale"),
        "plain": shot("RPTWOSEVEN_SH040", one),
        "gone": shot("RPTWOSEVEN_SH050", one, COOL, is_deleted=True),
    }


def _export(user, project, **params):
    return _api(user).get(f"/api/v1/projects/{project.pk}/grades/export/", params)


def _ids(response) -> list[str]:
    root = ElementTree.fromstring(response.content)  # noqa: S314 (our own answer)
    return [c.get("id") or "" for c in root.iter(f"{NS}ColorCorrection")]


def _grades(response) -> dict[str, Any]:
    return {c.id: c.grade for c in cdl.parse(response.content)}


class TestWriter:
    """WP 27.1 (Q-RP-121)."""

    def test_the_collection(self):
        data = cdl.write_collection([cdl.Entry("SH010", WARM, "reel1.ccc")])
        assert data.startswith(b"<?xml version='1.0' encoding='utf-8'?>\n")
        root = ElementTree.fromstring(data)  # noqa: S314
        assert root.tag == f"{NS}ColorCorrectionCollection"
        correction = root.find(f"{NS}ColorCorrection")
        assert correction is not None
        assert correction.get("id") == "SH010"
        assert correction.findtext(f"{NS}Description") == "reel1.ccc"
        assert correction.findtext(f"{NS}SOPNode/{NS}Offset") == "0.012345 0.000000 -0.010000"
        assert correction.findtext(f"{NS}SatNode/{NS}Saturation") == "0.900000"

    def test_parse_reads_it_back_to_the_same_grades(self):
        entries = [cdl.Entry("SH010", WARM), cdl.Entry("SH020", COOL, "x")]
        back = cdl.parse(cdl.write_collection(entries))
        assert [(c.id, c.grade) for c in back] == [("SH010", WARM), ("SH020", COOL)]

    def test_ids_and_descriptions_are_escaped(self):
        data = cdl.write_collection([cdl.Entry('S"H&<1>', WARM, 'a & "b" <c>')])
        assert b"&amp;" in data and b"&lt;" in data
        root = ElementTree.fromstring(data)  # noqa: S314
        correction = root.find(f"{NS}ColorCorrection")
        assert correction is not None
        assert correction.get("id") == 'S"H&<1>'
        assert correction.findtext(f"{NS}Description") == 'a & "b" <c>'

    def test_no_description_without_a_source(self):
        data = cdl.write_collection([cdl.Entry("SH010", WARM)])
        assert b"Description" not in data

    def test_an_empty_collection(self):
        root = ElementTree.fromstring(cdl.write_collection([]))  # noqa: S314
        assert root.tag == f"{NS}ColorCorrectionCollection"
        assert len(root) == 0


class TestExport:
    """WP 27.2 (Q-RP-122, Q-RP-123)."""

    def test_the_graded_live_shots_by_code_as_an_attachment(self, project, shots):
        response = _export(_user(project, *READER), project)
        assert response.status_code == 200
        assert response["Content-Type"] == "application/xml; charset=utf-8"
        assert response["Content-Disposition"] == 'attachment; filename="RPTWOSEVEN_grades.ccc"'
        assert response["Cache-Control"] == "no-store"
        assert _ids(response) == ["RPTWOSEVEN_SH010", "RPTWOSEVEN_SH020", "RPTWOSEVEN_SH030"]
        assert _grades(response) == {
            "RPTWOSEVEN_SH010": WARM,
            "RPTWOSEVEN_SH020": COOL,
            "RPTWOSEVEN_SH030": WARM,
        }

    def test_the_source_is_the_description(self, project, shots):
        root = ElementTree.fromstring(_export(_user(project, *READER), project).content)  # noqa: S314
        described = {
            c.get("id"): c.findtext(f"{NS}Description") for c in root.iter(f"{NS}ColorCorrection")
        }
        assert described == {
            "RPTWOSEVEN_SH010": 'reel1.ccc: SH010 & "A" <cut>',
            "RPTWOSEVEN_SH020": None,
            "RPTWOSEVEN_SH030": "dailies.ale",
        }

    def test_one_sequence(self, project, shots):
        reader = _user(project, *READER)
        response = _export(reader, project, sequence_id=str(shots["sq010"].pk))
        assert _ids(response) == ["RPTWOSEVEN_SH010", "RPTWOSEVEN_SH020"]
        assert _ids(_export(reader, project, sequence_id=str(shots["sq020"].pk))) == [
            "RPTWOSEVEN_SH030"
        ]

    @pytest.mark.parametrize("value", ["00000000-0000-0000-0000-000000000000", "not-a-uuid"])
    def test_an_unknown_or_malformed_sequence_is_an_empty_file(self, project, shots, value):
        response = _export(_user(project, *READER), project, sequence_id=value)
        assert response.status_code == 200
        assert _ids(response) == []

    def test_another_project_s_sequence_gives_nothing(self, project, shots):
        other = ProjectFactory.create(code="RPOTHER")
        elsewhere = SequenceFactory.create(project=other, code="RPOTHER_SQ010")
        response = _export(_user(project, *READER), project, sequence_id=str(elsewhere.pk))
        assert _ids(response) == []

    def test_a_project_with_no_graded_shot(self, project):
        ShotFactory.create(project=project, code="RPTWOSEVEN_SH010")
        response = _export(_user(project, *READER), project)
        assert response.status_code == 200
        assert _ids(response) == []

    def test_a_vendor_member_gets_their_tasks_shots_only(self, project, shots):
        vendor = _user(project, *READER, vendor_id="vendor-1")
        TaskFactory.create(
            project=project,
            shot=shots["b"],
            code="RPTWOSEVEN_SH020_COMP",
            entity_type="Shot",
            entity_id=str(shots["b"].pk),
            entity_code=shots["b"].code,
            vendor_id="vendor-1",
        )
        assert _ids(_export(vendor, project)) == ["RPTWOSEVEN_SH020"]

    def test_a_client_member_reads_no_shots(self, project, shots):
        client = _user(project, *READER, client_id="client-1", role="Client")
        response = _export(client, project)
        assert response.status_code == 200
        assert _ids(response) == []

    def test_without_shot_view_is_403(self, project, shots):
        response = _export(_user(project, "project.view"), project)
        assert response.status_code == 403

    def test_a_project_the_caller_is_not_in_is_404(self, project, shots):
        outsider = _user(ProjectFactory.create(code="RPELSE"), *READER)
        assert _export(outsider, project).status_code == 404


class TestAudit:
    """WP 27.3 (Q-RP-124)."""

    def test_one_export_row_per_file(self, project, shots):
        reader = _user(project, *READER)
        before = AuditLog.objects.filter(action=AuditLog.ACTION_EXPORT).count()
        _export(reader, project)
        _export(reader, project, sequence_id=str(shots["sq020"].pk))
        rows = list(
            AuditLog.objects.filter(action=AuditLog.ACTION_EXPORT, project_id=project.pk).order_by(
                "created_at"
            )
        )
        assert AuditLog.objects.filter(action=AuditLog.ACTION_EXPORT).count() == before + 2
        assert [row.metadata for row in rows] == [
            {
                "operation": "grades_export",
                "file_name": "RPTWOSEVEN_grades.ccc",
                "sequence_id": None,
                "shots": 3,
            },
            {
                "operation": "grades_export",
                "file_name": "RPTWOSEVEN_grades.ccc",
                "sequence_id": str(shots["sq020"].pk),
                "shots": 1,
            },
        ]
        assert {row.target_type for row in rows} == {AuditLog.TARGET_PROJECT}
        assert {row.actor_id for row in rows} == {reader.pk}
        assert rows[0].description == "Exported the grades of 3 shots as RPTWOSEVEN_grades.ccc."
        assert rows[1].description == "Exported the grades of 1 shot as RPTWOSEVEN_grades.ccc."

    def test_a_refused_export_is_not_recorded(self, project, shots):
        before = AuditLog.objects.filter(action=AuditLog.ACTION_EXPORT).count()
        _export(_user(project, "project.view"), project)
        assert AuditLog.objects.filter(action=AuditLog.ACTION_EXPORT).count() == before


class TestRoundTrip:
    """Importing an exported file changes nothing (C-RP-62)."""

    def test_export_then_import_is_all_unchanged(self, project, shots):
        writer = _user(project, *WRITER)
        exported = _export(writer, project).content
        response = _api(writer).post(
            f"/api/v1/projects/{project.pk}/grades/import/",
            {"file": SimpleUploadedFile("RPTWOSEVEN_grades.ccc", exported), "dry_run": "true"},
            format="multipart",
        )
        assert response.status_code == 200, response.content
        body = response.json()
        assert body["matched"] == []
        assert body["unmatched"] == []
        assert body["invalid"] == []
        assert sorted(row["shot"]["code"] for row in body["unchanged"]) == [
            "RPTWOSEVEN_SH010",
            "RPTWOSEVEN_SH020",
            "RPTWOSEVEN_SH030",
        ]
        assert Shot.objects.get(pk=shots["a"].pk).grade == WARM
