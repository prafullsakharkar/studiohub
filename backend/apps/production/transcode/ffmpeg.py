"""
The ffprobe and ffmpeg commands of the media worker (review-pipeline RP-5, ADR-0040; RP-12).

Every command is an argument list (never a shell). Each input is read with its demuxer forced
(``-f``), that demuxer as the only one allowed (``-format_whitelist``), only the ``file`` protocol
(``-protocol_whitelist``) and an explicit ``file:`` URL, so no input can make ffmpeg open another
file or a network address. A sequence also forces its decoder (``-codec_whitelist``). Burn-in text
is read from files with expansion off, never written into a filter. A colour-managed input (RP-15)
is read through the LUT ``COLOUR_LUT`` in the job's folder, before scaling and burn-ins. The builders
are pure; ``run`` is the one place a program starts.
"""

from __future__ import annotations

import json
import math
import subprocess
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Any

#: the widest proxy and still (pixels); narrower sources keep their width
PROXY_MAX_WIDTH = 1920
THUMBNAIL_WIDTH = 480
FILMSTRIP_TILE_WIDTH = 240
FILMSTRIP_MAX_TILES = 60
#: larger pictures are refused before decoding (``unsupported_stream``)
MAX_DIMENSION = 16384

#: the baked OpenColorIO LUT in a job's folder (RP-15, ``transcode/colour.py``)
COLOUR_LUT = "colour.csp"

PROBE_TIMEOUT_SECONDS = 120
TRANSCODE_TIMEOUT_SECONDS = 25 * 60


class ProbeError(ValueError):
    """ffprobe's answer has no picture the worker can use."""


@dataclass(frozen=True)
class Probe:
    width: int
    height: int
    #: the exact rate, e.g. ``24000/1001``; ``fps`` is its rounded value
    frame_rate: str
    frames: int
    duration_seconds: float
    video_codec: str
    has_audio: bool

    @property
    def fps(self) -> float:
        return round(float(Fraction(self.frame_rate)), 3)

    def as_json(self) -> dict[str, Any]:
        return {
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
            "frame_rate": self.frame_rate,
            "frames": self.frames,
            "duration_seconds": self.duration_seconds,
            "video_codec": self.video_codec,
            "has_audio": self.has_audio,
        }


@dataclass(frozen=True)
class MovieInput:
    """One uploaded movie or still, read with the demuxer its first bytes chose.

    ``colour``: its picture goes through ``COLOUR_LUT`` (RP-15, an upload that named its colour space).
    """

    demuxer: str
    source: Path
    colour: bool = False

    def args(self, *, seek: float | None = None, decode: bool = True) -> list[str]:
        args = ["-protocol_whitelist", "file", "-format_whitelist", self.demuxer]
        if seek is not None:
            args += ["-ss", f"{seek:.3f}"]
        return [*args, "-f", self.demuxer, "-i", f"file:{self.source}"]


@dataclass(frozen=True)
class SequenceInput:
    """The stored frames of a sequence (RP-12, C-RP-32), read in order from ``first``.

    ``pattern`` is our own (``frame.%08d.<ext>``, relative to the job's folder, so no ``%`` of
    MEDIA_ROOT can reach it). Only ``image2`` and the frame format's own decoder may be used. With
    ``colour`` the frames go through ``COLOUR_LUT`` (RP-15) and are decoded as they are stored;
    otherwise an EXR is turned from linear light to sRGB with the decoder's ``apply_trc`` (RP-12).
    """

    codec: str
    pattern: str
    first: int
    frame_rate: str
    linear: bool = False
    colour: bool = False

    def args(self, *, seek: float | None = None, decode: bool = True) -> list[str]:
        args = [
            "-protocol_whitelist", "file", "-format_whitelist", "image2",
            "-codec_whitelist", self.codec,
        ]  # fmt: skip
        if seek is not None:
            args += ["-ss", f"{seek:.3f}"]
        args += [
            "-f", "image2", "-pattern_type", "sequence",
            "-start_number", str(self.first), "-framerate", self.frame_rate,
        ]  # fmt: skip
        if decode:
            args += ["-c:v", self.codec]
            if self.linear and not self.colour:
                args += ["-apply_trc", "iec61966_2_1"]
        return [*args, "-i", f"file:{self.pattern}"]


