"""
Review pipeline RP-22: grades from EDLs and ALEs (docs/review-pipeline PLAN WP 22.1 to 22.3;
CONTRACTS C-RP-55; Q-RP-101 to Q-RP-104 = A).

An EDL's events carry the grade as ``*ASC_SOP`` and ``*ASC_SAT`` comments, an ALE's rows in
``ASC_SOP`` and ``ASC_SAT`` columns. Each event's or row's names are tried in turn against the
project's shot codes, as RP-20 matches a CDL correction's id; the dry run, the all-or-nothing apply
and the audit row are RP-20's.
"""

from __future__ import annotations

import pytest

from apps.audit.models import AuditLog
from apps.production.models import Shot
from apps.production.tests.factories import ProjectFactory, ShotFactory
from apps.production.tests.test_rp14_remake import _user
from apps.production.tests.test_rp20_shot_grades import (
    COOL,
    SHOT_READER,
    SHOT_WRITER,
    WARM,
    _cc,
    _ccc,
    _import,
)
from apps.production.transcode import cdl, grade_files

pytestmark = pytest.mark.django_db

TC = "01:00:00:00 01:00:01:00 01:00:00:00 01:00:01:00"
WARM_SOP = "(1.1 1.0 0.9)(0.01 0.0 -0.01)(1.0 1.0 1.05)"
COOL_SOP = "(0.9 1.0 1.1)(0.0 0.0 0.0)(1.0 1.0 1.0)"
NEUTRAL = {"slope": [1.0, 1.0, 1.0], "offset": [0.0, 0.0, 0.0], "power": [1.0, 1.0, 1.0]}


@pytest.fixture
def project():
    return ProjectFactory.create(code="RPTWENTY")


@pytest.fixture
def writer(project):
    return _user(project, *SHOT_WRITER)


@pytest.fixture
def shots(project):
    """RP-20's shots: one with the project's code before it."""
    return {
        code: ShotFactory.create(project=project, code=code)
        for code in ("SH010", "RPTWENTY_SH020", "SH030", "SH0100")
    }


def _event(number: int, reel: str, *comments: str, transition: str = "C") -> str:
    lines = [f"{number:03d}  {reel:<8} V     {transition}        {TC}"]
    return "\n".join([*lines, *(f"* {c}" if not c.startswith("*") else c for c in comments)])


def _edl(*events: str, title: str = "REEL 4") -> bytes:
    return ("\n".join([f"TITLE: {title}", "FCM: NON-DROP FRAME", "", *events]) + "\n").encode()


def _ale(columns: list[str], *rows: list[str]) -> bytes:
    lines = ["Heading", "FIELD_DELIM\tTABS", "VIDEO_FORMAT\t1080", "FPS\t24", "", "Column"]
    lines += ["\t".join(columns), "", "Data", *("\t".join(row) for row in rows)]
    return ("\n".join(lines) + "\n").encode()


def _names(entries):
    return [(e.label, e.names) for e in entries]


# ---------------------------------------------------------------------------------------------- WP 22.1 the readers


