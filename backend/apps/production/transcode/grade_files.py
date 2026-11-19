"""
Grades in an EDL or an ALE (review-pipeline RP-22, C-RP-55; Q-RP-101 to Q-RP-104).

An **EDL** (CMX 3600) is a list of events. An event starts at its number line (``012  A001C003 V
C  01:00:00:00 01:00:05:00 01:00:10:00 01:00:15:00``; a transition repeats the number for the
incoming clip). Its comment lines follow: ``*ASC_SOP (slope)(offset)(power)``, three groups of three
numbers, and ``*ASC_SAT`` with one number, as Resolve, Baselight and Avid write them (with or without
parentheses, spaces, or a space after the ``*``). Either one alone is a grade, and a missing one
changes nothing. An event's names, tried in turn (Q-RP-101): its locators' text (``* LOC: <tc>
[colour] <text>``, the whole text and then each word), its clip names (``TO``, then ``FROM``, without
the extension), its reels.

An **ALE** (Avid Log Exchange) names its columns on the line after ``Column`` and its rows after
``Data``, separated by tabs. A row's grade is in its ``ASC_SOP`` and ``ASC_SAT`` columns, and its names
are its ``Shot``, ``VFX``, ``VFX ID`` and ``Shot Name`` cells, then ``Name`` (Q-RP-102), any case.

An event or row with neither grade is **ungraded**: counted, not listed (Q-RP-104). The text is read
as UTF-8, or as Latin-1 when it is not UTF-8. Nothing here fetches or expands anything.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from apps.production.transcode.cdl import MAX_CORRECTIONS, CdlError
from apps.production.validators.grade import GradeError, clean_grade

#: the files read here, by extension
EXTENSIONS = (".edl", ".ale")
#: the ALE columns that name a shot, in the order they are tried, then ``Name``
ALE_NAME_COLUMNS = ("shot", "vfx", "vfx id", "shot name", "name")
#: Avid's locator colours, which come before a locator's text
LOCATOR_COLOURS = frozenset(
    {"WHITE", "RED", "GREEN", "BLUE", "CYAN", "MAGENTA", "YELLOW", "BLACK", "PINK", "ORANGE"}
)

_TIMECODE = r"\d{1,2}:\d{2}:\d{2}[:;.]\d{2}"
_EVENT = re.compile(rf"^(\d{{1,6}})\s+(\S+)\s+.*?(?:{_TIMECODE}\s+){{3}}{_TIMECODE}\s*$")
_LOCATOR = re.compile(rf"^LOC:\s*{_TIMECODE}\s*(.*)$", re.IGNORECASE)
_EXTENSION = re.compile(r"\.[A-Za-z0-9]{1,5}$")
SOP_MESSAGE = "ASC_SOP must be three groups of three numbers: slope, offset and power."
SAT_MESSAGE = "ASC_SAT must be one number."


@dataclass
class Entry:
    """A graded event or row: where it is (``event 12``, ``row 3``), its names and its grade."""

    label: str
    names: list[str] = field(default_factory=list)
    grade: dict[str, Any] | None = None
    field: str = ""
    message: str = ""

    @property
    def valid(self) -> bool:
        return self.grade is not None


def _text(data: bytes) -> str:
    if b"\x00" in data:
        raise CdlError("The file is not text.")
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("latin-1")


def _stem(name: str) -> str:
    """A clip name without its extension (``A001C003.mov`` is ``A001C003``)."""
    return _EXTENSION.sub("", name.strip())


def _numbers(text: str) -> list[float] | None:
    try:
        return [float(part) for part in text.replace("(", " ").replace(")", " ").split()]
    except ValueError:
        return None


def _grade(label: str, names: list[str], sop: str | None, sat: str | None) -> Entry:
    """The entry for an event or row with an ``ASC_SOP``, an ``ASC_SAT`` or both."""
    raw: dict[str, Any] = {
        "slope": [1.0, 1.0, 1.0], "offset": [0.0, 0.0, 0.0], "power": [1.0, 1.0, 1.0],
        "saturation": 1.0,
    }  # fmt: skip
    if sop is not None:
        values = _numbers(sop)
        if values is None or len(values) != 9:
            return Entry(label, names, field="ASC_SOP", message=SOP_MESSAGE)
        raw.update(slope=values[0:3], offset=values[3:6], power=values[6:9])
    if sat is not None:
        values = _numbers(sat)
        if values is None or len(values) != 1:
            return Entry(label, names, field="ASC_SAT", message=SAT_MESSAGE)
        raw["saturation"] = values[0]
    try:
        return Entry(label, names, grade=clean_grade(raw))
    except GradeError as error:
        return Entry(label, names, field=error.field, message=error.message)


def _unique(names: list[str]) -> list[str]:
    seen: set[str] = set()
    kept: list[str] = []
    for name in names:
        key = name.upper()
        if name and key not in seen:
            seen.add(key)
            kept.append(name)
    return kept


@dataclass
class _Event:
    number: int
    reels: list[str] = field(default_factory=list)
    locators: list[str] = field(default_factory=list)
    to_clips: list[str] = field(default_factory=list)
    from_clips: list[str] = field(default_factory=list)
    sop: str | None = None
    sat: str | None = None
    twice: str = ""

    def entry(self) -> Entry | None:
        if self.sop is None and self.sat is None:
            return None
        label = f"event {self.number}"
        names = _unique([*self.locators, *self.to_clips, *self.from_clips, *self.reels])
        if self.twice:
            return Entry(
                label, names, field=self.twice, message=f"The event has two {self.twice} lines."
            )
        if not names:
            return Entry(label, names, field="id", message="The event names no shot.")
        return _grade(label, names, self.sop, self.sat)


def _locator(text: str) -> list[str]:
    match = _LOCATOR.match(text)
    if not match:
        return []
    words = match.group(1).split()
    if words and words[0].upper() in LOCATOR_COLOURS:
        words = words[1:]
    return [" ".join(words), *words] if len(words) > 1 else words


def _comment(event: _Event, text: str) -> None:
    upper = text.upper()
    for key in ("ASC_SOP", "ASC_SAT"):
        if upper.startswith(key):
            value = text[len(key) :].strip()
            attr = "sop" if key == "ASC_SOP" else "sat"
            if getattr(event, attr) is not None and getattr(event, attr) != value:
                event.twice = key
            setattr(event, attr, value)
            return
    if upper.startswith("LOC:"):
        event.locators.extend(_locator(text))
    elif upper.startswith("TO CLIP NAME:"):
        event.to_clips.append(_stem(text[len("TO CLIP NAME:") :]))
    elif upper.startswith("FROM CLIP NAME:"):
        event.from_clips.append(_stem(text[len("FROM CLIP NAME:") :]))


def parse_edl(data: bytes) -> tuple[list[Entry], int]:
    """The graded events of an EDL, in order, and how many events have no grade."""
    events: list[_Event] = []
    for line in _text(data).splitlines():
        stripped = line.strip()
        if stripped.startswith("*"):
            if events:
                _comment(events[-1], stripped[1:].strip())
            continue
        match = _EVENT.match(stripped)
        if not match:
            continue  # TITLE:, FCM:, an M2 or SPLIT line, an empty line
        number = int(match.group(1))
        if not events or events[-1].number != number:
            events.append(_Event(number))
        events[-1].reels.append(match.group(2))
    if not events:
        raise CdlError("The file is not an EDL: it holds no event.")
    return _entries(
        [event.entry() for event in events], "no event has an *ASC_SOP or *ASC_SAT comment"
    )


def parse_ale(data: bytes) -> tuple[list[Entry], int]:
    """The graded rows of an ALE, in order, and how many rows have no grade."""
    lines = _text(data).splitlines()
    marks = {line.strip().lower(): n for n, line in reversed(list(enumerate(lines)))}
    if "column" not in marks or "data" not in marks or marks["data"] < marks["column"]:
        raise CdlError("The file is not an ALE: it has no Column and Data sections.")
    header = next((line for line in lines[marks["column"] + 1 : marks["data"]] if line.strip()), "")
    columns = [name.strip().lower() for name in header.split("\t")]
    if "asc_sop" not in columns and "asc_sat" not in columns:
        raise CdlError("The ALE has no ASC_SOP or ASC_SAT column.")
    position = {name: n for n, name in reversed(list(enumerate(columns)))}
    entries: list[Entry | None] = []
    rows = [line for line in lines[marks["data"] + 1 :] if line.strip()]
    for number, line in enumerate(rows, start=1):
        cells = line.split("\t")

        def cell(name: str, cells: list[str] = cells) -> str:
            n = position.get(name)
            return cells[n].strip() if n is not None and n < len(cells) else ""

        sop, sat = cell("asc_sop") or None, cell("asc_sat") or None
        if sop is None and sat is None:
            entries.append(None)
            continue
        names = _unique(
            [_stem(cell(name)) if name == "name" else cell(name) for name in ALE_NAME_COLUMNS]
        )
        label = f"row {number}"
        entries.append(
            _grade(label, names, sop, sat)
            if names
            else Entry(label, field="id", message="The row names no shot.")
        )
    return _entries(entries, "no row has an ASC_SOP or ASC_SAT value")


def _entries(found: list[Entry | None], none: str) -> tuple[list[Entry], int]:
    graded = [entry for entry in found if entry is not None]
    if not graded:
        raise CdlError(f"The file holds no grade: {none}.")
    if len(graded) > MAX_CORRECTIONS:
        raise CdlError(f"The file holds more than {MAX_CORRECTIONS} grades.")
    return graded, len(found) - len(graded)


def parse(extension: str, data: bytes) -> tuple[list[Entry], int]:
    """``parse_edl`` or ``parse_ale`` by ``extension`` (``.edl``, ``.ale``); raises ``CdlError``."""
    return parse_edl(data) if extension == ".edl" else parse_ale(data)
