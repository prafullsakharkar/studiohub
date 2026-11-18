"""
Review pipeline RP-15: colour management for review copies (docs/review-pipeline PLAN WP 15.1 to
15.4; CONTRACTS C-RP-39, C-RP-40; Q-RP-68 to Q-RP-72 = A; ADR-0041).

EXR frames go through the studio's OpenColorIO view, baked into a LUT that ffmpeg applies first;
movies and other frames only when the upload names a colour space. ffmpeg is mocked as in the RP-5,
RP-12 and RP-14 tests, except ``TestRealFfmpeg``, which runs the real ffmpeg when it reads the LUT
(Debian's and Ubuntu's do) and is skipped otherwise.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Any

import PyOpenColorIO
import pytest
from django.core.checks import run_checks
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.production.models import ReviewMedia
from apps.production.services import review_media as service_module
from apps.production.services.review_media import ReviewMediaService
from apps.production.tests.factories import ProjectFactory
from apps.production.tests.test_rp14_remake import (
    EDITOR,
    EXR,
    MOV,
    PRODUCER,
    Status,
    _api,
    _probe,
    _process,
    _ready,
    _ready_sequence,
    _upload,
    _user,
    _version,
)
from apps.production.transcode import colour
from apps.production.transcode import ffmpeg as commands

pytestmark = pytest.mark.django_db
OCIO: Any = PyOpenColorIO  # a compiled module without type stubs

PINNED = "ocio://studio-config-v5.0.0_aces-v2.1_ocio-v2.6"
ACES_SDR = "ACES 2.0 - SDR 100 nits (Rec.709)"
GAMUT_LOOK = "ACES 1.3 Reference Gamut Compression"
DPX_HEAD = b"SDPX" + b"\x00" * 12


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
    calls: list[str] = []
    monkeypatch.setattr(service_module, "enqueue", lambda media_id: calls.append(str(media_id)))
    return calls


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPFIFTEEN", color_space="ACEScg")


@pytest.fixture
def editor(project):
    return _user(project, *EDITOR)


@pytest.fixture
def producer(project):
    return _user(project, *PRODUCER, role="Producer")


@pytest.fixture
def version(project):
    return _version(project, "RPFIFTEEN_SH010_V001")


@pytest.fixture
def missing_config(settings, tmp_path):
    settings.REVIEW_MEDIA_OCIO_CONFIG = str(tmp_path / "nowhere" / "config.ocio")


def _filter(args: list[str]) -> str:
    return args[args.index("-vf") + 1]


def _open_sequence(user, version, **extra):
    body = {"name": "sh010_comp", "extension": "exr", "first_frame": 1001, "last_frame": 1002}
    return _api(user).post(
        f"/api/v1/versions/{version.pk}/review-media/sequence/", {**body, **extra}, format="json"
    )


def _named_upload(user, version, color_space, *, name="clip.mov", head=MOV):
    upload = SimpleUploadedFile(name, head + b"\x00" * 64)
    return _api(user).post(
        f"/api/v1/versions/{version.pk}/review-media/",
        {"file": upload, "color_space": color_space},
        format="multipart",
    )


def _copies(user, project):
    """The copies read's counts; RP-16's list of the copies is tested in test_rp16."""
    body = _api(user).get(f"/api/v1/projects/{project.pk}/review-copies/").json()
    return {k: v for k, v in body.items() if k not in ("differing", "differing_more")}


# ---------------------------------------------------------------------------------------------- WP 15.1 the config


class TestConfig:
    def test_the_pinned_config_and_its_names(self):
        assert colour.config_source() == PINNED
        assert colour.config_name() == "studio-config-v5.0.0_aces-v2.1_ocio-v2.6"
        assert colour.display() == "sRGB - Display" and colour.default_view() == ACES_SDR
        # a name, an alias, a role, any case: the config's own spelling
        for name in ("ACEScg", "lin_ap1", "scene_linear", "acescg", " ACEScg "):
            assert colour.resolve_space(name) == "ACEScg"
        # data and display-referred spaces are no input for a review copy
        for name in ("Raw", "Rec.1886 Rec.709 - Display", "nope", ""):
            assert colour.resolve_space(name) is None
        assert colour.resolve_view("") == ACES_SDR and colour.resolve_view("un-TONE-mapped") == (
            "Un-tone-mapped"
        )
        assert colour.resolve_view("nope") is None
        assert colour.resolve_look("") == "" and colour.resolve_look(GAMUT_LOOK) == GAMUT_LOOK
        assert colour.resolve_look("nope") is None

    def test_a_target_and_its_refusals(self):
        made = colour.target("lin_ap1", "", GAMUT_LOOK)
        assert made.as_json() == {
            "config": "studio-config-v5.0.0_aces-v2.1_ocio-v2.6",
            "input": "ACEScg",
            "display": "sRGB - Display",
            "view": ACES_SDR,
            "look": GAMUT_LOOK,
        }
        for args, field in (
            (("nope",), "color_space"),
            (("ACEScg", "nope"), "review_view"),
            (("ACEScg", "", "nope"), "review_look"),
        ):
            with pytest.raises(colour.UnknownColour) as refused:
                colour.target(*args)
            assert refused.value.field == field

    def test_a_lut_is_baked_once_per_transform(self, tmp_path, monkeypatch):
        baked: list[tuple[Any, ...]] = []
        real = colour._bake.__wrapped__

        def counting(*args):
            baked.append(args)
            return real(*args)

        monkeypatch.setattr(colour, "_bake", counting)
        first = colour.lut_for(colour.target("ACEScg"), tmp_path)
        again = colour.lut_for(colour.target("lin_ap1"), tmp_path)
        other = colour.lut_for(colour.target("ACEScct"), tmp_path)
        assert first == again != other and len(baked) == 2
        text = first.read_text()
        assert text.startswith("CSPLUTV100") and "3D" in text.splitlines()[1]
        assert not [p for p in tmp_path.iterdir() if p.name.startswith(".")]

    def test_scene_linear_input_is_sampled_through_a_log_shaper(self):
        # without it, everything above 1.0 would clip before the view could tone-map it
        assert colour._shaper("ACEScg") == "ACEScct"
        assert colour._shaper("ACEScct") is None
        assert colour._shaper("sRGB Encoded Rec.709 (sRGB)") is None

    def test_a_studio_config_file_is_named_by_its_file(self, settings, tmp_path):
        cfg = OCIO.Config.CreateFromFile(PINNED)
        cfg.setName("")
        path = tmp_path / "studio" / "config.ocio"
        path.parent.mkdir()
        path.write_text(cfg.serialize())
        settings.REVIEW_MEDIA_OCIO_CONFIG = str(path)
        assert colour.config_name() == "config.ocio"  # never the server's path
        assert colour.target("ACEScg").config == "config.ocio"

    def test_a_config_that_cannot_be_read(self, settings, missing_config):
        with pytest.raises(colour.ColourUnavailable):
            colour.config()
        settings.REVIEW_MEDIA_ENABLED = True
        warnings = [m for m in run_checks() if m.id == "production.W002"]
        assert len(warnings) == 1 and "cannot be loaded" in warnings[0].msg

    def test_the_check_is_quiet_with_a_good_config_or_media_off(self, settings):
        assert not [m for m in run_checks() if m.id == "production.W002"]
        settings.REVIEW_MEDIA_ENABLED = False
        settings.REVIEW_MEDIA_OCIO_CONFIG = "/nowhere/config.ocio"
        assert not [m for m in run_checks() if m.id == "production.W002"]


# ---------------------------------------------------------------------------------------------- WP 15.2 C-RP-39


class TestProjectColour:
    def _patch(self, user, project, **body):
        return _api(user).patch(f"/api/v1/projects/{project.pk}/", body, format="json")

    def test_known_names_are_stored_in_the_configs_spelling(self, producer, project):
        resp = self._patch(
            producer,
            project,
            color_space="lin_ap1",
            review_view="un-tone-mapped",
            review_look=GAMUT_LOOK.lower(),
        )
        assert resp.status_code == 200, resp.content
        project.refresh_from_db()
        assert (project.color_space, project.review_view, project.review_look) == (
            "ACEScg",
            "Un-tone-mapped",
            GAMUT_LOOK,
        )
        shown = _api(producer).get(f"/api/v1/projects/{project.pk}/").json()
        assert shown["review_view"] == "Un-tone-mapped" and shown["review_look"] == GAMUT_LOOK

    def test_unknown_names_are_refused(self, producer, project):
        resp = self._patch(
            producer, project, color_space="ACEScg 1.3", review_view="Cinema", review_look="Warm"
        )
        assert resp.status_code == 400
        body = resp.json()
        assert "no colour space named 'ACEScg 1.3'" in str(body)
        assert "no view named 'Cinema' for sRGB - Display" in str(body)
        assert "no look named 'Warm'" in str(body)
        project.refresh_from_db()
        assert (project.color_space, project.review_view, project.review_look) == (
            "ACEScg",
            "",
            "",
        )

    def test_blank_is_allowed(self, producer, project):
        resp = self._patch(producer, project, color_space="", review_view="", review_look="")
        assert resp.status_code == 200, resp.content
        project.refresh_from_db()
        assert project.color_space == ""

    def test_a_stored_unknown_value_survives_other_writes(self, producer, project):
        type(project).objects.filter(pk=project.pk).update(color_space="ACEScg 1.3")
        assert self._patch(producer, project, name="Renamed").status_code == 200
        assert self._patch(producer, project, color_space="ACEScg 1.3").status_code == 200
        project.refresh_from_db()
        assert project.color_space == "ACEScg 1.3" and project.name == "Renamed"
        assert self._patch(producer, project, color_space="ACEScg 1.4").status_code == 400

    def test_create_checks_the_names_too(self, producer):
        body = {
            "code": "RPCOL",
            "name": "Colour",
            "workflow_type": "standard",
            "type": "Feature Film",
        }
        api = _api(producer)
        refused = api.post("/api/v1/projects/", {**body, "color_space": "nope"}, format="json")
        assert refused.status_code in (400, 403)  # 403 when the producer may not create projects
        if refused.status_code == 400:
            assert "no colour space named 'nope'" in str(refused.json())

    def test_a_config_that_cannot_be_read_blocks_only_colour_changes(
        self, producer, project, missing_config
    ):
        assert self._patch(producer, project, name="Still fine").status_code == 200
        resp = self._patch(producer, project, review_view=ACES_SDR)
        assert resp.status_code == 400 and "cannot be read" in str(resp.json())

    def test_the_colour_options(self, editor):
        resp = _api(editor).get("/api/v1/review-media/colour/")
        assert resp.status_code == 200, resp.content
        body = resp.json()
        assert body["available"] is True and body["config"].startswith("studio-config-v5.0.0")
        assert body["display"] == "sRGB - Display" and body["default_view"] == ACES_SDR
        assert ACES_SDR in body["views"] and body["looks"] == [GAMUT_LOOK]
        names = {space["name"]: space for space in body["color_spaces"]}
        assert names["ACEScg"]["encoding"] == "scene-linear"
        assert "lin_ap1" in names["ACEScg"]["aliases"]
        assert "Raw" not in names and not any(n.endswith("- Display") for n in names)

    def test_the_options_say_when_the_config_cannot_be_read(self, editor, missing_config):
        body = _api(editor).get("/api/v1/review-media/colour/").json()
        assert body == {
            "available": False,
            "config": None,
            "display": None,
            "default_view": None,
            "views": [],
            "looks": [],
            "color_spaces": [],
        }

    def test_the_options_need_project_view(self, project):
        nobody = _user(None)
        assert _api(nobody).get("/api/v1/review-media/colour/").status_code == 403


# ---------------------------------------------------------------------------------------------- WP 15.3 C-RP-40


class TestProcessing:
    def test_an_exr_sequence_goes_through_the_projects_view(
        self, editor, version, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        media = _ready_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.probe["colour"] == "ocio" and media.probe["colour_skipped"] is None
        assert media.probe["ocio"] == colour.target("ACEScg").as_json()

    def test_the_commands_read_the_lut_first_and_never_apply_trc(
        self, editor, version, project, queued, monkeypatch, settings
    ):
        project.review_burn_ins = True
        project.save(update_fields=["review_burn_ins"])
        resp = _open_sequence(editor, version)
        media = ReviewMedia.objects.get(pk=resp.json()["id"])
        files = [
            SimpleUploadedFile(f"sh010_comp.{n}.exr", EXR + b"\x00" * 64) for n in (1001, 1002)
        ]
        api = _api(editor)
        api.post(f"/api/v1/review-media/{media.pk}/frames/", {"frames": files}, format="multipart")
        api.post(f"/api/v1/review-media/{media.pk}/complete/")
        workdirs: list[dict[str, bytes]] = []
        result, calls = _process(media, monkeypatch, probe=_probe(2, "exr"), workdirs=workdirs)
        assert result == Status.READY
        pictures = calls[1:]
        assert len(pictures) == 3  # proxy, thumbnail, filmstrip
        assert all("-apply_trc" not in args for args in calls)
        lut = f"lut3d=file={commands.COLOUR_LUT}:interp=tetrahedral"
        proxy, thumbnail, filmstrip = (_filter(args) for args in pictures)
        assert proxy.startswith(lut + ",scale=")
        assert proxy.index(lut) < proxy.index("drawtext")  # burn-ins on the finished picture
        assert thumbnail.startswith(lut + ",scale=")
        assert filmstrip.startswith("select=") and f",{lut},scale=" in filmstrip
        # the LUT is in the job's folder under its fixed name, and is the baked one
        baked = colour.lut_for(colour.target("ACEScg"), Path(settings.MEDIA_ROOT) / "x")
        assert workdirs[1][commands.COLOUR_LUT] == baked.read_bytes()
        assert (Path(settings.MEDIA_ROOT) / "review_media" / "luts").is_dir()

    def test_the_view_and_look_follow_the_project(
        self, editor, version, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        project.review_view, project.review_look = "Un-tone-mapped", GAMUT_LOOK
        project.save(update_fields=["review_view", "review_look"])
        media = _ready_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.probe["ocio"]["view"] == "Un-tone-mapped"
        assert media.probe["ocio"]["look"] == GAMUT_LOOK

    def test_the_versions_color_space_is_not_used(
        self, editor, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        version = _version(project, "RPFIFTEEN_V9", color_space="ACEScct")
        media = _ready_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.probe["ocio"]["input"] == "ACEScg"  # the project's

    def test_a_movie_that_names_nothing_is_shown_as_stored(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        media = _upload(editor, version)
        result, calls = _process(media, monkeypatch, capture=django_capture_on_commit_callbacks)
        assert result == Status.READY
        assert all("lut3d" not in " ".join(args) for args in calls)
        assert media.probe["colour"] == "as_stored" and media.probe["ocio"] is None
        assert media.color_space == ""

    def test_a_movie_that_names_its_color_space(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        resp = _named_upload(editor, version, "acescct_ap1")
        assert resp.status_code == 202, resp.content
        assert resp.json()["color_space"] == "ACEScct"
        media = ReviewMedia.objects.get(pk=resp.json()["id"])
        result, calls = _process(media, monkeypatch, capture=django_capture_on_commit_callbacks)
        assert result == Status.READY
        assert all("lut3d=" in _filter(args) for args in calls[1:])
        assert media.probe["colour"] == "ocio" and media.probe["ocio"]["input"] == "ACEScct"

    def test_an_upload_naming_an_unknown_colour_space_is_refused(self, editor, version, queued):
        resp = _named_upload(editor, version, "Kodak 2383")
        assert resp.status_code == 400
        assert resp.json()["color_space"] == [
            "The studio's colour config has no colour space named 'Kodak 2383'."
        ]
        assert not ReviewMedia.objects.filter(version=version).exists()
        resp = _open_sequence(editor, version, color_space="Kodak 2383", last_frame=900)
        assert resp.status_code == 400
        assert set(resp.json()) - {"error"} == {
            "color_space",
            "last_frame",
        }  # every problem at once

    def test_a_dpx_sequence_is_transformed_only_when_named(
        self, editor, project, queued, monkeypatch
    ):
        for named, expected in (("", None), ("ADX10", "ADX10")):
            version = _version(project, f"RPFIFTEEN_DPX{named or 'X'}")
            resp = _open_sequence(editor, version, extension="dpx", color_space=named)
            media = ReviewMedia.objects.get(pk=resp.json()["id"])
            files = [
                SimpleUploadedFile(f"sh010_comp.{n}.dpx", DPX_HEAD + b"\x00" * 64)
                for n in (1001, 1002)
            ]
            api = _api(editor)
            api.post(
                f"/api/v1/review-media/{media.pk}/frames/", {"frames": files}, format="multipart"
            )
            api.post(f"/api/v1/review-media/{media.pk}/complete/")
            result, calls = _process(media, monkeypatch, probe=_probe(2, "dpx"))
            assert result == Status.READY
            assert (media.probe["ocio"] or {}).get("input") == expected
            assert ("lut3d" in " ".join(calls[1])) is bool(expected)

    def test_an_unknown_stored_color_space_falls_back_to_rp12(
        self, editor, version, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        type(project).objects.filter(pk=project.pk).update(color_space="ACEScg 1.3")
        media = _ready_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.probe["colour"] == "srgb_from_linear" and media.probe["ocio"] is None
        assert media.probe["colour_skipped"] == "unknown_colour_space"

    def test_a_blank_project_color_space_keeps_rp12s_rule(
        self, editor, version, project, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        type(project).objects.filter(pk=project.pk).update(color_space="")
        media = _ready_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.probe["colour"] == "srgb_from_linear"
        assert media.probe["ocio"] is None and media.probe["colour_skipped"] is None

    def test_a_config_that_cannot_be_read_still_makes_a_copy(
        self, editor, version, queued, monkeypatch, missing_config
    ):
        resp = _open_sequence(editor, version)
        media = ReviewMedia.objects.get(pk=resp.json()["id"])
        files = [
            SimpleUploadedFile(f"sh010_comp.{n}.exr", EXR + b"\x00" * 64) for n in (1001, 1002)
        ]
        api = _api(editor)
        api.post(f"/api/v1/review-media/{media.pk}/frames/", {"frames": files}, format="multipart")
        api.post(f"/api/v1/review-media/{media.pk}/complete/")
        result, calls = _process(media, monkeypatch, probe=_probe(2, "exr"))
        assert result == Status.READY
        assert all("-apply_trc" in args for args in calls[1:])
        assert media.probe["colour_skipped"] == "colour_config_unavailable"

    def test_a_lut_that_cannot_be_baked_still_makes_a_copy(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        def broken(*args, **kwargs):
            raise colour.ColourUnavailable("bake failed")

        monkeypatch.setattr(colour, "lut_for", broken)
        media = _ready_sequence(editor, version, monkeypatch, django_capture_on_commit_callbacks)
        assert media.probe["colour"] == "srgb_from_linear"
        assert media.probe["colour_skipped"] == "colour_config_unavailable"

    def test_a_remake_keeps_the_named_color_space(
        self, editor, version, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        resp = _named_upload(editor, version, "ACEScct")
        media = ReviewMedia.objects.get(pk=resp.json()["id"])
        _process(media, monkeypatch, capture=django_capture_on_commit_callbacks)
        remade = _api(editor).post(f"/api/v1/review-media/{media.pk}/remake/")
        assert remade.status_code == 202 and remade.json()["color_space"] == "ACEScct"


# ---------------------------------------------------------------------------------------------- WP 15.4 Q-RP-72


class TestCopies:
    def test_copies_made_with_another_view_are_counted_and_remade(
        self,
        project,
        producer,
        editor,
        queued,
        monkeypatch,
        settings,
        django_capture_on_commit_callbacks,
    ):
        cap = django_capture_on_commit_callbacks
        settings.REVIEW_MEDIA_SEQUENCE_KEEP_DAYS = 0  # RP-12's rule, which RP-16 keeps for 0
        _ready_sequence(editor, _version(project, "RPF15_V1"), monkeypatch, cap)
        plain = _ready(editor, _version(project, "RPF15_V2"), monkeypatch, cap)
        resp = _named_upload(editor, _version(project, "RPF15_V3"), "ACEScct")
        named = ReviewMedia.objects.get(pk=resp.json()["id"])
        _process(named, monkeypatch, capture=cap)
        assert _copies(producer, project) == {
            "review_burn_ins": False,
            "out_of_date": 0,
            "sequences_out_of_date": 0,
            "colour_out_of_date": 0,
        }

        project.review_view = "Un-tone-mapped"
        project.save(update_fields=["review_view"])
        # the sequence and the named movie differ; the plain movie is not transformed either way
        assert _copies(producer, project) == {
            "review_burn_ins": False,
            "out_of_date": 1,
            "sequences_out_of_date": 1,
            "colour_out_of_date": 2,
        }
        with cap(execute=True):
            remade = _api(producer).post(f"/api/v1/projects/{project.pk}/review-copies/remake/")
        assert remade.json() == {
            "queued": 1,
            "skipped_busy": 0,
            "skipped_sequence": 1,
            "skipped_missing": 0,
            "skipped_storage": 0,  # RP-17 (C-RP-46)
        }
        made = ReviewMedia.objects.get(remake_of=named)
        assert made.color_space == "ACEScct"
        assert not ReviewMedia.objects.filter(remake_of=plain).exists()
        result, _ = _process(made, monkeypatch, capture=cap)
        assert result == Status.READY and made.probe["ocio"]["view"] == "Un-tone-mapped"
        assert _copies(producer, project)["colour_out_of_date"] == 1  # the sequence

    def test_copies_made_before_rp15(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        cap = django_capture_on_commit_callbacks
        movie = _ready(editor, _version(project, "RPF15_OLD1"), monkeypatch, cap)
        sequence = _ready_sequence(editor, _version(project, "RPF15_OLD2"), monkeypatch, cap)
        for row in (movie, sequence):
            ReviewMedia.objects.filter(pk=row.pk).update(
                probe={k: v for k, v in row.probe.items() if k not in ("ocio", "colour_skipped")}
            )
        # a movie was not transformed then and is not now; an EXR sequence was shown by RP-12's rule
        body = _copies(producer, project)
        assert body["out_of_date"] == 0 and body["sequences_out_of_date"] == 1
        assert body["colour_out_of_date"] == 1

    def test_a_matching_copy_is_not_counted_when_its_names_are_spelled_otherwise(
        self, project, producer, editor, queued, monkeypatch, django_capture_on_commit_callbacks
    ):
        _ready_sequence(
            editor, _version(project, "RPF15_V7"), monkeypatch, django_capture_on_commit_callbacks
        )
        type(project).objects.filter(pk=project.pk).update(
            color_space="lin_ap1", review_view=ACES_SDR.upper()
        )
        project.refresh_from_db()
        assert _copies(producer, project)["colour_out_of_date"] == 0

    def test_an_unreadable_config_counts_no_copy_and_remakes_none(
        self,
        project,
        producer,
        editor,
        queued,
        monkeypatch,
        settings,
        tmp_path,
        django_capture_on_commit_callbacks,
    ):
        cap = django_capture_on_commit_callbacks
        resp = _named_upload(editor, _version(project, "RPF15_V8"), "ACEScct")
        named = ReviewMedia.objects.get(pk=resp.json()["id"])
        _process(named, monkeypatch, capture=cap)
        _ready_sequence(editor, _version(project, "RPF15_V9"), monkeypatch, cap)
        # a passing outage: what the copies would be made with is not known, so none is offered
        settings.REVIEW_MEDIA_OCIO_CONFIG = str(tmp_path / "nowhere" / "config.ocio")
        assert _copies(producer, project) == {
            "review_burn_ins": False,
            "out_of_date": 0,
            "sequences_out_of_date": 0,
            "colour_out_of_date": 0,
        }
        with cap(execute=True):
            remade = _api(producer).post(f"/api/v1/projects/{project.pk}/review-copies/remake/")
        assert remade.json()["queued"] == 0
        assert not ReviewMedia.objects.filter(remake_of=named).exists()


# ---------------------------------------------------------------------------------------------- real ffmpeg


def _lut_ffmpeg(folder: Path) -> tuple[str, str] | None:
    """The ffmpeg and ffprobe on the path when that ffmpeg applies the baked LUT, else ``None``."""
    ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        return None
    lut = colour.lut_for(colour.target("ACEScg"), folder)
    try:
        tried = subprocess.run(
            [ffmpeg, "-v", "error", "-f", "lavfi", "-i", "color=c=gray:s=16x16",
             "-frames:v", "1", "-vf", f"lut3d=file={lut.name}", "-f", "null", "-"],
            capture_output=True, timeout=120, check=False, cwd=folder,
        )  # fmt: skip
    except (OSError, subprocess.TimeoutExpired):
        return None
    return (ffmpeg, ffprobe) if tried.returncode == 0 else None


class TestRealFfmpeg:
    def test_mid_grey_lands_where_opencolorio_puts_it(
        self, editor, version, queued, settings, tmp_path, django_capture_on_commit_callbacks
    ):
        tools = _lut_ffmpeg(tmp_path)
        if tools is None:
            pytest.skip("no ffmpeg that reads the colour LUT")
        settings.REVIEW_MEDIA_FFMPEG, settings.REVIEW_MEDIA_FFPROBE = tools
        ffmpeg = tools[0]
        frames = tmp_path / "gen"
        frames.mkdir()
        # 0x2E2E2E = 46/255 = 0.1804, close to mid grey, as float EXR (scene-linear ACEScg)
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
        with django_capture_on_commit_callbacks(execute=True):
            assert ReviewMediaService.process(media.pk) == Status.READY
        media.refresh_from_db()
        assert media.probe["colour"] == "ocio"

        proxy = Path(settings.MEDIA_ROOT) / media.proxy_path
        raw = subprocess.run(
            [ffmpeg, "-v", "error", "-i", str(proxy), "-frames:v", "1",
             "-vf", "crop=2:2", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
            capture_output=True, check=True, cwd=proxy.parent,
        ).stdout  # fmt: skip
        shown = raw[0]
        processor = (
            colour.config()
            .getProcessor(
                OCIO.DisplayViewTransform(src="ACEScg", display="sRGB - Display", view=ACES_SDR)
            )
            .getDefaultCPUProcessor()
        )
        expected = round(processor.applyRGB([46 / 255] * 3)[0] * 255)
        assert abs(shown - expected) <= 4, (shown, expected)
        assert abs(shown - 117) > 15  # RP-12's rule put 0.18 at about 117