class TestEdl:
    def test_each_writers_spelling_of_the_grade(self):
        data = _edl(
            # Resolve: no space after the star, groups together
            _event(1, "A001", f"*ASC_SOP {WARM_SOP}", "*ASC_SAT 0.9", "LOC: 01:00:00:12 RED SH010"),
            # Baselight: a space after the star, spaces between the groups
            _event(2, "A002", "ASC_SOP (1.1 1.0 0.9) (0.01 0.0 -0.01) (1.0 1.0 1.05)", "ASC_SAT 0.9", "LOC: 01:00:00:12 SH020"),
            # nine numbers, no parentheses; lower case
            _event(3, "A003", "asc_sop 1.1 1.0 0.9 0.01 0.0 -0.01 1.0 1.0 1.05", "asc_sat 0.9", "LOC: 01:00:00:12 SH030"),
        )  # fmt: skip
        entries, ungraded = grade_files.parse_edl(data)
        assert ungraded == 0
        assert [e.grade for e in entries] == [WARM, WARM, WARM]
        assert [e.label for e in entries] == ["event 1", "event 2", "event 3"]

    def test_sop_or_sat_alone_is_a_grade(self):
        entries, _ = grade_files.parse_edl(
            _edl(
                _event(1, "SH010", f"ASC_SOP {COOL_SOP}"),
                _event(2, "SH020", "ASC_SAT 0.5"),
            )
        )
        assert entries[0].grade == COOL
        assert entries[1].grade == {**NEUTRAL, "saturation": 0.5}

    def test_names_in_order_locators_to_clip_from_clip_reels(self):
        data = _edl(
            _event(
                7, "B004", "FROM CLIP NAME: A001C003_220101_R1AB.mov", "TO CLIP NAME: VFX_SH010.exr",
                "LOC: 01:00:00:12 YELLOW VFX SH010 comp", f"ASC_SOP {WARM_SOP}",
            ),
        )  # fmt: skip
        [entry], _ = grade_files.parse_edl(data)
        assert entry.names == [
            "VFX SH010 comp", "VFX", "SH010", "comp", "VFX_SH010", "A001C003_220101_R1AB", "B004",
        ]  # fmt: skip

    def test_a_transition_is_one_event_with_both_reels(self):
        data = _edl(
            _event(5, "A001", "FROM CLIP NAME: OUTGOING"),
            _event(5, "SH010", "TO CLIP NAME: INCOMING", f"ASC_SOP {WARM_SOP}", transition="D 024"),
        )
        [entry], ungraded = grade_files.parse_edl(data)
        assert ungraded == 0
        assert entry.label == "event 5" and entry.names == ["INCOMING", "OUTGOING", "A001", "SH010"]

    def test_ungraded_events_are_counted_not_listed(self):
        data = _edl(
            _event(1, "BL"),
            _event(2, "SH010", f"ASC_SOP {WARM_SOP}"),
            _event(3, "TITLE1", "FROM CLIP NAME: Main title"),
        )
        entries, ungraded = grade_files.parse_edl(data)
        assert _names(entries) == [("event 2", ["SH010"])] and ungraded == 2

    def test_a_latin_1_file_is_read(self):
        data = _edl(_event(1, "SH010", "FROM CLIP NAME: Scène 4", "ASC_SAT 0.8")).decode()
        [entry], _ = grade_files.parse_edl(data.encode("latin-1"))
        assert entry.names == ["Scène 4", "SH010"]

    def test_a_grade_that_cannot_be_read_or_is_out_of_bounds(self):
        entries, _ = grade_files.parse_edl(
            _edl(
                _event(1, "SH010", "ASC_SOP (1 1 1)(0 0 0)"),
                _event(2, "SH020", "ASC_SAT high"),
                _event(3, "SH030", "ASC_SAT 12"),
                _event(4, "SH040", f"ASC_SOP {WARM_SOP}", f"ASC_SOP {COOL_SOP}"),
            )
        )
        assert [(e.label, e.field, e.valid) for e in entries] == [
            ("event 1", "ASC_SOP", False),
            ("event 2", "ASC_SAT", False),
            ("event 3", "saturation", False),
            ("event 4", "ASC_SOP", False),
        ]
        assert "three groups of three numbers" in entries[0].message
        assert entries[3].message == "The event has two ASC_SOP lines."

    def test_what_is_not_an_edl(self):
        for data, message in (
            (b"just some text\n", "holds no event"),
            (_edl(_event(1, "SH010")), "no event has an *ASC_SOP or *ASC_SAT comment"),
            (b"\x00\x01binary", "not text"),
        ):
            with pytest.raises(cdl.CdlError, match=message.replace("*", r"\*")):
                grade_files.parse_edl(data)

    def test_at_most_2000_graded_events_ungraded_ones_not_counted(self, monkeypatch):
        monkeypatch.setattr(grade_files, "MAX_CORRECTIONS", 2)
        two = [_event(n, f"SH{n}", "ASC_SAT 0.9") for n in (1, 2)]
        entries, ungraded = grade_files.parse_edl(_edl(*two, _event(3, "BL"), _event(4, "BL")))
        assert len(entries) == 2 and ungraded == 2
        with pytest.raises(cdl.CdlError, match="more than 2 grades"):
            grade_files.parse_edl(_edl(*two, _event(3, "SH3", "ASC_SAT 0.9")))


