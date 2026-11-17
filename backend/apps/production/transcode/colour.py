"""
Colour management for review copies (review-pipeline RP-15, ADR-0041).

The studio's OpenColorIO config (``REVIEW_MEDIA_OCIO_CONFIG``) turns a copy's input colour space into
what an sRGB screen shows, through a view and an optional look. OpenColorIO bakes that whole transform
into one cineSpace LUT (a 1D shaper and a 3D cube), and the media worker's own ffmpeg applies it with
``lut3d``: the distribution's ffmpeg has no OpenColorIO filter (ADR-0041). The LUT is baked once per
transform and kept under the review media folder; each job copies it into its own folder, so no path
reaches a filter.

The config, the names it knows and the LUTs depend only on the setting, so they are cached for the
life of the process.
"""

from __future__ import annotations

import hashlib
import os
import uuid
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import PyOpenColorIO

#: a compiled module without type stubs
OCIO: Any = PyOpenColorIO

#: the cube's points per side and the shaper's length (RP-15 spike: within 2 of 255 on real pictures)
CUBE_SIZE = 65
SHAPER_SIZE = 4096
#: copies are watched in a browser, which draws them as sRGB (Q-RP-70)
_DISPLAY_PREFIX = "srgb"


class ColourUnavailable(Exception):
    """The config cannot be read or a LUT cannot be baked from it."""


class UnknownColour(ValueError):
    """A colour space, view or look the config does not know."""

    def __init__(self, field: str, value: str) -> None:
        super().__init__(f"{field}: {value}")
        self.field = field
        self.value = value


@dataclass(frozen=True)
class Target:
    """One transform: what ``probe.ocio`` records and what a LUT is baked for."""

    config: str
    input: str
    display: str
    view: str
    look: str

    def as_json(self) -> dict[str, str]:
        return asdict(self)


def config_source() -> str:
    from django.conf import settings

    return str(settings.REVIEW_MEDIA_OCIO_CONFIG)


@lru_cache(maxsize=4)
def _config(source: str) -> Any:
    try:
        config = OCIO.Config.CreateFromFile(source)
        config.validate()
    except Exception as error:  # OpenColorIO raises its own exception types
        raise ColourUnavailable(str(error)[:200]) from error
    return config


def config() -> Any:
    """The studio's config; raises ``ColourUnavailable``."""
    return _config(config_source())


def config_name() -> str:
    """The config's own name, or its file's name: never a server path (it goes into the probe)."""
    source = config_source()
    name = str(config().getName() or "")
    return name or (
        source.removeprefix("ocio://") if source.startswith("ocio://") else Path(source).name
    )


def display() -> str:
    """The config's sRGB display, or its default display when none is named for sRGB."""
    cfg = config()
    displays = list(cfg.getDisplays())
    found = next((d for d in displays if d.lower().startswith(_DISPLAY_PREFIX)), None)
    return found or str(cfg.getDefaultDisplay())


def _scene_space(name: str) -> Any | None:
    space = config().getColorSpace(name) if name else None
    if space is None or space.isData():
        return None
    if space.getReferenceSpaceType() != OCIO.REFERENCE_SPACE_SCENE:
        return None
    return space


def resolve_space(name: str) -> str | None:
    """The config's own name for ``name`` (a name, an alias or a role, any case), or ``None``."""
    space = _scene_space(name.strip())
    return str(space.getName()) if space is not None else None


def views() -> list[str]:
    cfg = config()
    return [str(v) for v in cfg.getViews(display())]


def default_view() -> str:
    return str(config().getDefaultView(display()))


def resolve_view(name: str) -> str | None:
    """The view ``name`` names (exactly, then ignoring case); blank is the default view."""
    name = name.strip()
    if not name:
        return default_view()
    known = views()
    return name if name in known else next((v for v in known if v.lower() == name.lower()), None)


def looks() -> list[str]:
    return [str(look.getName()) for look in config().getLooks()]


def resolve_look(name: str) -> str | None:
    """The look ``name`` names; blank is no look."""
    name = name.strip()
    if not name:
        return ""
    known = looks()
    return name if name in known else next((k for k in known if k.lower() == name.lower()), None)


def target(input_space: str, view: str = "", look: str = "") -> Target:
    """The transform for ``input_space`` through ``view`` and ``look``; raises ``UnknownColour``."""
    space = resolve_space(input_space)
    if space is None:
        raise UnknownColour("color_space", input_space)
    resolved_view = resolve_view(view)
    if resolved_view is None:
        raise UnknownColour("review_view", view)
    resolved_look = resolve_look(look)
    if resolved_look is None:
        raise UnknownColour("review_look", look)
    return Target(config_name(), space, display(), resolved_view, resolved_look)


def options() -> dict[str, Any]:
    """``GET review-media/colour/``: what a project may choose (Q-RP-70, Q-RP-71)."""
    cfg = config()
    spaces = [
        {
            "name": str(space.getName()),
            "family": str(space.getFamily() or ""),
            "encoding": str(space.getEncoding() or ""),
            "aliases": [str(alias) for alias in space.getAliases()],
        }
        for space in cfg.getColorSpaces(OCIO.SEARCH_REFERENCE_SPACE_SCENE, OCIO.COLORSPACE_ACTIVE)
        if not space.isData()
    ]
    return {
        "config": config_name(),
        "display": display(),
        "default_view": default_view(),
        "views": views(),
        "looks": looks(),
        "color_spaces": spaces,
    }


def _shaper(input_space: str) -> str | None:
    """A log space to sample scene-linear input through (values above 1 survive), or ``None``.

    The config's ``color_timing`` role (ACEScct in the ACES configs), when it is log encoded.
    Input that is already log or display encoded is sampled as it is.
    """
    cfg = config()
    space = cfg.getColorSpace(input_space)
    if space is None or str(space.getEncoding()) != "scene-linear":
        return None
    timing = cfg.getColorSpace("color_timing")
    if timing is not None and str(timing.getEncoding()) == "log":
        return str(timing.getName())
    return None


@lru_cache(maxsize=32)
def _bake(source: str, input_space: str, display_name: str, view: str, look: str) -> str:
    cfg = _config(source)
    baker = OCIO.Baker()
    baker.setConfig(cfg)
    baker.setFormat("cinespace")
    baker.setInputSpace(input_space)
    shaper = _shaper(input_space)
    if shaper:
        baker.setShaperSpace(shaper)
        baker.setShaperSize(SHAPER_SIZE)
    baker.setDisplayView(display_name, view)
    if look:
        baker.setLooks(look)
    baker.setCubeSize(CUBE_SIZE)
    return str(baker.bake())


def lut_key(target_: Target) -> str:
    raw = "\0".join((config_source(), target_.input, target_.display, target_.view, target_.look))
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def lut_for(target_: Target, folder: Path) -> Path:
    """The LUT of ``target_`` in ``folder`` (``<key>.csp``), baked once; raises ``ColourUnavailable``."""
    path = folder / f"{lut_key(target_)}.csp"
    if path.is_file():
        return path
    try:
        text = _bake(config_source(), target_.input, target_.display, target_.view, target_.look)
    except ColourUnavailable:
        raise
    except Exception as error:
        raise ColourUnavailable(str(error)[:200]) from error
    folder.mkdir(parents=True, exist_ok=True)
    partial = folder / f".{path.name}.{uuid.uuid4().hex}"
    partial.write_text(text, encoding="ascii")
    os.replace(partial, path)  # whole or absent, also with two workers baking at once
    return path