Input = MovieInput | SequenceInput

#: common video rates written as decimals, and the exact rationals they stand for
_NTSC = {
    Fraction(23976, 1000): Fraction(24000, 1001),
    Fraction(29970, 1000): Fraction(30000, 1001),
    Fraction(47952, 1000): Fraction(48000, 1001),
    Fraction(59940, 1000): Fraction(60000, 1001),
}


def rate_of(fps: Any) -> str:
    """A version's ``fps`` (a decimal) as the exact rate ffmpeg reads frames at; ``24/1`` when unusable."""
    try:
        rate = Fraction(str(fps)).limit_denominator(1001)
    except (ValueError, ZeroDivisionError):
        rate = Fraction(0)
    rate = _NTSC.get(Fraction(str(round(float(rate), 3))), rate) if rate > 0 else rate
    if not 0 < rate <= 1000:
        rate = Fraction(24)
    return f"{rate.numerator}/{rate.denominator}"


def probe_command(ffprobe: str, source: Input) -> list[str]:
    return [
        ffprobe, "-v", "error", *source.args(decode=False),
        "-count_packets", "-show_streams", "-show_format", "-of", "json",
    ]  # fmt: skip


def _rate(text: str | None) -> Fraction | None:
    try:
        rate = Fraction(str(text))
    except (ValueError, ZeroDivisionError):
        return None
    return rate if 0 < rate <= 1000 else None


def parse_probe(raw: str, *, kind: str) -> Probe:
    """The probe of ffprobe's JSON answer; raises ``ProbeError`` when it has no usable picture."""
    try:
        data = json.loads(raw or "{}")
    except json.JSONDecodeError as error:
        raise ProbeError("json") from error
    streams = data.get("streams") or []
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video is None:
        raise ProbeError("no video stream")
    width, height = int(video.get("width") or 0), int(video.get("height") or 0)
    if not (0 < width <= MAX_DIMENSION and 0 < height <= MAX_DIMENSION):
        raise ProbeError("dimensions")
    has_audio = any(s.get("codec_type") == "audio" for s in streams)
    codec = str(video.get("codec_name") or "")[:40]
    if kind == "still":
        return Probe(width, height, "1/1", 1, 0.0, codec, False)

    rate = _rate(video.get("avg_frame_rate")) or _rate(video.get("r_frame_rate"))
    if rate is None:
        raise ProbeError("frame rate")
    try:
        duration = float(video.get("duration") or (data.get("format") or {}).get("duration") or 0)
    except ValueError:
        duration = 0.0
    frames = 0
    for key in ("nb_read_packets", "nb_frames"):
        try:
            frames = int(video.get(key) or 0)
        except ValueError:
            frames = 0
        if frames > 0:
            break
    if frames <= 0 and duration > 0:
        frames = round(duration * rate)
    if frames <= 0:
        raise ProbeError("no frames")
    if duration <= 0:
        duration = float(frames / rate)
    rate_text = f"{rate.numerator}/{rate.denominator}"
    return Probe(width, height, rate_text, frames, round(duration, 3), codec, has_audio)


def _scale(width: int) -> str:
    """Scale to at most ``width`` pixels wide, even width and height (H.264 and JPEG are happiest)."""
    return f"scale=trunc(min({width}\\,iw)/2)*2:-2"


def _colour(source: Input) -> str:
    """The colour transform that comes first in every picture made from ``source`` (RP-15), or ``""``."""
    return f"lut3d=file={COLOUR_LUT}:interp=tetrahedral," if source.colour else ""


@dataclass(frozen=True)
class BurnIn:
    """What a review copy carries burnt in (RP-12, C-RP-33). Text never enters the filter graph."""

    top_left: str
    top_right: str
    bottom_left: str
    #: the number drawn on the first frame; the counter adds the frame's index
    first_frame: int