class TestAle:
    def test_each_name_column_then_name(self):
        data = _ale(
            ["Name", "Tracks", "ASC_SAT", "VFX ID", "ASC_SOP", "Shot"],
            ["A001C003.mov", "V", "0.9", "VFX_010", WARM_SOP, "SH010"],
            ["A001C004", "V", "", "", COOL_SOP, ""],
        )
        entries, ungraded = grade_files.parse_ale(data)
        assert ungraded == 0
        assert _names(entries) == [
            ("row 1", ["SH010", "VFX_010", "A001C003"]),
            ("row 2", ["A001C004"]),
        ]
        assert [e.grade for e in entries] == [WARM, COOL]

    def test_columns_in_any_case_and_a_short_row(self):
        data = _ale(["name", "asc_sop", "asc_sat", "shot name"], ["A001", WARM_SOP])
        [entry], _ = grade_files.parse_ale(data)
        assert entry.names == ["A001"] and entry.grade == {**WARM, "saturation": 1.0}

    def test_ungraded_rows_are_counted(self):
        data = _ale(["Name", "ASC_SOP"], ["SH010", WARM_SOP], ["SH020", ""], ["SH030", ""])
        entries, ungraded = grade_files.parse_ale(data)
        assert _names(entries) == [("row 1", ["SH010"])] and ungraded == 2

    def test_what_is_not_an_ale(self):
        for data, message in (
            (b"Heading\nFPS\t24\n", "no Column and Data sections"),
            (_ale(["Name", "Tracks"], ["SH010", "V"]), "no ASC_SOP or ASC_SAT column"),
            (_ale(["Name", "ASC_SAT"], ["SH010", ""]), "no row has an ASC_SOP or ASC_SAT value"),
        ):
            with pytest.raises(cdl.CdlError, match=message):
                grade_files.parse_ale(data)


# ---------------------------------------------------------------------------------------------- WP 22.2 and 22.3 the import


