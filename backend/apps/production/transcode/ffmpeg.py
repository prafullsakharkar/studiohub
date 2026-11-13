"""
The ffprobe and ffmpeg commands of the media worker (review-pipeline RP-5, ADR-0040).

Every command is an argument list (never a shell). Each input is read with its demuxer forced
(``-f``), that demuxer as the only one allowed (``-format_whitelist``), only the ``file`` protocol
(``-protocol_whitelist``) and an explicit ``file:`` URL, so no input can make ffmpeg open another
file or a network address. The builders are pure; ``run`` is the one place a program starts.
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


def _input(demuxer: str, source: Path, *, seek: float | None = None) -> list[str]:
    args = ["-protocol_whitelist", "file", "-format_whitelist", demuxer]
    if seek is not None:
        args += ["-ss", f"{seek:.3f}"]
    return [*args, "-f", demuxer, "-i", f"file:{source}"]


def probe_command(ffprobe: str, demuxer: str, source: Path) -> list[str]:
    return [
        ffprobe, "-v", "error", *_input(demuxer, source),
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


def proxy_command(ffmpeg: str, demuxer: str, source: Path, probe: Probe, out: Path) -> list[str]:
    """An H.264 MP4 at the source's constant rate, a key frame every second, ``+faststart``."""
    keyframes = max(1, round(probe.fps))
    return [
        ffmpeg, "-nostdin", "-v", "error", *_input(demuxer, source),
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", f"{_scale(PROXY_MAX_WIDTH)},format=yuv420p",
        "-fps_mode", "cfr", "-r", probe.frame_rate,
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-profile:v", "high",
        "-g", str(keyframes), "-keyint_min", str(keyframes),
        "-c:a", "aac", "-b:a", "192k", "-ac", "2",
        "-movflags", "+faststart", "-f", "mp4", "-y", str(out),
    ]  # fmt: skip


def still_command(ffmpeg: str, demuxer: str, source: Path, width: int, out: Path) -> list[str]:
    """One JPEG at most ``width`` wide, from a still."""
    return [
        ffmpeg, "-nostdin", "-v", "error", *_input(demuxer, source),
        "-frames:v", "1", "-vf", _scale(width), "-q:v", "3",
        "-f", "image2", "-update", "1", "-y", str(out),
    ]  # fmt: skip


def thumbnail_command(
    ffmpeg: str, demuxer: str, source: Path, probe: Probe, out: Path
) -> list[str]:
    """A JPEG of the middle frame, ``THUMBNAIL_WIDTH`` wide."""
    middle = probe.duration_seconds / 2 if probe.duration_seconds > 0 else 0.0
    return [
        ffmpeg, "-nostdin", "-v", "error", *_input(demuxer, source, seek=middle),
        "-frames:v", "1", "-vf", _scale(THUMBNAIL_WIDTH), "-q:v", "3",
        "-f", "image2", "-update", "1", "-y", str(out),
    ]  # fmt: skip


def filmstrip_layout(frames: int) -> tuple[int, int]:
    """``(step, tiles)``: every ``step``-th frame, ``tiles`` of them, at most ``FILMSTRIP_MAX_TILES``."""
    step = max(1, math.ceil(frames / FILMSTRIP_MAX_TILES))
    return step, max(1, math.ceil(frames / step))


def filmstrip_command(
    ffmpeg: str, demuxer: str, source: Path, probe: Probe, out: Path
) -> list[str]:
    """One JPEG strip of evenly spaced frames, ``FILMSTRIP_TILE_WIDTH`` wide each, left to right."""
    step, tiles = filmstrip_layout(probe.frames)
    return [
        ffmpeg, "-nostdin", "-v", "error", *_input(demuxer, source),
        "-vf", f"select=not(mod(n\\,{step})),scale={FILMSTRIP_TILE_WIDTH}:-2,tile={tiles}x1",
        "-frames:v", "1", "-fps_mode", "passthrough", "-q:v", "3",
        "-f", "image2", "-update", "1", "-y", str(out),
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