#: the files a burn-in reads, in the job's folder: the font, then one text per corner
BURN_IN_FONT = "burn_font.ttf"
BURN_IN_FILES = ("burn_tl.txt", "burn_tr.txt", "burn_bl.txt", "burn_br.txt")
_CORNERS = (
    ("x=16", "y=16", "none"),
    ("x=w-tw-16", "y=16", "none"),
    ("x=16", "y=h-th-16", "none"),
    ("x=w-tw-16", "y=h-th-16", "normal"),
)


def _plain(text: str) -> str:
    """One line of text: control characters (newlines, tabs) become spaces."""
    return "".join(ch if ch.isprintable() else " " for ch in text).strip()[:200]


def burn_in_texts(burn_in: BurnIn) -> dict[str, str]:
    """The content of each burn-in text file.

    The first three are drawn as they are (``expansion=none``: a ``%`` or a quote is just a
    character). Only the frame counter is expanded, and the code writes its whole template.
    """
    counter = f"%{{eif:n+{int(burn_in.first_frame)}:d}}"
    texts = (
        _plain(burn_in.top_left),
        _plain(burn_in.top_right),
        _plain(burn_in.bottom_left),
        counter,
    )
    return dict(zip(BURN_IN_FILES, texts, strict=True))


def burn_in_filter() -> str:
    """The ``drawtext`` filters of a burn-in: fixed names and positions, no text of ours or theirs."""
    common = f"fontfile={BURN_IN_FONT}:fontcolor=white:fontsize=h/36:box=1:boxcolor=black@0.5:boxborderw=6"
    return ",".join(
        f"drawtext={common}:textfile={name}:expansion={expansion}:{x}:{y}"
        for name, (x, y, expansion) in zip(BURN_IN_FILES, _CORNERS, strict=True)
    )


def proxy_command(
    ffmpeg: str, source: Input, probe: Probe, out: Path, *, burn_in: bool = False
) -> list[str]:
    """An H.264 MP4 at the source's constant rate, a key frame every second, ``+faststart``.

    With ``burn_in`` the job's folder must hold ``burn_in_texts`` and the font (``BURN_IN_FONT``).
    """
    keyframes = max(1, round(probe.fps))
    # the colour transform first, burn-ins last: their text is drawn on the finished picture
    picture = (
        _colour(source) + _scale(PROXY_MAX_WIDTH) + (f",{burn_in_filter()}" if burn_in else "")
    )
    return [
        ffmpeg, "-nostdin", "-v", "error", *source.args(),
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", f"{picture},format=yuv420p",
        "-fps_mode", "cfr", "-r", probe.frame_rate,
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-profile:v", "high",
        "-g", str(keyframes), "-keyint_min", str(keyframes),
        "-c:a", "aac", "-b:a", "192k", "-ac", "2",
        "-movflags", "+faststart", "-f", "mp4", "-y", str(out),
    ]  # fmt: skip


def still_command(ffmpeg: str, source: Input, width: int, out: Path) -> list[str]:
    """One JPEG at most ``width`` wide, from a still."""
    return [
        ffmpeg, "-nostdin", "-v", "error", *source.args(),
        "-frames:v", "1", "-vf", _colour(source) + _scale(width), "-q:v", "3",
        "-f", "image2", "-update", "1", "-y", str(out),
    ]  # fmt: skip


def thumbnail_command(ffmpeg: str, source: Input, probe: Probe, out: Path) -> list[str]:
    """A JPEG of the middle frame, ``THUMBNAIL_WIDTH`` wide."""
    middle = probe.duration_seconds / 2 if probe.duration_seconds > 0 else 0.0
    return [
        ffmpeg, "-nostdin", "-v", "error", *source.args(seek=middle),
        "-frames:v", "1", "-vf", _colour(source) + _scale(THUMBNAIL_WIDTH), "-q:v", "3",
        "-f", "image2", "-update", "1", "-y", str(out),
    ]  # fmt: skip


