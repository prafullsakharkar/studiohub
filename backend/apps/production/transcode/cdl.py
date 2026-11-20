"""
The client's ASC CDL files: ``.cc``, ``.ccc`` and ``.cdl`` (review-pipeline RP-20, C-RP-54; Q-RP-93).

A ``.cc`` file is one ``ColorCorrection``, a ``.ccc`` file a ``ColorCorrectionCollection`` of them and
a ``.cdl`` file a ``ColorDecisionList`` whose ``ColorDecision`` elements hold them. Each correction has
an ``id``, a ``SOPNode`` (``Slope``, ``Offset``, ``Power``: three numbers each) and a ``SatNode``
(``Saturation``); a missing node changes nothing, as the ASC's specification has it. Namespaces (v1.01,
v1.2) are ignored.

RP-27 (C-RP-62, Q-RP-121) writes a ``.ccc`` back out (``write_collection``), in the v1.01 namespace,
with each value as stored (six places), so a written file parsed again gives the same grades.

Parsed with the standard library (no ``defusedxml`` here; Expat 2.6 does not fetch external entities
and limits entity expansion). A document type declaration is refused first, by Expat itself so the
file's encoding cannot hide it: no CDL needs one, and it is where entities are declared.
"""

from __future__ import annotations

import xml.etree.ElementTree as ElementTree
from dataclasses import dataclass
from typing import Any
from xml.parsers import expat

from apps.production.validators.grade import PLACES, GradeError, clean_grade

#: the files accepted, by extension
EXTENSIONS = (".cc", ".ccc", ".cdl")
#: the most corrections one file may hold
MAX_CORRECTIONS = 2000
DECLARED = "The file declares a document type, which CDL files never need."
#: the namespace a written collection uses (the ASC CDL v1.01 schema every grading tool reads)
NAMESPACE = "urn:ASC:CDL:v1.01"
NOT_XML = "The file is not XML."


class CdlError(ValueError):
    """A file that is not a CDL file this server reads; the message says why."""


@dataclass
class Correction:
    """One ``ColorCorrection``: its id and its grade, or the field at fault and why."""

    id: str
    grade: dict[str, Any] | None = None
    field: str = ""
    message: str = ""

    @property
    def valid(self) -> bool:
        return self.grade is not None


def _local(tag: Any) -> str:
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _child(element: Any, name: str) -> Any | None:
    lowered = name.lower()
    # SatNode was spelled SATNode in v1.01; compare ignoring case
    return next((c for c in element if _local(c.tag).lower() == lowered), None)


def _numbers(text: str | None, count: int) -> list[float] | None:
    try:
        values = [float(part) for part in (text or "").split()]
    except ValueError:
        return None
    return values if len(values) == count else None


def _correction(element: Any) -> Correction:
    cc_id = (element.get("id") or "").strip()
    if not cc_id:
        return Correction("", field="id", message="The correction has no id.")
    raw: dict[str, Any] = {
        "slope": [1.0, 1.0, 1.0], "offset": [0.0, 0.0, 0.0], "power": [1.0, 1.0, 1.0],
        "saturation": 1.0,
    }  # fmt: skip
    sop = _child(element, "SOPNode")
    sat = _child(element, "SatNode")
    for name, node in (("slope", sop), ("offset", sop), ("power", sop), ("saturation", sat)):
        if node is None:
            continue
        part = _child(node, name)
        if part is None:
            continue
        values = _numbers(part.text, 1 if name == "saturation" else 3)
        if values is None:
            count = "one number" if name == "saturation" else "three numbers"
            return Correction(cc_id, field=name, message=f"{name} must be {count}.")
        raw[name] = values[0] if name == "saturation" else values
    try:
        return Correction(cc_id, grade=clean_grade(raw))
    except GradeError as error:
        return Correction(cc_id, field=error.field, message=error.message)


def _refuse(*_args: Any) -> None:
    raise CdlError(DECLARED)


def _refuse_declarations(data: bytes) -> None:
    """Raise ``CdlError`` when ``data`` declares a document type or an entity, or is not XML.

    Expat calls the handler as it reaches the declaration, before anything in it is expanded.
    """
    parser = expat.ParserCreate()
    parser.StartDoctypeDeclHandler = _refuse
    parser.EntityDeclHandler = _refuse
    parser.SetParamEntityParsing(expat.XML_PARAM_ENTITY_PARSING_NEVER)
    try:
        parser.Parse(data, True)
    except expat.ExpatError as error:
        raise CdlError(NOT_XML) from error


def parse(data: bytes) -> list[Correction]:
    """Every ``ColorCorrection`` in ``data``, in file order; raises ``CdlError``."""
    _refuse_declarations(data)
    try:
        # S314: no DOCTYPE, so no entity can be declared (``_refuse_declarations``)
        root = ElementTree.fromstring(data)  # noqa: S314
    except ElementTree.ParseError as error:
        raise CdlError(NOT_XML) from error
    kind = _local(root.tag)
    if kind == "ColorCorrection":
        elements = [root]
    elif kind == "ColorCorrectionCollection":
        elements = [c for c in root if _local(c.tag) == "ColorCorrection"]
    elif kind == "ColorDecisionList":
        elements = [
            c
            for decision in root
            if _local(decision.tag) == "ColorDecision"
            for c in decision
            if _local(c.tag) == "ColorCorrection"
        ]
    else:
        raise CdlError("The file is not a .cc, .ccc or .cdl file: it holds no ColorCorrection.")
    if not elements:
        raise CdlError("The file holds no ColorCorrection.")
    if len(elements) > MAX_CORRECTIONS:
        raise CdlError(f"The file holds more than {MAX_CORRECTIONS} corrections.")
    return [_correction(element) for element in elements]


@dataclass
class Entry:
    """One correction to write: the shot's code, its grade and where the grade came from."""

    id: str
    grade: dict[str, Any]
    description: str = ""


def _values(numbers: list[float]) -> str:
    return " ".join(f"{number:.{PLACES}f}" for number in numbers)


def write_collection(entries: list[Entry]) -> bytes:
    """
    RP-27 (C-RP-62): ``entries`` as a ``ColorCorrectionCollection``, UTF-8 with an XML declaration.

    ElementTree escapes every id and description; ``parse`` reads the result back to the same grades.
    """
    root = ElementTree.Element("ColorCorrectionCollection", {"xmlns": NAMESPACE})
    for entry in entries:
        correction = ElementTree.SubElement(root, "ColorCorrection", {"id": entry.id})
        if entry.description:
            ElementTree.SubElement(correction, "Description").text = entry.description
        sop = ElementTree.SubElement(correction, "SOPNode")
        for name in ("Slope", "Offset", "Power"):
            ElementTree.SubElement(sop, name).text = _values(entry.grade[name.lower()])
        sat = ElementTree.SubElement(correction, "SatNode")
        ElementTree.SubElement(sat, "Saturation").text = _values([entry.grade["saturation"]])
    ElementTree.indent(root, space="  ")
    return ElementTree.tostring(root, encoding="utf-8", xml_declaration=True) + b"\n"
