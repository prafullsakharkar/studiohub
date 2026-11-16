"""
Image sequences: what a frame is called, what it holds, and whether a sequence is whole
(review-pipeline RP-12, docs/review-pipeline/CONTRACTS.md C-RP-31, Q-RP-52 = A).

A frame's own name is only read for its number: it is stored as ``frame.<8 digits>.<extension>``
under the row's ``source/`` folder, and ffmpeg reads that folder through our own pattern. Pure: no
Django, no I/O beyond the bytes and names given.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

from apps.production.transcode import detect

#: the highest frame number (eight digits, the stored names' width)
MAX_FRAME_NUMBER = 99_999_999
#: the most frames one request may carry (Django refuses more than 100 files per request)
PART_MAX_FILES = 50
#: how many missing frame numbers an answer lists
MISSING_LISTED = 50
#: the longest sequence name
NAME_MAX_LENGTH = 200

_STEM = re.compile(r"(?s)(.*)[._-]([0-9]{1,8})")
_STORED = re.compile(r"frame\.([0-9]{8})\.([a-z]+)")


@dataclass(frozen=True)
class FrameFormat:
    key: str
    #: the only decoder ffmpeg may use for it (``-codec_whitelist`` and ``-c:v``)
    codec: str
    extensions: frozenset[str]
    #: shown through ``apply_trc`` from linear light to sRGB (EXR is scene-linear)
    linear: bool = False


FORMATS: dict[str, FrameFormat] = {
    f.key: f
    for f in (
        FrameFormat("exr", "exr", frozenset({"exr"}), linear=True),
        FrameFormat("dpx", "dpx", frozenset({"dpx"})),
        FrameFormat("tiff", "tiff", frozenset({"tif", "tiff"})),
        FrameFormat("png", "png", frozenset({"png"})),
        FrameFormat("jpeg", "mjpeg", frozenset({"jpg", "jpeg"})),
    )
}

#: every extension a sequence may have
EXTENSIONS = frozenset(ext for f in FORMATS.values() for ext in f.extensions)

_EXR_MAGIC = b"\x76\x2f\x31\x01"
_DPX_MAGIC = (b"SDPX", b"XPDS")


def format_for(extension: str) -> FrameFormat | None:
    """The frame format of a (lower-case) extension, or ``None``."""
    return next((f for f in FORMATS.values() if extension in f.extensions), None)


def sniff(head: bytes) -> FrameFormat | None:
    """The frame format the leading bytes show, or ``None``."""
    if head.startswith(_EXR_MAGIC):
        return FORMATS["exr"]
    if head.startswith(_DPX_MAGIC):
        return FORMATS["dpx"]
    container = detect.sniff(head)
    if container is not None and container.kind == "still":
        return FORMATS.get(container.key)
    return None


def valid_name(name: str) -> bool:
    """A sequence name: 1 to 200 printable characters, no path separator."""
    return (
        0 < len(name) <= NAME_MAX_LENGTH
        and name.isprintable()
        and "/" not in name
        and "\\" not in name
    )


def frame_number(filename: str, *, name: str, extension: str) -> int | None:
    """The frame number of ``filename`` when it is ``<name><. _ -><digits>.<extension>``, else ``None``."""
    base = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if detect.extension_of(base) != extension:
        return None
    match = _STEM.fullmatch(base[: -(len(extension) + 1)])
    if match is None or match.group(1) != name:
        return None
    number = int(match.group(2))
    return number if number <= MAX_FRAME_NUMBER else None


def stored_name(number: int, extension: str) -> str:
    """The name a frame is stored under."""
    return f"frame.{number:08d}.{extension}"


def stored_pattern(extension: str) -> str:
    """ffmpeg's ``image2`` pattern for the stored names."""
    return f"frame.%08d.{extension}"


def stored_numbers(names: Iterable[str], extension: str) -> set[int]:
    """The frame numbers among stored file names (anything else is ignored)."""
    numbers = set()
    for name in names:
        match = _STORED.fullmatch(name)
        if match is not None and match.group(2) == extension:
            numbers.add(int(match.group(1)))
    return numbers


def missing(
    received: Iterable[int], first: int, last: int, limit: int = MISSING_LISTED
) -> list[int]:
    """The first ``limit`` frame numbers of ``first``..``last`` not in ``received``."""
    have = set(received)
    out: list[int] = []
    for number in range(first, last + 1):
        if number not in have:
            out.append(number)
            if len(out) >= limit:
                break
    return out


def label(name: str, extension: str, first: int, last: int) -> str:
    """How the upload is shown (``source_name``)."""
    return f"{name}.[{first}-{last}].{extension}"[:255]