def filmstrip_layout(frames: int) -> tuple[int, int]:
    """``(step, tiles)``: every ``step``-th frame, ``tiles`` of them, at most ``FILMSTRIP_MAX_TILES``."""
    step = max(1, math.ceil(frames / FILMSTRIP_MAX_TILES))
    return step, max(1, math.ceil(frames / step))


def filmstrip_command(ffmpeg: str, source: Input, probe: Probe, out: Path) -> list[str]:
    """One JPEG strip of evenly spaced frames, ``FILMSTRIP_TILE_WIDTH`` wide each, left to right."""
    step, tiles = filmstrip_layout(probe.frames)
    # the frames are picked before the colour transform, so only the picked ones go through it
    picture = f"select=not(mod(n\\,{step})),{_colour(source)}scale={FILMSTRIP_TILE_WIDTH}:-2,tile={tiles}x1"
    return [
        ffmpeg, "-nostdin", "-v", "error", *source.args(),
        "-vf", picture,
        "-frames:v", "1", "-fps_mode", "passthrough", "-q:v", "3",
        "-f", "image2", "-update", "1", "-y", str(out),
    ]  # fmt: skip


# ---------------------------------------------------------------------------- slate (RP-25, C-RP-59)

#: how long the slate before a downloaded copy holds
SLATE_SECONDS = 2
#: the job's files: the card, the list the join reads, the download it makes
SLATE_CARD = "slate.mp4"
SLATE_LIST = "slate.txt"
SLATE_DOWNLOAD = "download.mp4"
#: one text file per line of the slate, read by ``drawtext`` with expansion off
SLATE_LINES = tuple(f"slate_{n}.txt" for n in range(1, 9))
#: our own outputs, read back: MP4 only, through the ``file`` protocol only
_OWN_MP4 = ["-protocol_whitelist", "file", "-format_whitelist", "mov"]


@dataclass(frozen=True)
class CopyFormat:
    """What a made copy is encoded as, read back from it, so the card is encoded the same way."""

    width: int
    height: int
    frame_rate: str
    sample_aspect_ratio: str
    #: the audio's sample rate, or ``None`` for a copy without audio
    audio_rate: int | None

    @property
    def card_frames(self) -> int:
        return max(1, round(SLATE_SECONDS * Fraction(self.frame_rate)))


def copy_probe_command(ffprobe: str, path: Path) -> list[str]:
    return [
        ffprobe, "-v", "error", *_OWN_MP4, "-show_streams", "-of", "json", f"file:{path}",
    ]  # fmt: skip


def parse_copy_format(raw: str) -> CopyFormat:
    try:
        streams = json.loads(raw).get("streams", [])
        video = next(s for s in streams if s.get("codec_type") == "video")
        audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
        rate = Fraction(str(video.get("r_frame_rate") or video["avg_frame_rate"]))
        sar = str(video.get("sample_aspect_ratio") or "1:1")
        return CopyFormat(
            width=int(video["width"]),
            height=int(video["height"]),
            frame_rate=f"{rate.numerator}/{rate.denominator}",
            sample_aspect_ratio="1:1" if sar in ("0:1", "N/A") else sar,
            audio_rate=int(audio["sample_rate"]) if audio else None,
        )
    except (ValueError, KeyError, TypeError, StopIteration, ZeroDivisionError) as error:
        raise ProbeError(f"the copy cannot be read back: {error}") from error


def slate_texts(lines: list[str]) -> dict[str, str]:
    """The content of each slate line's file: empty lines left out, the rest one plain line each."""
    kept = [text for text in (_plain(line) for line in lines) if text][: len(SLATE_LINES)]
    return dict(zip(SLATE_LINES, kept, strict=False))


#: a glyph of the burn-in font is at most this wide, as a share of its size (DejaVu Sans: about 0.6)
_GLYPH_WIDTH = 0.62


def slate_font_size(made: CopyFormat, line: int, characters: int) -> int:
    """The size (pixels) of the slate's ``line``-th line: the first larger, and every line small enough to fit
    inside the card's margins whatever its length (a long code or a 120-character line)."""
    usual = made.height / (18 if line == 0 else 30)
    fits = made.width * 0.84 / (_GLYPH_WIDTH * max(characters, 1))
    return max(8, int(min(usual, fits)))


