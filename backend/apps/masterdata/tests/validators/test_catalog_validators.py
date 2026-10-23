"""Pure validator rules (no database)."""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.masterdata.validators import catalog as v


@pytest.mark.parametrize("value", [123, ["x"], {"a": 1}])
def test_text_must_be_a_string(value):
    with pytest.raises(ValidationError):
        v.clean_text(value, "code", required=True, max_length=10)


def test_text_is_trimmed_and_none_means_blank():
    assert v.clean_text("  a  ", "code", required=True, max_length=10) == "a"
    assert v.clean_text(None, "description", required=False, max_length=10) == ""


@pytest.mark.parametrize("value", ["a\nb", "a\x00b", "a\tb"])
def test_control_characters_are_refused(value):
    with pytest.raises(ValidationError):
        v.clean_text(value, "name", required=True, max_length=20)


def test_scope_defaults_to_global_and_refuses_everything_else():
    assert (
        v.clean_scope(None) == "GLOBAL"
        and v.clean_scope("") == "GLOBAL"
        and v.clean_scope("GLOBAL") == "GLOBAL"
    )
    with pytest.raises(ValidationError):
        v.clean_scope("ORGANIZATION")
    with pytest.raises(ValidationError):
        v.clean_scope("anything")


def test_metadata_must_be_an_object():
    assert v.clean_metadata(None) == {}
    assert v.clean_metadata({"a": 1}) == {"a": 1}
    for bad in ([], "x", 1):
        with pytest.raises(ValidationError):
            v.clean_metadata(bad)


@pytest.mark.parametrize("value", ["#fff", "#FFFA", "#FF00AA", "#ff00aa80", "red", "dark-blue", ""])
def test_valid_colors(value):
    assert v.clean_color(value) == value


@pytest.mark.parametrize(
    "value",
    [
        "<script>",
        "#xyz",
        "red blue",
        "1red",
        "url(x)",
        "#12345",
        "#1234567",
        "#ff",
        "#ff00aa8",  # hex digit counts CSS does not allow
        "rgb(1,2,3)",
        "rgba(1,2,3,.5)",
        "hsl(0,0%,0%)",
        "var(--x)",  # functional notation
    ],
)
def test_invalid_colors(value):
    with pytest.raises(ValidationError):
        v.clean_color(value)


def test_entity_type_and_category_enums():
    assert v.clean_entity_type("Task") == "Task"
    assert (
        v.clean_category("") == ""
        and v.clean_category(None) == ""
        and v.clean_category("done") == "done"
    )
    with pytest.raises(ValidationError):
        v.clean_entity_type("task")
    with pytest.raises(ValidationError):
        v.clean_category("Done")


@pytest.mark.parametrize("value", [-1, True, 1.5, "3", None])
def test_non_negative_int_rejects(value):
    with pytest.raises(ValidationError):
        v.clean_non_negative_int(value, "order")


def test_non_negative_int_accepts_zero_and_up():
    assert v.clean_non_negative_int(0, "order") == 0
    assert v.clean_non_negative_int(7, "order") == 7
