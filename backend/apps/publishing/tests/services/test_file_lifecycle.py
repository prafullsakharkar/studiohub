# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""Deprecate, restore and revoke follow one transition map (DOM-PUB-02, Q27); Revoked is guarded."""

from __future__ import annotations

import itertools

import pytest
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.core.api.exceptions.api import NotFoundException
from apps.publishing.constants import workflow
from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.events import PublishedFileRevoked
from apps.publishing.exceptions import InvalidTransition, TransitionNotPermitted
from apps.publishing.models import PublishedFile, PublishedFileEvent
from apps.publishing.services.files import PublishedFileService
from apps.publishing.tests.helpers import (
    member,
    outsider,
    published_version,
    registration,
    request_for,
)

pytestmark = pytest.mark.django_db

STATES = sorted(workflow.FILE_STATUSES)


@pytest.fixture
def operator(project):
    return member(project, P.CREATE, P.VIEW, P.DEPRECATE, P.REVOKE)


@pytest.fixture
def override_holder(project):
    return member(project, P.VIEW, P.DEPRECATE, P.REVOKE, P.STATUS_OVERRIDE)


@pytest.fixture
def make_file(project, root, operator):
    def build(status: str = "Registered", path: str = "s/plate.exr") -> PublishedFile:
        version = published_version(project)
        file, _ = PublishedFileService.register(
            actor=operator,
            request=request_for(operator),
            version_id=version.pk,
            data=registration(version, root, path),
        )
        if status != "Registered":
            PublishedFile.all_objects.filter(pk=file.pk).update(
                status=status, revoke_reason="seeded" if status == "Revoked" else ""
            )
        return PublishedFile.objects.get(pk=file.pk)

    return build


@pytest.fixture
def published_events(monkeypatch):
    sent = []
    monkeypatch.setattr(
        "apps.publishing.services.files.default_event_bus.publish", lambda event: sent.append(event)
    )
    return sent


def _move(user, file, target, **kwargs):
    return PublishedFileService.change_status(
        actor=user, request=request_for(user), file=file, target=target, **kwargs
    )


class TestTheMap:
    def test_the_map_is_closed_over_the_known_statuses(self):
        assert set(workflow.FILE_TRANSITIONS) == workflow.FILE_STATUSES
        for targets in workflow.FILE_TRANSITIONS.values():
            assert targets <= workflow.FILE_STATUSES

    @pytest.mark.parametrize(("source", "target"), itertools.product(STATES, STATES))
    def test_every_pair_passes_or_fails_as_the_map_says(
        self, make_file, override_holder, source, target
    ):
        file = make_file(source)
        expected_ok = workflow.can_move(source, target)

        if not expected_ok:
            with pytest.raises(InvalidTransition):
                _move(override_holder, file, target, reason="why", override_reason="why")
            assert PublishedFile.objects.get(pk=file.pk).status == source
            return

        moved = _move(override_holder, file, target, reason="why", override_reason="why")

        assert moved.status == target
        assert moved.status_changed_by == override_holder
        assert moved.status_changed_at is not None

    def test_an_unknown_target_is_refused(self, make_file, operator):
        with pytest.raises(InvalidTransition):
            _move(operator, make_file(), "Published")


class TestMoves:
    def test_deprecate_and_restore(self, make_file, operator):
        file = make_file()

        deprecated = PublishedFileService.deprecate(
            actor=operator, request=request_for(operator), file=file, note="superseded"
        )
        restored = PublishedFileService.restore(
            actor=operator, request=request_for(operator), file=deprecated
        )

        assert (deprecated.status, restored.status) == ("Deprecated", "Registered")
        assert list(restored.events.values_list("from_status", "to_status")) == [
            ("", "Registered"),
            ("Registered", "Deprecated"),
            ("Deprecated", "Registered"),
        ]

    def test_revoking_needs_a_reason_and_keeps_it(self, make_file, operator):
        file = make_file()

        for blank in ("", "   "):
            with pytest.raises(ValidationError) as error:
                PublishedFileService.revoke(
                    actor=operator, request=request_for(operator), file=file, reason=blank
                )
            assert "reason" in error.value.detail

        revoked = PublishedFileService.revoke(
            actor=operator, request=request_for(operator), file=file, reason=" wrong colour space "
        )
        assert revoked.status == "Revoked"
        assert revoked.revoke_reason == "wrong colour space"
        assert revoked.events.filter(to_status="Revoked", reason="wrong colour space").exists()

    def test_a_deprecated_file_can_still_be_revoked(self, make_file, operator):
        file = make_file("Deprecated")

        assert (
            PublishedFileService.revoke(
                actor=operator, request=request_for(operator), file=file, reason="bad"
            ).status
            == "Revoked"
        )

    def test_the_second_of_two_identical_moves_is_a_conflict(self, make_file, operator):
        """The loser of a race: the winner already moved it."""
        file = make_file()
        stale = PublishedFile.objects.get(pk=file.pk)
        PublishedFileService.revoke(
            actor=operator, request=request_for(operator), file=file, reason="first"
        )

        with pytest.raises(InvalidTransition):
            PublishedFileService.revoke(
                actor=operator, request=request_for(operator), file=stale, reason="second"
            )
        assert PublishedFile.objects.get(pk=file.pk).revoke_reason == "first"

    def test_a_move_writes_an_audit_row_without_paths_or_reasons(self, make_file, operator):
        file = make_file()
        PublishedFileService.revoke(
            actor=operator, request=request_for(operator), file=file, reason="secret reason text"
        )

        rows = AuditLog.objects.filter(target_id=str(file.pk), target_type="publishing")
        assert rows.count() == 2  # registered + revoked
        for row in rows:
            assert "secret reason text" not in f"{row.description} {row.metadata}"
            assert "plate.exr" not in f"{row.description} {row.metadata}"