def _slate_filter(made: CopyFormat, lengths: list[int]) -> str:
    """The card's ``drawtext`` filters, one per line file; text never in the graph."""
    common = f"fontfile={BURN_IN_FONT}:fontcolor=white:expansion=none:x=w*0.08"
    return ",".join(
        f"drawtext={common}:textfile={name}:fontsize={slate_font_size(made, n, length)}"
        f":y=h*{0.14 + 0.09 * n:.2f}"
        for n, (name, length) in enumerate(zip(SLATE_LINES, lengths, strict=False))
    )


def slate_command(ffmpeg: str, made: CopyFormat, lengths: list[int], out: Path) -> list[str]:
    """The card: black, one line of text per entry of ``lengths`` (each line's length in characters),
    ``SLATE_SECONDS`` long, encoded as ``proxy_command`` encodes.

    Same size, sample aspect ratio, rate, profile and pixel format as the copy, and silent stereo AAC
    at the copy's sample rate when the copy has audio, so the two can be joined without re-encoding.
    """
    keyframes = max(1, round(float(Fraction(made.frame_rate))))
    args = [
        ffmpeg, "-nostdin", "-v", "error",
        "-f", "lavfi", "-i", f"color=c=black:s={made.width}x{made.height}:r={made.frame_rate}",
    ]  # fmt: skip
    if made.audio_rate:
        args += ["-f", "lavfi", "-i", f"anullsrc=r={made.audio_rate}:cl=stereo"]
    seconds = Fraction(made.card_frames) / Fraction(made.frame_rate)
    args += [
        "-map", "0:v:0", *(["-map", "1:a:0"] if made.audio_rate else []),
        "-vf", f"{_slate_filter(made, lengths)},setsar={made.sample_aspect_ratio.replace(':', '/')},format=yuv420p",
        "-frames:v", str(made.card_frames), "-t", f"{float(seconds):.6f}",
        "-fps_mode", "cfr", "-r", made.frame_rate,
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-profile:v", "high",
        "-g", str(keyframes), "-keyint_min", str(keyframes),
    ]  # fmt: skip
    if made.audio_rate:
        args += ["-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", str(made.audio_rate)]
    return [*args, "-f", "mp4", "-y", str(out)]


def slate_list() -> str:
    """The join's list: the card, then the copy (both our own names, in the job's folder)."""
    return f"file '{SLATE_CARD}'\nfile 'proxy.mp4'\n"


def join_command(ffmpeg: str, out: Path) -> list[str]:
    """The card and the copy as one file, the copy's frames copied as they are (``-c copy``)."""
    return [
        ffmpeg, "-nostdin", "-v", "error",
        "-protocol_whitelist", "file", "-format_whitelist", "concat,mov",
        "-f", "concat", "-i", f"file:{SLATE_LIST}",
        "-map", "0", "-c", "copy", "-movflags", "+faststart", "-f", "mp4", "-y", str(out),
    ]  # fmt: skip


def frame_count_command(ffprobe: str, path: Path) -> list[str]:
    """How many video frames ``path`` holds, counted from its packets."""
    return [
        ffprobe, "-v", "error", *_OWN_MP4, "-select_streams", "v:0", "-count_packets",
        "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", f"file:{path}",
    ]  # fmt: skip


def decode_check_command(ffmpeg: str, path: Path) -> list[str]:
    """Decode every frame of ``path`` and stop at the first error: a join that went wrong fails here."""
    return [
        ffmpeg, "-nostdin", "-v", "error", "-xerror", *_OWN_MP4, "-f", "mov",
        "-i", f"file:{path}", "-map", "0:v:0", "-f", "null", "-",
    ]  # fmt: skip


def run(args: list[str], *, cwd: Path, timeout: int) -> subprocess.CompletedProcess[str]:
    """Run one command; raises ``subprocess.TimeoutExpired``, never runs a shell."""
    return subprocess.run(  # noqa: S603 - an argument list built above, never a shell
        args,
        cwd=cwd,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
