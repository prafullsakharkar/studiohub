"""Path rules (DOM-PUB-03): the traversal corpus is refused everywhere a path is written."""

from __future__ import annotations

import os

import pytest

from apps.publishing.domain.paths import (
    PathRuleError,
    build_display_path,
    frame_file_name,
    is_sequence_pattern,
    normalize_relative_path,
    resolve_mount,
)

TRAVERSAL_CORPUS = [
    "../secret",
    "a/../../b",
    "a/..",
    "..",
    ".",
    "a/./b",
    "/etc/passwd",
    "~/x",
    "~root/x",
    "a\\b",
    "..\\..\\windows",
    "\\\\server\\share\\file.exr",
    "C:/Windows/system32",
    "c:file.exr",
    "a//b",
    "a/",
    "%2e%2e/secret",
    "a/%2E%2E/b",
    "a%2fb",
    "a%5cb",
    "a\x00b",
    "a\nb",
    "a\x7fb",
    "",
]


@pytest.mark.parametrize("value", TRAVERSAL_CORPUS, ids=lambda v: repr(v)[:30])
def test_the_traversal_corpus_is_refused(value):
    with pytest.raises(PathRuleError):
        normalize_relative_path(value)


@pytest.mark.parametrize(
    "value",
    ["plate.exr", "shot/v001/plate.exr", "shot/v001/plate.%04d.exr", "a b/c-d_e.f/g.####.exr"],
)
def test_clean_relative_paths_are_returned_unchanged(value):
    assert normalize_relative_path(value) == value


def test_a_path_or_segment_that_is_too_long_is_refused():
    with pytest.raises(PathRuleError):
        normalize_relative_path("a/" * 600 + "b")
    with pytest.raises(PathRuleError):
        normalize_relative_path("x" * 256)
    assert normalize_relative_path("x" * 255) == "x" * 255


def test_a_non_string_is_refused():
    with pytest.raises(PathRuleError):
        normalize_relative_path(None)  # pyright: ignore[reportArgumentType]


def test_sequence_patterns():
    assert is_sequence_pattern("s/plate.%04d.exr")
    assert is_sequence_pattern("s/plate.####.exr")
    assert not is_sequence_pattern("s/plate.exr")
    assert frame_file_name("s/plate.%04d.exr", 7) == "s/plate.0007.exr"
    assert frame_file_name("s/plate.####.exr", 1001) == "s/plate.1001.exr"
    assert frame_file_name("s/plate.%d.exr", 12) == "s/plate.12.exr"


def test_display_paths_join_for_people_only():
    assert build_display_path("/mnt/projects", "a/b.exr") == "/mnt/projects/a/b.exr"
    assert build_display_path("P:\\show", "a/b.exr", windows=True) == "P:\\show\\a\\b.exr"
    assert build_display_path("", "a/b.exr") == "a/b.exr"


def test_resolve_mount_stays_under_the_mount(tmp_path):
    (tmp_path / "a").mkdir()
    (tmp_path / "a" / "f.exr").write_text("x")
    assert resolve_mount(str(tmp_path), "a/f.exr") == (tmp_path / "a" / "f.exr").resolve()


def test_resolve_mount_refuses_a_symlink_that_leaves_the_mount(tmp_path):
    mount = tmp_path / "mount"
    outside = tmp_path / "outside"
    mount.mkdir()
    outside.mkdir()
    (outside / "secret.txt").write_text("secret")
    os.symlink(outside, mount / "link")

    with pytest.raises(PathRuleError):
        resolve_mount(str(mount), "link/secret.txt")


def test_resolve_mount_refuses_traversal_before_touching_the_disk(tmp_path):
    with pytest.raises(PathRuleError):
        resolve_mount(str(tmp_path), "../etc/passwd")