class TestPermissions:
    def test_deprecating_needs_its_code(self, make_file, project):
        file = make_file()
        viewer = member(project, P.VIEW, P.REVOKE)

        with pytest.raises(TransitionNotPermitted):
            _move(viewer, file, "Deprecated")

    def test_revoking_needs_its_code(self, make_file, project):
        file = make_file()
        deprecator = member(project, P.VIEW, P.DEPRECATE)

        with pytest.raises(TransitionNotPermitted):
            _move(deprecator, file, "Revoked", reason="x")

    def test_someone_outside_the_project_gets_not_found(self, make_file):
        file = make_file()
        stranger = outsider(P.DEPRECATE, P.REVOKE)

        with pytest.raises(NotFoundException):
            _move(stranger, file, "Deprecated")


class TestRevokedIsGuarded:
    def test_leaving_revoked_needs_a_reason(self, make_file, override_holder):
        file = make_file("Revoked")

        with pytest.raises(ValidationError) as error:
            _move(override_holder, file, "Registered")
        assert "override_reason" in error.value.detail

    def test_leaving_revoked_needs_the_override_code(self, make_file, operator):
        file = make_file("Revoked")

        with pytest.raises(TransitionNotPermitted):
            _move(operator, file, "Registered", override_reason="mistake")
        assert PublishedFile.objects.get(pk=file.pk).status == "Revoked"

    def test_a_superuser_does_not_hold_the_override_by_being_one(self, make_file, project):
        file = make_file("Revoked")
        boss = member(project, P.VIEW, P.DEPRECATE, is_superuser=True)

        with pytest.raises(TransitionNotPermitted):
            _move(boss, file, "Registered", override_reason="mistake")

    def test_the_override_is_recorded(self, make_file, override_holder):
        file = make_file("Revoked")

        restored = PublishedFileService.restore(
            actor=override_holder,
            request=request_for(override_holder),
            file=file,
            override_reason="revoked by mistake",
        )

        assert restored.status == "Registered"
        event = restored.events.latest("at")
        assert (event.override_kind, event.reason) == ("status", "revoked by mistake")
        assert (
            "override"
            in AuditLog.objects.filter(target_id=str(file.pk)).latest("created_at").description
        )


class TestRevokeEvent:
    def test_revoking_publishes_the_event_with_ids_only(
        self, make_file, operator, published_events
    ):
        file = make_file()

        PublishedFileService.revoke(
            actor=operator, request=request_for(operator), file=file, reason="classified reason"
        )

        assert len(published_events) == 1
        event = published_events[0]
        assert isinstance(event, PublishedFileRevoked)
        assert event.payload == {
            "file_id": str(file.pk),
            "version_id": str(file.version_id),
            "project_id": str(file.project_id),
            "actor_id": str(operator.pk),
            "reason_present": True,
        }
        assert "classified" not in str(event.payload)
        assert "plate.exr" not in str(event.payload)

    def test_other_moves_publish_nothing(self, make_file, operator, published_events):
        file = make_file()

        PublishedFileService.deprecate(actor=operator, request=request_for(operator), file=file)
        PublishedFileService.restore(
            actor=operator,
            request=request_for(operator),
            file=PublishedFile.objects.get(pk=file.pk),
        )

        assert published_events == []

    def test_a_refused_revoke_publishes_nothing(self, make_file, operator, published_events):
        file = make_file()

        with pytest.raises(ValidationError):
            PublishedFileService.revoke(
                actor=operator, request=request_for(operator), file=file, reason=""
            )

        assert published_events == []

    def test_the_event_is_dispatched_only_after_commit(
        self, make_file, operator, django_capture_on_commit_callbacks
    ):
        """The real bus defers dispatch to on_commit: nothing runs before the transaction ends."""
        from apps.core.events import default_event_bus
        from apps.core.events.handlers import DomainEventHandler

        seen = []

        class Collector(DomainEventHandler):
            def handle(self, event):
                seen.append(event)

        default_event_bus.registry.register(PublishedFileRevoked, Collector)
        try:
            file = make_file()
            with django_capture_on_commit_callbacks(execute=False) as callbacks:
                PublishedFileService.revoke(
                    actor=operator, request=request_for(operator), file=file, reason="late"
                )

            assert seen == [] and len(callbacks) >= 1
            for callback in callbacks:
                callback()
            assert len(seen) == 1
        finally:
            default_event_bus.registry.unregister(PublishedFileRevoked, Collector)


class TestVerificationRecord:
    def test_it_stores_the_state_and_never_the_checksum(self, make_file):
        file = make_file()

        PublishedFileService.record_verification(file_id=file.pk, state="mismatch")

        fresh = PublishedFile.objects.get(pk=file.pk)
        assert (fresh.checksum_state, fresh.sha256) == ("mismatch", file.sha256)
        assert fresh.checksum_checked_at is not None
        assert PublishedFileEvent.objects.filter(file=file, kind="verification", detail="mismatch")

    def test_an_unknown_state_is_refused(self, make_file):
        with pytest.raises(ValueError):
            PublishedFileService.record_verification(file_id=make_file().pk, state="declared")

    def test_an_unknown_file_is_ignored(self):
        PublishedFileService.record_verification(
            file_id="00000000-0000-0000-0000-000000000000", state="verified"
        )
