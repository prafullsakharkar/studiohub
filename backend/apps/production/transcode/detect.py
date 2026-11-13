"""
What an uploaded review file is, from its first bytes (review-pipeline RP-5, ADR-0040).

The container found here chooses ffmpeg's demuxer. ffprobe and ffmpeg never guess a format, so a
file named ``.mp4`` that holds a playlist (HLS, concat) is refused here and never reaches them.
The extension must agree with the content. Pure: no Django, no I/O beyond the bytes given.
"""

from __future__ import annotations

from dataclasses import dataclass

#: how many leading bytes ``detect`` needs
HEAD_BYTES = 16


@dataclass(frozen=True)
class Container:
    key: str
    #: ffmpeg demuxer, forced with ``-f`` and the only one allowed (``-format_whitelist``)
    demuxer: str
    #: ``movie`` or ``still`` (``ReviewMedia.Kind``)
    kind: str
    extensions: frozenset[str]


CONTAINERS: dict[str, Container] = {
    c.key: c
    for c in (
        Container("mov", "mov", "movie", frozenset({"mov", "mp4", "m4v"})),
        Container("matroska", "matroska", "movie", frozenset({"mkv", "webm"})),
        Container("mxf", "mxf", "movie", frozenset({"mxf"})),
        Container("avi", "avi", "movie", frozenset({"avi"})),
        Container("jpeg", "jpeg_pipe", "still", frozenset({"jpg", "jpeg"})),
        Container("png", "png_pipe", "still", frozenset({"png"})),
        Container("tiff", "tiff_pipe", "still", frozenset({"tif", "tiff"})),
    )
}

#: every extension an upload may have (Q-RP-26: no EXR, no DPX)
ALLOWED_EXTENSIONS = frozenset(ext for c in CONTAINERS.values() for ext in c.extensions)

#: QuickTime / ISO base media top-level boxes a file may start with
_MOV_BOXES = (b"ftyp", b"moov", b"mdat", b"wide", b"free", b"skip", b"pnot")
_MXF_KEY = bytes.fromhex("060e2b34020501010d010201")


class UnknownContainer(ValueError):
    """The bytes are not one of the containers above, or do not match the extension."""


def extension_of(name: str) -> str:
    """The lower-case extension of an uploaded name, or ``""``."""
    base = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    return base.rsplit(".", 1)[-1].lower() if "." in base else ""


def sniff(head: bytes) -> Container | None:
    """The container the leading bytes show, or ``None``."""
    if len(head) >= 8 and head[4:8] in _MOV_BOXES:
        return CONTAINERS["mov"]
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return CONTAINERS["matroska"]
    if head.startswith(_MXF_KEY):
        return CONTAINERS["mxf"]
    if len(head) >= 12 and head.startswith(b"RIFF") and head[8:12] == b"AVI ":
        return CONTAINERS["avi"]
    if head.startswith(b"\xff\xd8\xff"):
        return CONTAINERS["jpeg"]
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return CONTAINERS["png"]
    if head.startswith((b"II*\x00", b"MM\x00*")):
        return CONTAINERS["tiff"]
    return None


def detect(name: str, head: bytes) -> Container:
    """The container of an upload named ``name`` starting with ``head``; raises ``UnknownContainer``."""
    extension = extension_of(name)
    if extension not in ALLOWED_EXTENSIONS:
        raise UnknownContainer("extension")
    container = sniff(head)
    if container is None or extension not in container.extensions:
        raise UnknownContainer("content")
    return container