class TestImport:
    def test_names_are_tried_in_turn_and_never_as_a_part_of_a_code(self, writer, project, shots):
        data = _edl(
            # a camera clip name matches nothing; the reel names the shot
            _event(
                1,
                "SH010",
                "FROM CLIP NAME: A001C003_220101.mov",
                f"ASC_SOP {WARM_SOP}",
                "ASC_SAT 0.9",
            ),
            # the locator's word, read through the project's code
            _event(2, "B002", "LOC: 01:00:00:12 GREEN SH020", f"ASC_SOP {WARM_SOP}", "ASC_SAT 0.9"),
            # never a part of a code
            _event(3, "SH01", "LOC: 01:00:00:12 SH0", f"ASC_SOP {WARM_SOP}"),
            _event(4, "BL"),
        )
        body = _import(writer, project, data, name="cut.edl").json()
        assert body["corrections"] == 3 and body["ungraded"] == 1 and body["applied"] == 0
        assert [(m["id"], m["shot"]["code"], m["new"]) for m in body["matched"]] == [
            ("event 1: SH010", "SH010", WARM),
            ("event 2: SH020", "RPTWENTY_SH020", WARM),
        ]
        assert body["unmatched"] == ["event 3: SH0, SH01"]
        assert not Shot.objects.filter(grade=WARM).exists()

    def test_names_for_two_shots_make_the_event_invalid(self, writer, project, shots):
        data = _edl(_event(1, "SH030", "LOC: 01:00:00:12 SH010", f"ASC_SOP {WARM_SOP}"))
        body = _import(writer, project, data, name="cut.edl").json()
        assert body["matched"] == [] and body["invalid"] == [
            {
                "id": "event 1: SH010",
                "field": "id",
                "message": "The event names two shots: SH010 and SH030.",
            }
        ]

    def test_one_shot_in_two_events_with_one_grade_is_one_correction(self, writer, project, shots):
        data = _edl(
            _event(3, "SH010", f"ASC_SOP {WARM_SOP}", "ASC_SAT 0.9"),
            _event(9, "SH010", f"ASC_SOP {WARM_SOP}", "ASC_SAT 0.9"),
        )
        body = _import(writer, project, data, name="cut.edl", dry_run=False).json()
        assert [m["id"] for m in body["matched"]] == ["event 3: SH010"] and body["invalid"] == []
        assert body["applied"] == 1
        assert Shot.objects.get(pk=shots["SH010"].pk).grade_source == "cut.edl (event 3: SH010)"

    def test_one_shot_with_different_grades_is_not_written(self, writer, project, shots):
        Shot.objects.filter(pk=shots["SH010"].pk).update(grade=COOL)
        data = _edl(
            _event(3, "SH010", f"ASC_SOP {WARM_SOP}"),
            _event(9, "SH010", f"ASC_SOP {COOL_SOP}"),
            _event(12, "SH010", f"ASC_SOP {WARM_SOP}"),
            _event(14, "SH030", f"ASC_SOP {WARM_SOP}", "ASC_SAT 0.9"),
        )
        body = _import(writer, project, data, name="cut.edl", dry_run=False).json()
        message = "Events 3, 9 and 12 give shot SH010 different grades."
        assert body["invalid"] == [
            {"id": f"event {n}: SH010", "field": "id", "message": message} for n in (3, 9, 12)
        ]
        assert [m["id"] for m in body["matched"]] == ["event 14: SH030"] and body["applied"] == 1
        assert Shot.objects.get(pk=shots["SH010"].pk).grade == COOL

    def test_an_ale_is_imported_with_its_rows(self, writer, project, shots):
        data = _ale(
            ["Name", "ASC_SOP", "ASC_SAT", "Shot"],
            ["A001C003", WARM_SOP, "0.9", "SH010"],
            ["A001C004", "", "", "SH030"],
            ["A001C005", COOL_SOP, "", "SH999"],
        )
        body = _import(writer, project, data, name="dailies.ale", dry_run=False).json()
        assert body["corrections"] == 2 and body["ungraded"] == 1
        assert [m["id"] for m in body["matched"]] == ["row 1: SH010"]
        assert body["unmatched"] == ["row 3: SH999, A001C005"]
        assert Shot.objects.get(pk=shots["SH010"].pk).grade_source == "dailies.ale (row 1: SH010)"
        log = AuditLog.objects.get(metadata__operation="shot_grades_imported")
        assert log.metadata["file_name"] == "dailies.ale"

    def test_an_invalid_grade_names_the_event_and_its_first_name(self, writer, project, shots):
        body = _import(
            writer, project, _edl(_event(2, "SH010", "ASC_SAT 12")), name="cut.edl"
        ).json()
        assert [(i["id"], i["field"]) for i in body["invalid"]] == [
            ("event 2: SH010", "saturation")
        ]

    def test_a_shot_the_caller_may_not_update_stays_unmatched(self, project, shots):
        reader = _user(project, *SHOT_READER, "shot.update")
        hidden = ShotFactory.create(project=project, code="SH777")
        from apps.production.models import ProjectMembership

        ProjectMembership.objects.filter(user=reader).update(vendor_id="vendor-x")
        body = _import(
            reader, project, _edl(_event(1, hidden.code, "ASC_SAT 0.9")), name="cut.edl"
        ).json()
        assert body["unmatched"] == ["event 1: SH777"]

    def test_cdl_files_keep_their_rules_and_answer_no_ungraded(self, writer, project, shots):
        body = _import(writer, project, _ccc(_cc("SH010"), _cc("SH010", COOL))).json()
        assert body["ungraded"] == 0
        assert [(i["id"], i["field"]) for i in body["invalid"]] == [("SH010", "id")]

    def test_refusals_name_the_new_files(self, writer, project, shots):
        resp = _import(writer, project, b"x", name="cut.xml")
        assert resp.json()["file"] == ["Choose a .cc, .ccc, .cdl, .edl or .ale file."]
        resp = _import(writer, project, b"no events here\n", name="cut.edl")
        assert resp.status_code == 400 and "holds no event" in resp.json()["file"][0]
        resp = _import(writer, project, b"Heading\n", name="log.ALE")
        assert resp.status_code == 400 and "no Column and Data sections" in resp.json()["file"][0]
