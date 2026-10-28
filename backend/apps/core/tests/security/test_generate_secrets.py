"""``manage.py generate_secrets`` produces strong, valid, independent values (TPN review TM-006)."""

from __future__ import annotations

import stat
from io import StringIO

import pytest
from cryptography.fernet import Fernet
from django.core.management import call_command
from django.core.management.base import CommandError


def run(*args):
    out = StringIO()
    call_command("generate_secrets", *args, stdout=out)
    return out.getvalue()


def parse(text):
    return dict(line.split("=", 1) for line in text.strip().splitlines())


def test_it_prints_every_secret_with_a_usable_value():
    values = parse(run())

    assert set(values) == {
        "DJANGO_SECRET_KEY",
        "API_KEY_PEPPER",
        "MFA_ENCRYPTION_KEY",
        "DELIVERY_SECRET_KEY",
        "REDIS_PASSWORD",
        "DB_PASSWORD",
    }
    assert len(values["DJANGO_SECRET_KEY"]) >= 64
    assert len(values["API_KEY_PEPPER"]) >= 48
    Fernet(values["MFA_ENCRYPTION_KEY"].encode())
    Fernet(values["DELIVERY_SECRET_KEY"].encode())
    assert values["MFA_ENCRYPTION_KEY"] != values["DELIVERY_SECRET_KEY"]
    assert all(c in "0123456789abcdef" for c in values["REDIS_PASSWORD"])
    assert len(values["REDIS_PASSWORD"]) == 64


def test_no_two_runs_share_a_value():
    first, second = parse(run()), parse(run())

    assert not set(first.values()) & set(second.values())


def test_the_signing_key_passes_the_deployment_strength_check(settings):
    from apps.core import checks

    settings.SECRET_KEY = parse(run())["DJANGO_SECRET_KEY"]

    assert checks.signing_key_is_not_weak(None) == []


def test_output_goes_to_a_private_new_file(tmp_path):
    target = tmp_path / "secrets.env"

    message = run("--output", str(target))

    assert "6 values" in message
    assert stat.S_IMODE(target.stat().st_mode) == 0o600
    assert set(parse(target.read_text())) >= {"DJANGO_SECRET_KEY", "API_KEY_PEPPER"}


def test_it_never_overwrites_a_file(tmp_path):
    target = tmp_path / "secrets.env"
    target.write_text("keep me")

    with pytest.raises(CommandError):
        run("--output", str(target))

    assert target.read_text() == "keep me"
