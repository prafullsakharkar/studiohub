"""The console log colours each level differently, only for a terminal."""

import re
import sys

import pytest
import structlog

from apps.core.logging.structlog_config import _final_renderer

ANSI = re.compile(r"\x1b\[[0-9;]*m")
GREEN, YELLOW, RED, CYAN, BRIGHT = "\x1b[32m", "\x1b[33m", "\x1b[31m", "\x1b[36m", "\x1b[1m"


def render(level, *, colors):
    renderer = _final_renderer(False, colors=colors)
    return renderer(None, level, {"event": "something_happened", "level": level})


@pytest.mark.parametrize(
    ("level", "code"),
    [("info", GREEN), ("warning", YELLOW), ("error", RED), ("debug", CYAN)],
)
def test_each_level_has_its_own_colour(level, code):
    line = render(level, colors=True)

    assert code in line
    assert ANSI.sub("", line).count(level) >= 1


def test_the_four_levels_are_visibly_different():
    codes = {
        level: tuple(ANSI.findall(render(level, colors=True)))
        for level in ("debug", "info", "warning", "error")
    }

    assert len(set(codes.values())) == 4


def test_an_error_is_bold_red_not_the_same_as_a_warning():
    assert BRIGHT + RED in render("error", colors=True)
    assert BRIGHT + RED not in render("warning", colors=True)


@pytest.mark.parametrize("level", ["debug", "info", "warning", "error", "critical"])
def test_no_colour_codes_when_colours_are_off(level):
    assert "\x1b" not in render(level, colors=False)


def test_a_terminal_gets_colour_and_a_pipe_does_not(monkeypatch):
    monkeypatch.setattr(sys.stderr, "isatty", lambda: True, raising=False)
    assert "\x1b" in _final_renderer(False)(None, "warning", {"event": "x", "level": "warning"})

    monkeypatch.setattr(sys.stderr, "isatty", lambda: False, raising=False)
    assert "\x1b" not in _final_renderer(False)(None, "warning", {"event": "x", "level": "warning"})


def test_json_output_is_untouched_by_colours():
    renderer = _final_renderer(True, colors=True)

    assert isinstance(renderer, structlog.processors.JSONRenderer)
