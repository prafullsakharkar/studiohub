"""Checksum verification on mounted storage roots (DOM-PUB-04, decision Q25)."""

from __future__ import annotations

import hashlib
import os

import pytest

from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.models import PublishedFile
from apps.publishing.services.files import PublishedFileService
from apps.publishing.tasks.verify import (
    compute_checksum,
    sequence_digest,
    verify_file,
    verify_pending,
)
from apps.publishing.tests.helpers import (
    member,
    published_version,
    registration,
    request_for,
    storage_root,
)

pytestmark = pytest.mark.django_db


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@pytest.fixture
def mount(tmp_path, settings):
    settings.PUBLISHING_STORAGE_MOUNTS = {"PROJECTS": str(tmp_path)}
    return tmp_path


@pytest.fixture
def register(project, root):
    user = member(project, P.CREATE)
    version = published_version(project)

    def go(path, **over):
        file, _ = PublishedFileService.register(
            actor=user,
            request=request_for(user),
            version_id=version.pk,
            data=registration(version, root, path, **over),
        )
        return file

    return go


def _write(mount, relative, data=b"pixels"):
    target = mount / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


def test_a_matching_file_is_verified(mount, register):
    _write(mount, "s/plate.exr")
    file = register("s/plate.exr", sha256=sha(b"pixels"))

    assert verify_file(str(file.pk)) == "verified"

    file.refresh_from_db()
    assert file.checksum_state == "verified"
    assert file.checksum_checked_at is not None


def test_a_different_file_is_a_mismatch_and_the_declared_checksum_is_kept(mount, register):
    _write(mount, "s/plate.exr", b"changed after publish")
    declared = sha(b"pixels")
    file = register("s/plate.exr", sha256=declared)

    assert verify_file(str(file.pk)) == "mismatch"

    file.refresh_from_db()
    assert (file.checksum_state, file.sha256) == ("mismatch", declared)


def test_a_file_that_is_not_there_is_missing(mount, register):
    file = register("s/gone.exr")

    assert verify_file(str(file.pk)) == "missing"


def test_a_large_file_is_hashed_in_chunks(mount, register):
    data = os.urandom(3 * 1024 * 1024 + 17)
    _write(mount, "big.bin", data)
    file = register("big.bin", sha256=sha(data), size_bytes=len(data))

    assert verify_file(str(file.pk)) == "verified"


def test_a_root_without_a_mount_is_skipped(register, settings):
    settings.PUBLISHING_STORAGE_MOUNTS = {}
    file = register("s/plate.exr")

    assert verify_file(str(file.pk)) is None
    file.refresh_from_db()
    assert file.checksum_state == "declared"


def test_an_unknown_file_id_is_ignored():
    assert verify_file("00000000-0000-0000-0000-000000000000") is None


def test_a_path_leaving_the_mount_through_a_symlink_is_never_read(tmp_path, settings, register):
    mount = tmp_path / "mount"
    outside = tmp_path / "outside"
    mount.mkdir()
    outside.mkdir()
    (outside / "secret.bin").write_bytes(b"secret")
    os.symlink(outside, mount / "link")
    settings.PUBLISHING_STORAGE_MOUNTS = {"PROJECTS": str(mount)}
    # The attacker declares the secret file's real checksum: a read would "verify" it.
    file = register("link/secret.bin", sha256=sha(b"secret"), size_bytes=6)

    assert verify_file(str(file.pk)) == "missing"


class TestSequences:
    FRAMES = {1001: b"a", 1002: b"b", 1003: b"c"}

    def _expected(self):
        return sequence_digest([(f"plate.{n}.exr", sha(data)) for n, data in self.FRAMES.items()])

    def test_the_digest_is_the_sha256sum_listing_sorted_by_name(self):
        lines = f"a.1.exr  {sha(b'x')}\nb.1.exr  {sha(b'y')}\n"
        assert sequence_digest([("b.1.exr", sha(b"y")), ("a.1.exr", sha(b"x"))]) == sha(
            lines.encode()
        )

    def test_a_complete_sequence_is_verified(self, mount, register):
        for number, data in self.FRAMES.items():
            _write(mount, f"s/plate.{number}.exr", data)
        file = register(
            "s/plate.%04d.exr", sha256=self._expected(), frame_start=1001, frame_end=1003
        )

        assert verify_file(str(file.pk)) == "verified"

    def test_one_missing_frame_makes_the_sequence_missing(self, mount, register):
        for number in (1001, 1003):
            _write(mount, f"s/plate.{number}.exr", self.FRAMES[number])
        file = register(
            "s/plate.%04d.exr", sha256=self._expected(), frame_start=1001, frame_end=1003
        )

        assert verify_file(str(file.pk)) == "missing"

    def test_one_changed_frame_is_a_mismatch(self, mount, register):
        for number, data in self.FRAMES.items():
            _write(mount, f"s/plate.{number}.exr", data if number != 1002 else b"CHANGED")
        file = register(
            "s/plate.%04d.exr", sha256=self._expected(), frame_start=1001, frame_end=1003
        )

        assert verify_file(str(file.pk)) == "mismatch"


def test_compute_checksum_returns_none_for_a_directory(mount, register):
    (mount / "adir").mkdir()
    file = register("adir")

    assert compute_checksum(str(mount), PublishedFile.objects.get(pk=file.pk)) is None


def test_registering_queues_nothing_because_no_celery_app_exists(
    mount, register, django_capture_on_commit_callbacks
):
    _write(mount, "s/plate.exr")

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        file = register("s/plate.exr", sha256=sha(b"pixels"))

    assert callbacks == []
    file.refresh_from_db()
    assert file.checksum_state == "declared"


class TestVerifyPending:
    def test_it_verifies_declared_files_on_mounted_roots_only(self, mount, register):
        _write(mount, "ok.exr")
        _write(mount, "bad.exr", b"other")
        good = register("ok.exr", sha256=sha(b"pixels"))
        bad = register("bad.exr", sha256=sha(b"pixels"))
        absent = register("absent.exr")
        user, version = good.created_by, good.version
        offline, _ = PublishedFileService.register(
            actor=user,
            request=request_for(user),
            version_id=version.pk,
            data=registration(version, storage_root("COLD"), "cold.exr"),  # no mount configured
        )

        counts = verify_pending()

        states = {f.pk: f.checksum_state for f in PublishedFile.objects.all()}
        assert counts == {"verified": 1, "mismatch": 1, "missing": 1, "skipped": 0}
        assert states[good.pk] == "verified"
        assert states[bad.pk] == "mismatch"
        assert states[absent.pk] == "missing"
        assert states[offline.pk] == "declared"

    def test_a_second_run_does_nothing(self, mount, register):
        _write(mount, "ok.exr")
        register("ok.exr", sha256=sha(b"pixels"))

        assert verify_pending()["verified"] == 1
        assert verify_pending() == {"verified": 0, "mismatch": 0, "missing": 0, "skipped": 0}

    def test_limit_and_root_narrow_the_run(self, mount, register):
        for name in ("a.exr", "b.exr", "c.exr"):
            _write(mount, name)
            register(name, sha256=sha(b"pixels"))

        assert verify_pending(limit=2)["verified"] == 2
        assert verify_pending(root="nothing")["verified"] == 0
        assert verify_pending(root="projects")["verified"] == 1

    def test_the_command_prints_counts_only(self, mount, register, capsys):
        from django.core.management import call_command

        _write(mount, "secret-name.exr")
        register("secret-name.exr", sha256=sha(b"pixels"))

        call_command("verify_published_files")

        out = capsys.readouterr().out
        assert "verified: 1" in out
        assert "secret-name" not in out
