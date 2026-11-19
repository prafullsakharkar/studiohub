"""
Review pipeline RP-20: per-shot grades on review copies (docs/review-pipeline PLAN WP 20.1 to 20.4;
CONTRACTS C-RP-52 to C-RP-54; Q-RP-92 to Q-RP-96 = A).

A shot's ASC CDL is typed on the shot or imported from the client's ``.cc``, ``.ccc`` or ``.cdl``
file. While its project's ``review_grades`` is on, colour-managed copies of the shot's versions are
made with it, applied in the config's grading space before the project's look; copies made with
another grade are counted and remade by the project's remake. ffmpeg is mocked as in the RP-14 and
RP-15 tests, except ``TestRealFfmpeg``.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

import PyOpenColorIO
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.audit.models import AuditLog
from apps.production.api.serializers.review_media import ReviewMediaSerializer
from apps.production.models import ProjectMembership, ReviewMedia, Shot
from apps.production.services import grade_import
from apps.production.tests.factories import (
    AssetFactory,
    ProjectFactory,
    ShotFactory,
    ShowFactory,
    VersionFactory,
)
from apps.production.tests.test_rp14_remake import (
    EDITOR,
    EXR,
    PRODUCER,
    Status,
    _api,
    _probe,
    _process,
    _ready,
    _user,
    _version,
)
from apps.production.tests.test_rp15_colour import (
    ACES_SDR,
    GAMUT_LOOK,
    _lut_ffmpeg,
    _named_upload,
    _open_sequence,
)
from apps.production.transcode import cdl, colour
from apps.production.transcode import ffmpeg as commands

pytestmark = pytest.mark.django_db
OCIO: Any = PyOpenColorIO  # a compiled module without type stubs

WARM = {
    "slope": [1.1, 1.0, 0.9],
    "offset": [0.01, 0.0, -0.01],
    "power": [1.0, 1.0, 1.05],
    "saturation": 0.9,
}
COOL = {
    "slope": [0.9, 1.0, 1.1],
    "offset": [0.0, 0.0, 0.0],
    "power": [1.0, 1.0, 1.0],
    "saturation": 1.0,
}
SHOT_WRITER = ("project.view", "shot.view", "shot.update")
SHOT_READER = ("project.view", "shot.view")
CDL_NS = "urn:ASC:CDL:v1.2"


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.MEDIA_ACCEL_PREFIX = ""
    settings.REVIEW_MEDIA_ENABLED = True
    settings.REVIEW_MEDIA_MAX_BYTES = 10 * 1024 * 1024
    font = tmp_path / "font.ttf"
    font.write_bytes(b"not really a font")
    settings.REVIEW_MEDIA_BURN_IN_FONT = str(font)


@pytest.fixture
def queued(monkeypatch):
    from apps.production.services import review_media as service_module

    calls: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: calls.append(str(media_id)))
    return calls


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPTWENTY", color_space="ACEScg")


@pytest.fixture
def graded(project):
    """The project with its switch on (Q-RP-95)."""
    project.review_grades = True
    project.save(update_fields=["review_grades"])
    return project


@pytest.fixture
def editor(project):
    return _user(project, *EDITOR)


@pytest.fixture
def producer(project):
    return _user(project, *PRODUCER, "shot.view", "shot.update", role="Producer")


@pytest.fixture
def writer(project):
    return _user(project, *SHOT_WRITER)


@pytest.fixture
def shots(project):
    return {
        code: ShotFactory.create(project=project, code=code)
        for code in ("SH010", "RPTWENTY_SH020", "SH030", "SH0100")
    }


def _with_grade(version, grade, source=""):
    Shot.objects.filter(pk=version.shot_id).update(grade=grade, grade_source=source)
    version.refresh_from_db()
    return version


def _patch(user, shot, body):
    return _api(user).patch(f"/api/v1/shots/{shot.pk}/", body, format="json")


def _cc(cc_id, grade=WARM, *, sat_tag="SatNode"):
    slope, offset, power = (
        " ".join(f"{n:g}" for n in grade[k]) for k in ("slope", "offset", "power")
    )
    return (
        f'<ColorCorrection id="{cc_id}"><SOPNode><Slope>{slope}</Slope><Offset>{offset}</Offset>'
        f"<Power>{power}</Power></SOPNode><{sat_tag}><Saturation>{grade['saturation']:g}"
        f"</Saturation></{sat_tag}></ColorCorrection>"
    )


def _ccc(*corrections: str) -> bytes:
    body = "".join(corrections)
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n<ColorCorrectionCollection xmlns="{CDL_NS}">'
        f"{body}</ColorCorrectionCollection>"
    ).encode()


def _import(user, project, data: bytes, *, name="reel1.ccc", dry_run=None):
    body: dict[str, Any] = {"file": SimpleUploadedFile(name, data)}
    if dry_run is not None:
        body["dry_run"] = "true" if dry_run else "false"
    return _api(user).post(
        f"/api/v1/projects/{project.pk}/grades/import/", body, format="multipart"
    )


def _copies(user, project):
    body = _api(user).get(f"/api/v1/projects/{project.pk}/review-copies/").json()
    return body


def _graded_sequence(editor, version, monkeypatch, capture, workdirs=None):
    """An EXR sequence made ready, with the job folders' files when ``workdirs`` is a list."""
    resp = _open_sequence(editor, version)
    media = ReviewMedia.objects.get(pk=resp.json()["id"])
    files = [SimpleUploadedFile(f"sh010_comp.{n}.exr", EXR + b"\x00" * 64) for n in (1001, 1002)]
    api = _api(editor)
    api.post(f"/api/v1/review-media/{media.pk}/frames/", {"frames": files}, format="multipart")
    api.post(f"/api/v1/review-media/{media.pk}/complete/")
    result, _ = _process(
        media, monkeypatch, probe=_probe(2, "exr"), workdirs=workdirs, capture=capture
    )
    assert result == Status.READY
    return media


