"""Natural version ordering key (DOM-MD-SW-06). Pure functions, no database."""

from __future__ import annotations

import pytest

from apps.masterdata.versioning import KEY_MAX_LENGTH, natural_version_key


def _sorted(versions):
    return sorted(versions, key=natural_version_key)


def test_numbers_compare_numerically_not_lexically():
    assert _sorted(["10", "9", "2", "100"]) == ["2", "9", "10", "100"]


def test_dotted_versions():
    assert _sorted(["2025.10", "2025.2", "2025.1", "2024.9"]) == [
        "2024.9",
        "2025.1",
        "2025.2",
        "2025.10",
    ]


def test_a_release_sorts_before_its_service_pack():
    assert _sorted(["2025sp1", "2025", "2025.1"]) == ["2025", "2025.1", "2025sp1"]


def test_case_is_ignored():
    assert natural_version_key("2025SP1") == natural_version_key("2025sp1")


@pytest.mark.parametrize("value", ["", None, "...", "---"])
def test_empty_or_symbol_only_input_gives_an_empty_key(value):
    assert natural_version_key(value) == ""


def test_the_key_never_exceeds_the_column():
    assert len(natural_version_key("9" * 50 + "." + "1" * 50)) <= KEY_MAX_LENGTH