def _config_without_grading_space(tmp_path: Path) -> str:
    cfg = OCIO.Config.CreateFromStream(colour.config().serialize())
    cfg.setRole("color_timing", None)
    path = tmp_path / "no_timing.ocio"
    path.write_text(cfg.serialize(), encoding="utf-8")
    return str(path)


# ---------------------------------------------------------------------------------------------- WP 20.1 the grade


class TestShotGrade:
    def test_a_typed_grade_is_stored_shown_and_dated(self, writer, shots):
        shot = shots["SH010"]
        Shot.objects.filter(pk=shot.pk).update(grade_source="old.ccc (SH010)")
        typed = {**WARM, "slope": [1.1000004, 1, 0.9]}  # rounded to six places, ints as floats
        resp = _patch(writer, shot, {"grade": typed})
        assert resp.status_code == 200, resp.content
        shot.refresh_from_db()
        assert shot.grade == WARM
        assert shot.grade_source == ""  # typed: no longer the imported one
        assert shot.grade_updated_at is not None
        shown = _api(writer).get(f"/api/v1/shots/{shot.pk}/").json()
        assert shown["grade"] == WARM and shown["grade_source"] == ""
        assert shown["grade_updated_at"] is not None

    def test_null_clears_and_the_same_grade_changes_nothing(self, writer, shots):
        shot = shots["SH010"]
        Shot.objects.filter(pk=shot.pk).update(grade=WARM, grade_source="reel1.ccc (SH010)")
        assert _patch(writer, shot, {"grade": WARM}).status_code == 200
        shot.refresh_from_db()
        assert shot.grade_source == "reel1.ccc (SH010)" and shot.grade_updated_at is None
        assert _patch(writer, shot, {"grade": None}).status_code == 200
        shot.refresh_from_db()
        assert shot.grade is None and shot.grade_source == "" and shot.grade_updated_at is not None

    def test_a_shot_without_a_grade_shows_null(self, writer, shots):
        shown = _api(writer).get(f"/api/v1/shots/{shots['SH030'].pk}/").json()
        assert shown["grade"] is None and shown["grade_source"] == ""

    @pytest.mark.parametrize(
        ("change", "field"),
        [
            ({"slope": [-0.1, 1, 1]}, "slope"),
            ({"slope": [10.5, 1, 1]}, "slope"),
            ({"offset": [1.5, 0, 0]}, "offset"),
            ({"offset": [0, -1.01, 0]}, "offset"),
            ({"power": [0, 1, 1]}, "power"),  # above 0 only
            ({"power": [1, 1, 11]}, "power"),
            ({"saturation": -0.5}, "saturation"),
            ({"saturation": 11}, "saturation"),
            ({"slope": [1, 1]}, "slope"),
            ({"slope": ["1", 1, 1]}, "slope"),
            ({"slope": [True, 1, 1]}, "slope"),
            ({"saturation": [1]}, "saturation"),
            ({"tint": 1}, "tint"),
        ],
    )
    def test_each_bound_is_checked(self, writer, shots, change, field):
        shot = shots["SH010"]
        resp = _patch(writer, shot, {"grade": {**WARM, **change}})
        assert resp.status_code == 400, resp.content
        assert field in resp.json()["grade"][0]
        shot.refresh_from_db()
        assert shot.grade is None

    def test_the_bounds_themselves_are_allowed(self, writer, shots):
        edge = {"slope": [0, 10, 1], "offset": [-1, 1, 0], "power": [0.001, 10, 1], "saturation": 0}
        assert _patch(writer, shots["SH010"], {"grade": edge}).status_code == 200

    def test_a_missing_part_and_a_non_object_are_refused(self, writer, shots):
        partial = {k: v for k, v in WARM.items() if k != "power"}
        assert _patch(writer, shots["SH010"], {"grade": partial}).status_code == 400
        assert _patch(writer, shots["SH010"], {"grade": [1, 2, 3]}).status_code == 400

    def test_writing_a_grade_needs_shot_update(self, project, shots):
        reader = _user(project, *SHOT_READER)
        assert _patch(reader, shots["SH010"], {"grade": WARM}).status_code == 403

    def test_bulk_update_does_not_take_a_grade(self, writer, project, shots):
        resp = _api(writer).post(
            "/api/v1/shots/bulk-update/",
            {"project_id": str(project.pk), "items": [{"code": "SH010", "grade": WARM}]},
            format="json",
        )
        shots["SH010"].refresh_from_db()
        assert shots["SH010"].grade is None, resp.content

    def test_the_project_switch_is_off_by_default_and_written_with_the_project(
        self, project, producer
    ):
        assert project.review_grades is False
        api = _api(producer)
        assert api.get(f"/api/v1/projects/{project.pk}/").json()["review_grades"] is False
        resp = api.patch(f"/api/v1/projects/{project.pk}/", {"review_grades": True}, format="json")
        assert resp.status_code == 200 and resp.json()["review_grades"] is True
        viewer = _user(project, "project.view")
        resp = _api(viewer).patch(
            f"/api/v1/projects/{project.pk}/", {"review_grades": False}, format="json"
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------------------------- WP 20.2 the import


class TestParse:
    def test_each_file_kind(self):
        cc = _cc("SH010").encode()
        cdl_file = (
            f'<ColorDecisionList xmlns="{CDL_NS}"><ColorDecision>{_cc("SH010")}</ColorDecision>'
            f"<ColorDecision>{_cc('SH030', COOL)}</ColorDecision></ColorDecisionList>"
        ).encode()
        assert [c.grade for c in cdl.parse(cc)] == [WARM]
        assert [(c.id, c.grade) for c in cdl.parse(_ccc(_cc("A"), _cc("B", COOL)))] == [
            ("A", WARM),
            ("B", COOL),
        ]
        assert [c.id for c in cdl.parse(cdl_file)] == ["SH010", "SH030"]

    def test_v1_01_spelling_and_missing_nodes(self):
        v101 = _cc("A", sat_tag="SATNode").replace("<Saturation>0.9", "<Saturation>0.5")
        assert cdl.parse(v101.encode())[0].grade["saturation"] == 0.5
        bare = b'<ColorCorrection id="A"><SatNode><Saturation>0.8</Saturation></SatNode></ColorCorrection>'
        assert cdl.parse(bare)[0].grade == {
            "slope": [1.0, 1.0, 1.0], "offset": [0.0, 0.0, 0.0], "power": [1.0, 1.0, 1.0],
            "saturation": 0.8,
        }  # fmt: skip

    def test_invalid_corrections_say_which_field(self):
        bad = _cc("A").replace("<Slope>1.1 1 0.9", "<Slope>1.1 1")
        out_of_range = _cc("B", {**WARM, "power": [0, 1, 1]})
        no_id = _cc("").replace(' id=""', "")
        parsed = cdl.parse(_ccc(bad, out_of_range, no_id))
        assert [(c.id, c.field, c.valid) for c in parsed] == [
            ("A", "slope", False),
            ("B", "power", False),
            ("", "id", False),
        ]

    @pytest.mark.parametrize(
        "data",
        [
            b'<!DOCTYPE x [<!ENTITY a "aaaa">]><ColorCorrection id="&a;"/>',
            b'<?xml version="1.0"?>\n<!DOCTYPE ColorCorrection SYSTEM "http://example.invalid/x.dtd">'
            b'<ColorCorrection id="A"/>',
            # the encoding cannot hide it
            '<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE x><ColorCorrection id="A"/>'.encode(
                "utf-16"
            ),
        ],
    )
    def test_a_document_type_is_refused(self, data):
        with pytest.raises(cdl.CdlError, match="declares a document type"):
            cdl.parse(data)

    def test_what_is_not_a_cdl_file(self):
        for data, message in (
            (b"SH010 1.1 1 0.9", "not XML"),
            (b"<Collection/>", "holds no ColorCorrection"),
            (b"<ColorCorrectionCollection/>", "holds no ColorCorrection"),
        ):
            with pytest.raises(cdl.CdlError, match=message):
                cdl.parse(data)

    def test_at_most_2000_corrections(self, monkeypatch):
        monkeypatch.setattr(cdl, "MAX_CORRECTIONS", 3)
        cdl.parse(_ccc(*(_cc(f"S{n}") for n in range(3))))
        with pytest.raises(cdl.CdlError, match="more than 3"):
            cdl.parse(_ccc(*(_cc(f"S{n}") for n in range(4))))


class TestImport:
    def test_a_dry_run_matches_and_writes_nothing(self, writer, project, shots):
        Shot.objects.filter(pk=shots["SH030"].pk).update(grade=COOL)
        data = _ccc(
            _cc("sh010"),  # any case
            _cc("RPTWENTY_SH010", COOL),  # the same shot again
            _cc("SH020"),  # the stored code has the project's code before it
            _cc("SH030", COOL),  # what it has already
            _cc("SH01"),  # never a part of a code
            _cc("SH999"),
            _cc("SH0100", {**WARM, "saturation": 12}),
        )
        resp = _import(writer, project, data)
        assert resp.status_code == 200, resp.content
        body = resp.json()
        assert body["dry_run"] is True and body["applied"] == 0
        assert body["file_name"] == "reel1.ccc" and body["corrections"] == 7
        assert [(m["id"], m["shot"]["code"], m["old"], m["new"]) for m in body["matched"]] == [
            ("sh010", "SH010", None, WARM),
            ("SH020", "RPTWENTY_SH020", None, WARM),
        ]
        assert [(u["id"], u["shot"]["code"]) for u in body["unchanged"]] == [("SH030", "SH030")]
        assert body["unmatched"] == ["SH01", "SH999"]
        assert [(i["id"], i["field"]) for i in body["invalid"]] == [
            ("RPTWENTY_SH010", "id"),
            ("SH0100", "saturation"),
        ]
        assert "Another correction in the file is for shot SH010." in body["invalid"][0]["message"]
        assert not Shot.objects.filter(grade=WARM).exists()
        assert not AuditLog.objects.filter(metadata__operation="shot_grades_imported").exists()

    def test_applying_writes_every_matched_shot_and_audits(self, writer, project, shots):
        data = _ccc(_cc("SH010"), _cc("RPTWENTY_SH020", COOL), _cc("SH999"))
        resp = _import(writer, project, data, dry_run=False)
        assert resp.status_code == 200, resp.content
        assert resp.json()["applied"] == 2
        sh010, sh020 = (Shot.objects.get(pk=shots[c].pk) for c in ("SH010", "RPTWENTY_SH020"))
        assert sh010.grade == WARM and sh010.grade_source == "reel1.ccc (SH010)"
        assert sh020.grade == COOL and sh020.grade_source == "reel1.ccc (RPTWENTY_SH020)"
        assert sh010.grade_updated_at is not None
        log = AuditLog.objects.get(metadata__operation="shot_grades_imported")
        assert log.target_id == str(project.pk) and log.actor_id == writer.pk
        assert sorted(log.metadata["shots"]) == sorted([str(sh010.pk), str(sh020.pk)])
        # the same file again changes nothing
        again = _import(writer, project, data, dry_run=False).json()
        assert again["applied"] == 0 and len(again["unchanged"]) == 2
        assert AuditLog.objects.filter(metadata__operation="shot_grades_imported").count() == 1

    def test_an_exact_code_wins_and_an_ambiguous_id_is_unmatched(self, writer, project):
        ShotFactory.create(project=project, code="SH050")
        ShotFactory.create(project=project, code="RPTWENTY_SH050")
        body = _import(writer, project, _ccc(_cc("SH050"), _cc("RPTWENTY_SH050", COOL))).json()
        assert [(m["id"], m["shot"]["code"]) for m in body["matched"]] == [
            ("SH050", "SH050"),
            ("RPTWENTY_SH050", "RPTWENTY_SH050"),
        ]
        other = ProjectFactory.create(code="RPTWENTYB")
        member = _user(other, *SHOT_WRITER)
        # "RPTWENTYB_SH1" is "SH1" with the project's code before it, and "RPTWENTYB_RPTWENTYB_SH1"
        # with it taken off: neither shot is chosen
        ShotFactory.create(project=other, code="SH1")
        ShotFactory.create(project=other, code="RPTWENTYB_RPTWENTYB_SH1")
        body = _import(member, other, _ccc(_cc("RPTWENTYB_SH1"))).json()
        assert body["unmatched"] == ["RPTWENTYB_SH1"] and body["matched"] == []

    def test_applying_is_all_or_nothing(self, writer, project, shots, monkeypatch):
        def broken(*args, **kwargs):
            raise RuntimeError("audit down")

        monkeypatch.setattr(grade_import.AuditLog.objects, "create", broken)
        client = _api(writer)
        client.raise_request_exception = False
        resp = client.post(
            f"/api/v1/projects/{project.pk}/grades/import/",
            {
                "file": SimpleUploadedFile("r.ccc", _ccc(_cc("SH010"), _cc("SH030"))),
                "dry_run": "false",
            },
            format="multipart",
        )
        assert resp.status_code == 500
        assert not Shot.objects.filter(grade__isnull=False).exists()

    def test_shots_the_caller_cannot_see_are_unmatched(self, project, shots):
        show = ShowFactory.create(project=project, code="REEL1")
        Shot.objects.filter(pk=shots["SH010"].pk).update(show=show)
        other = ShowFactory.create(project=project, code="REEL2")
        bound = _user(None, *SHOT_WRITER)
        ProjectMembership.objects.create(
            user=bound, project=project, status="active", role="Artist", show=other
        )
        body = _import(bound, project, _ccc(_cc("SH010")), dry_run=False).json()
        assert body["matched"] == [] and body["unmatched"] == ["SH010"]
        assert Shot.objects.get(pk=shots["SH010"].pk).grade is None

    def test_another_projects_shots_are_never_matched(self, writer, project, shots):
        other = ProjectFactory.create(code="RPTWENTYC")
        ShotFactory.create(project=other, code="SH777")
        body = _import(writer, project, _ccc(_cc("SH777"))).json()
        assert body["unmatched"] == ["SH777"]

    def test_the_import_needs_shot_update(self, project, shots):
        reader = _user(project, *SHOT_READER)
        assert _import(reader, project, _ccc(_cc("SH010"))).status_code == 403

    def test_refusals(self, writer, project, shots, monkeypatch):
        cases = [
            (_ccc(_cc("SH010")), "reel1.xml", "Choose a .cc, .ccc, .cdl, .edl or .ale file."),
            (b'<!DOCTYPE x><ColorCorrection id="SH010"/>', "reel1.cc", "declares a document type"),
            (b"nope", "reel1.cdl", "not XML"),
        ]
        for data, name, message in cases:
            resp = _import(writer, project, data, name=name, dry_run=False)
            assert resp.status_code == 400, (name, resp.content)
            assert message in resp.json()["file"][0]
        monkeypatch.setattr(grade_import, "MAX_BYTES", 100)
        resp = _import(writer, project, _ccc(_cc("SH010")), dry_run=False)
        assert resp.status_code == 400 and "larger than 1 MiB" in resp.json()["file"][0]
        assert not Shot.objects.filter(grade__isnull=False).exists()

    def test_a_client_path_never_reaches_the_source(self, writer, project, shots):
        resp = _import(
            writer, project, _cc("SH010").encode(), name="C:\\grades\\reel 4.cc", dry_run=False
        )
        assert resp.json()["file_name"] == "reel 4.cc"
        assert Shot.objects.get(pk=shots["SH010"].pk).grade_source == "reel 4.cc (SH010)"


# ---------------------------------------------------------------------------------------------- WP 20.3 processing


class TestProcessing:
    def test_a_graded_exr_sequence(
        self, editor, graded, queued, monkeypatch, settings, django_capture_on_commit_callbacks
    ):
        version = _with_grade(_version(graded, "RPTWENTY_V1"), WARM, "reel1.ccc (SH010)")
        workdirs: list[dict[str, bytes]] = []
        media = _graded_sequence(
            editor, version, monkeypatch, django_capture_on_commit_callbacks, workdirs
        )
        assert media.probe["grade"] == WARM and media.probe["grade_skipped"] is None
        assert media.probe["grade_source"] == "reel1.ccc (SH010)"
        assert media.probe["ocio"] == colour.target("ACEScg").as_json()  # the transform is the same
        # the job's LUT carries the grade: it is the graded bake, not the shared one
        expected = Path(settings.MEDIA_ROOT) / "expected.csp"
        colour.write_graded_lut(colour.target("ACEScg"), WARM, expected)
        plain = colour.lut_for(colour.target("ACEScg"), Path(settings.MEDIA_ROOT) / "x")
        lut = workdirs[1][commands.COLOUR_LUT]
        assert lut == expected.read_bytes() and lut != plain.read_bytes()
        # nothing graded is cached, and the job's folder is gone
        luts = Path(settings.MEDIA_ROOT) / "review_media" / "luts"
        assert not luts.exists() or not list(luts.iterdir())
        assert not list((Path(settings.MEDIA_ROOT) / media.directory).glob("work-*"))

    def test_the_grade_comes_before_the_projects_look(self, settings):
        target = colour.target("ACEScg", look=GAMUT_LOOK)
        ours = Path(settings.MEDIA_ROOT) / "ours.csp"
        colour.write_graded_lut(target, WARM, ours)
        # the same bake, the look first: a different LUT
        cfg = OCIO.Config.CreateFromStream(colour.config().serialize())
        cdl_ = OCIO.CDLTransform()
        cdl_.setSlope(WARM["slope"]), cdl_.setOffset(WARM["offset"]), cdl_.setPower(WARM["power"])
        cdl_.setSat(WARM["saturation"])
        cfg.addLook(OCIO.Look(name=colour.GRADE_LOOK, processSpace="ACEScct", transform=cdl_))
        after = colour._bake_with(
            cfg, "ACEScg", colour.display(), ACES_SDR, f"{GAMUT_LOOK}, {colour.GRADE_LOOK}"
        )
        before = colour._bake_with(
            cfg, "ACEScg", colour.display(), ACES_SDR, f"{colour.GRADE_LOOK}, {GAMUT_LOOK}"
        )
        assert ours.read_text() == before != after

    def test_the_grade_is_applied_in_the_grading_space(self):
        # mid grey through the grade in ACEScct, then the view (the RP-20 spike's numbers)
        cfg = OCIO.Config.CreateFromStream(colour.config().serialize())
        cdl_ = OCIO.CDLTransform()
        cdl_.setSlope(WARM["slope"]), cdl_.setOffset(WARM["offset"]), cdl_.setPower(WARM["power"])
        cdl_.setSat(WARM["saturation"])
        assert colour.grading_space() == "ACEScct"
        cfg.addLook(OCIO.Look(name="g", processSpace="ACEScct", transform=cdl_))
        shown = cfg.getProcessor(
            OCIO.DisplayViewTransform(
                src="ACEScg", display=colour.display(), view=ACES_SDR, looksBypass=False
            )
        )
        looked = OCIO.LookTransform(src="ACEScg", dst="ACEScg", looks="g")
        graded = cfg.getProcessor(looked).getDefaultCPUProcessor().applyRGB([0.18] * 3)
        rgb = shown.getDefaultCPUProcessor().applyRGB(graded)
        assert [round(v * 255) for v in rgb] == [137, 86, 52]

    def test_switch_off_or_no_grade_makes_todays_copy(
        self, editor, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        off = _graded_sequence(
            editor, _with_grade(_version(project, "RPT_V2"), WARM), monkeypatch, cap
        )
        assert off.probe["grade"] is None and off.probe["grade_skipped"] is None
        project.review_grades = True
        project.save(update_fields=["review_grades"])
        none = _graded_sequence(editor, _version(project, "RPT_V3"), monkeypatch, cap)
        assert none.probe["grade"] is None and none.probe["grade_skipped"] is None

    def test_a_display_ready_movie_is_never_graded(
        self, editor, graded, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        version = _with_grade(_version(graded, "RPT_V4"), WARM)
        media = _ready(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.probe["ocio"] is None and media.probe["grade"] is None
        assert media.probe["grade_skipped"] is None

    def test_a_movie_naming_its_colour_space_is_graded(
        self, editor, graded, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        version = _with_grade(_version(graded, "RPT_V5"), COOL)
        resp = _named_upload(editor, version, "ACEScct")
        media = ReviewMedia.objects.get(pk=resp.json()["id"])
        _process(media, monkeypatch, capture=django_capture_on_commit_callbacks)
        assert media.probe["ocio"]["input"] == "ACEScct" and media.probe["grade"] == COOL

    def test_an_asset_version_has_no_grade(
        self, editor, graded, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        asset = AssetFactory.create(project=graded, code="RPT_ASSET")
        version = VersionFactory.create(project=graded, asset=asset, code="RPT_ASSET_V1")
        media = _graded_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.probe["ocio"] is not None and media.probe["grade"] is None

    def test_a_config_without_a_grading_space(
        self,
        editor,
        graded,
        producer,
        queued,
        monkeypatch,
        settings,
        tmp_path,
        django_capture_on_commit_callbacks,
    ):
        settings.REVIEW_MEDIA_OCIO_CONFIG = _config_without_grading_space(tmp_path)
        assert colour.grading_space() is None
        version = _with_grade(_version(graded, "RPT_V6"), WARM)
        media = _graded_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.probe["ocio"] is not None  # still colour-managed
        assert media.probe["grade"] is None and media.probe["grade_skipped"] == "no_grading_space"
        # what it would be made with now is without a grade too, so it is not counted
        assert _copies(producer, graded)["grade_out_of_date"] == 0

    def test_a_graded_bake_that_fails_still_makes_a_copy(
        self, editor, graded, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        def broken(*args, **kwargs):
            raise colour.ColourUnavailable("bake failed")

        monkeypatch.setattr(colour, "write_graded_lut", broken)
        version = _with_grade(_version(graded, "RPT_V7"), WARM)
        media = _graded_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.probe["ocio"] is not None and media.probe["grade"] is None
        assert media.probe["grade_skipped"] == "colour_config_unavailable"

    def test_the_probe_shape_shows_the_grade(
        self, editor, graded, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        version = _with_grade(_version(graded, "RPT_V8"), WARM, "reel1.ccc (SH010)")
        media = _graded_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        probe = ReviewMediaSerializer(media).data["probe"]
        assert probe["grade"] == WARM and probe["grade_source"] == "reel1.ccc (SH010)"
        # a copy made before RP-20 answers without one
        ReviewMedia.objects.filter(pk=media.pk).update(
            probe={k: v for k, v in media.probe.items() if not k.startswith("grade")}
        )
        media.refresh_from_db()
        probe = ReviewMediaSerializer(media).data["probe"]
        assert (probe["grade"], probe["grade_source"], probe["grade_skipped"]) == (None, "", None)


# ---------------------------------------------------------------------------------------------- WP 20.4 Q-RP-96


class TestCopies:
    def test_a_changed_or_cleared_grade_and_the_switch_count(
        self,
        project,
        producer,
        editor,
        queued,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        cap = django_capture_on_commit_callbacks
        version = _with_grade(_version(project, "RPT_C1"), WARM)
        movie = _ready(editor, _with_grade(_version(project, "RPT_C2"), WARM), monkeypatch, cap)
        sequence = _graded_sequence(editor, version, monkeypatch, cap)
        body = _copies(producer, project)
        assert (body["review_grades"], body["grade_out_of_date"]) == (False, 0)

        project.review_grades = True
        project.save(update_fields=["review_grades"])
        body = _copies(producer, project)
        # the sequence was made without its grade; the display-ready movie is never graded
        assert body["grade_out_of_date"] == 1 and body["colour_out_of_date"] == 0
        assert [(d["review_media_id"], d["why"]) for d in body["differing"]] == [
            (str(sequence.pk), ["grade"])
        ]
        assert str(movie.pk) not in {d["review_media_id"] for d in body["differing"]}

        with cap(execute=True):
            remade = _api(producer).post(f"/api/v1/projects/{project.pk}/review-copies/remake/")
        assert remade.json()["queued"] == 1
        made = ReviewMedia.objects.get(remake_of=sequence)
        result, _ = _process(made, monkeypatch, probe=_probe(2, "exr"), capture=cap)
        assert result == Status.READY and made.probe["grade"] == WARM
        assert _copies(producer, project)["grade_out_of_date"] == 0

        # a new grade, then none
        assert _patch(producer, version.shot, {"grade": COOL}).status_code == 200
        assert _copies(producer, project)["grade_out_of_date"] == 1
        assert _patch(producer, version.shot, {"grade": None}).status_code == 200
        assert _copies(producer, project)["grade_out_of_date"] == 1
        assert _patch(producer, version.shot, {"grade": WARM}).status_code == 200
        assert _copies(producer, project)["grade_out_of_date"] == 0
        # the switch off: the graded copy counts the other way
        project.review_grades = False
        project.save(update_fields=["review_grades"])
        assert _copies(producer, project)["grade_out_of_date"] == 1

    def test_copies_made_before_rp20_are_not_counted_while_the_switch_is_off(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _graded_sequence(
            editor,
            _with_grade(_version(project, "RPT_C3"), WARM),
            monkeypatch,
            django_capture_on_commit_callbacks,
        )
        ReviewMedia.objects.filter(pk=media.pk).update(
            probe={k: v for k, v in media.probe.items() if not k.startswith("grade")}
        )
        assert _copies(producer, project)["grade_out_of_date"] == 0
        assert _copies(producer, project)["out_of_date"] == 0

    def test_keep_covers_a_grade_and_counts_again_when_it_changes(
        self,
        graded,
        producer,
        editor,
        queued,
        monkeypatch,
        settings,
        django_capture_on_commit_callbacks,
    ):
        settings.REVIEW_MEDIA_SEQUENCE_KEEP_DAYS = 0  # the frames go: the copy cannot be remade
        version = _version(graded, "RPT_C4")
        media = _graded_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        _with_grade(version, WARM)
        assert _copies(producer, graded)["grade_out_of_date"] == 1
        resp = _api(producer).post(
            f"/api/v1/projects/{graded.pk}/review-copies/keep/",
            {"review_media_ids": [str(media.pk)]},
            format="json",
        )
        assert resp.status_code == 200, resp.content
        media.refresh_from_db()
        assert media.kept_for["grade"] == WARM
        assert _copies(producer, graded)["grade_out_of_date"] == 0
        _with_grade(version, COOL)
        assert _copies(producer, graded)["grade_out_of_date"] == 1

    def test_a_copy_kept_before_rp20_counts_once_the_switch_is_on(
        self,
        project,
        producer,
        editor,
        queued,
        monkeypatch,
        settings,
        django_capture_on_commit_callbacks,
    ):
        settings.REVIEW_MEDIA_SEQUENCE_KEEP_DAYS = 0
        version = _with_grade(_version(project, "RPT_C5"), WARM)
        media = _graded_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        ReviewMedia.objects.filter(pk=media.pk).update(
            kept_for={"burn_ins": False, "ocio": media.probe["ocio"]}
        )
        assert _copies(producer, project)["out_of_date"] == 0
        project.review_grades = True
        project.save(update_fields=["review_grades"])
        assert _copies(producer, project)["grade_out_of_date"] == 1


# ---------------------------------------------------------------------------------------------- real ffmpeg


class TestRealFfmpeg:
    def test_mid_grey_lands_where_the_graded_transform_puts_it(
        self, editor, graded, queued, settings, tmp_path, django_capture_on_commit_callbacks
    ):
        tools = _lut_ffmpeg(tmp_path)
        if tools is None:
            pytest.skip("no ffmpeg that reads the colour LUT")
        settings.REVIEW_MEDIA_FFMPEG, settings.REVIEW_MEDIA_FFPROBE = tools
        ffmpeg = tools[0]
        version = _with_grade(_version(graded, "RPT_REAL"), WARM)
        frames = tmp_path / "gen"
        frames.mkdir()
        subprocess.run(
            [ffmpeg, "-v", "error", "-f", "lavfi", "-i", "color=c=0x2E2E2E:s=320x180:r=24",
             "-frames:v", "4", "-pix_fmt", "gbrpf32le", "-start_number", "1001",
             str(frames / "plate.%04d.exr")],
            check=True, cwd=tmp_path,
        )  # fmt: skip
        resp = _api(editor).post(
            f"/api/v1/versions/{version.pk}/review-media/sequence/",
            {"name": "plate", "extension": "exr", "first_frame": 1001, "last_frame": 1004},
            format="json",
        )
        media = ReviewMedia.objects.get(pk=resp.json()["id"])
        files = [SimpleUploadedFile(p.name, p.read_bytes()) for p in sorted(frames.iterdir())]
        api = _api(editor)
        api.post(f"/api/v1/review-media/{media.pk}/frames/", {"frames": files}, format="multipart")
        api.post(f"/api/v1/review-media/{media.pk}/complete/")
        from apps.production.services.review_media import ReviewMediaService

        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(media.pk) == Status.READY
        media.refresh_from_db()
        assert media.probe["grade"] == WARM

        proxy = Path(settings.MEDIA_ROOT) / media.proxy_path
        raw = subprocess.run(
            [ffmpeg, "-v", "error", "-i", str(proxy), "-frames:v", "1",
             "-vf", "crop=2:2", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
            capture_output=True, check=True, cwd=proxy.parent,
        ).stdout  # fmt: skip
        cfg = OCIO.Config.CreateFromStream(colour.config().serialize())
        cdl_ = OCIO.CDLTransform()
        cdl_.setSlope(WARM["slope"]), cdl_.setOffset(WARM["offset"]), cdl_.setPower(WARM["power"])
        cdl_.setSat(WARM["saturation"])
        cfg.addLook(OCIO.Look(name="g", processSpace="ACEScct", transform=cdl_))
        looked = cfg.getProcessor(OCIO.LookTransform(src="ACEScg", dst="ACEScg", looks="g"))
        shown = cfg.getProcessor(
            OCIO.DisplayViewTransform(src="ACEScg", display=colour.display(), view=ACES_SDR)
        )
        expected = shown.getDefaultCPUProcessor().applyRGB(
            looked.getDefaultCPUProcessor().applyRGB([46 / 255] * 3)
        )
        # red and blue part: the grade is in the picture, not only in the probe
        assert raw[0] > raw[2] + 40, tuple(raw[:3])
        for got, want in zip(raw[:3], expected, strict=True):
            assert abs(got - round(want * 255)) <= 4, (tuple(raw[:3]), expected)
