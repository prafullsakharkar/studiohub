# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
Separation of duties (SEC-DLV-03, DOM-DLV-07): nobody signs off a delivery they prepared, on any
path, unless they hold ``delivery.sod.override`` and say why.
"""

from __future__ import annotations

import pytest

from apps.audit.models import AuditLog
from apps.deliveries.constants.permissions import DeliveryPermissions as P
from apps.deliveries.exceptions import (
    QCFailed,
    SeparationOfDuties,
    TransitionNotPermitted,
)
from apps.deliveries.models import DeliveryPackage, DeliveryStatusChange
from apps.deliveries.services import duties
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import (
    _Request,
    client_for,
    make_package,
    published_version,
)
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Version

pytestmark = pytest.mark.django_db


def _delivery_prepared_by(*, creator=None, adder=None, preparer=None):
    """A Prepared delivery whose creator, item adder and preparer are the given users."""
    package = DeliveryService.create(
        actor=creator,
        data={"name": "Turnover", "project_id": make_package().project.pk},
    )
    version = published_version(package.project)
    DeliveryService.add_version(actor=adder, package=package, version_id=version.pk)
    package, _ = DeliveryService.prepare(actor=preparer, package=package)
    return package


class TestWhoPrepared:
    @pytest.mark.parametrize("role", ["creator", "adder", "preparer"])
    def test_each_of_them_is_refused(self, role):
        person, others = UserFactory.create(), [UserFactory.create(), UserFactory.create()]
        users = {"creator": others[0], "adder": others[1], "preparer": UserFactory.create()}
        users[role] = person
        package = _delivery_prepared_by(**{
            "creator": users["creator"], "adder": users["adder"], "preparer": users["preparer"],
        })  # fmt: skip

        with pytest.raises(SeparationOfDuties):
            DeliveryService.sign_off(actor=person, package=package)

        fresh = DeliveryPackage.objects.get(pk=package.pk)
        assert fresh.status == "Prepared" and fresh.signed_off_by_id is None

    def test_someone_who_did_none_of_it_may_sign_off(self):
        a, b, c, signer = (UserFactory.create() for _ in range(4))
        package = _delivery_prepared_by(creator=a, adder=b, preparer=c)

        done = DeliveryService.sign_off(actor=signer, package=package, notes="Looks right")

        assert done.status == "Signed Off" and done.signed_off_by == signer and done.signed_off_at
        row = DeliveryStatusChange.objects.filter(delivery=package, to_status="Signed Off").get()
        assert row.reason == "Looks right" and row.override_kind == "" and row.actor_id == signer.pk

    def test_changing_created_by_to_someone_else_does_not_clear_the_creator(self):
        creator, adder, preparer = (UserFactory.create() for _ in range(3))
        package = _delivery_prepared_by(creator=creator, adder=adder, preparer=preparer)

        DeliveryPackage.objects.filter(pk=package.pk).update(created_by=adder)

        assert str(creator.pk) in duties.preparer_ids(DeliveryPackage.objects.get(pk=package.pk))
        with pytest.raises(SeparationOfDuties):
            DeliveryService.sign_off(actor=creator, package=package)

    def test_a_reassigned_creator_is_still_the_creator(self):
        creator, adder, preparer = (UserFactory.create() for _ in range(3))
        package = _delivery_prepared_by(creator=creator, adder=adder, preparer=preparer)
        DeliveryPackage.objects.filter(pk=package.pk).update(created_by=None)

        with pytest.raises(SeparationOfDuties):
            DeliveryService.sign_off(actor=creator, package=package)

    def test_the_signer_who_reopens_can_sign_off_again(self):
        creator, signer = UserFactory.create(), UserFactory.create()
        package = _delivery_prepared_by(creator=creator)
        DeliveryService.sign_off(actor=signer, package=package)
        DeliveryService.reopen(actor=signer, package=package)

        again = DeliveryService.sign_off(actor=signer, package=package)

        assert again.status == "Signed Off"
        assert str(signer.pk) not in duties.preparer_ids(again)

    def test_an_anonymous_call_cannot_sign_off(self):
        package = _delivery_prepared_by()

        with pytest.raises(TransitionNotPermitted):
            DeliveryService.sign_off(actor=None, package=package)


class TestTheOverride:
    def _own_delivery(self, user):
        return _delivery_prepared_by(creator=user, adder=user, preparer=user)

    def test_with_the_code_and_a_reason_it_works_and_is_recorded(self):
        user = UserFactory.create()
        # the override lifts the separation rule only; signing off still needs delivery.approve
        grant_permissions(user, P.APPROVE, P.SOD_OVERRIDE)
        package = self._own_delivery(user)

        done = DeliveryService.sign_off(
            actor=user,
            package=package,
            request=_Request(user),
            override_reason="Sole person on shift; supervisor agreed",
        )

        assert done.status == "Signed Off"
        row = DeliveryStatusChange.objects.filter(delivery=package, to_status="Signed Off").get()
        assert row.override_kind == "self_approval"
        assert row.reason == "Sole person on shift; supervisor agreed"
        audit = AuditLog.objects.filter(target_id=str(package.pk), description__contains="override")
        assert audit.count() == 1
        assert "supervisor" not in audit.get().description

    def test_the_code_without_a_reason_is_refused(self):
        user = UserFactory.create()
        grant_permissions(user, P.SOD_OVERRIDE)
        package = self._own_delivery(user)

        for reason in (None, "", "   "):
            with pytest.raises(SeparationOfDuties):
                DeliveryService.sign_off(
                    actor=user, package=package, request=_Request(user), override_reason=reason
                )

    def test_a_reason_without_the_code_is_refused(self):
        user = UserFactory.create()
        package = self._own_delivery(user)

        with pytest.raises(SeparationOfDuties):
            DeliveryService.sign_off(
                actor=user, package=package, request=_Request(user), override_reason="please"
            )

    def test_a_superuser_does_not_hold_it_by_being_one(self):
        boss = UserFactory.create(is_superuser=True)
        package = self._own_delivery(boss)

        with pytest.raises(SeparationOfDuties):
            DeliveryService.sign_off(
                actor=boss, package=package, request=_Request(boss), override_reason="I am the boss"
            )

    def test_without_a_request_there_is_no_override(self):
        user = UserFactory.create()
        grant_permissions(user, P.SOD_OVERRIDE)
        package = self._own_delivery(user)

        with pytest.raises(SeparationOfDuties):
            DeliveryService.sign_off(actor=user, package=package, override_reason="internal call")

    def test_a_reason_from_someone_who_did_not_prepare_it_is_ignored(self):
        creator, signer = UserFactory.create(), UserFactory.create()
        package = _delivery_prepared_by(creator=creator)

        DeliveryService.sign_off(actor=signer, package=package, override_reason="unneeded")

        row = DeliveryStatusChange.objects.filter(delivery=package, to_status="Signed Off").get()
        assert row.override_kind == ""


class TestEveryPath:
    def test_the_endpoint_answers_403_separation_of_duties(self):
        user = UserFactory.create(is_superuser=True)
        package = self._prepare_as(user)

        response = client_for(user).post(
            f"/api/v1/deliveries/{package.pk}/sign-off/", {}, format="json"
        )

        assert response.status_code == 403
        assert "separation_of_duties" in response.content.decode()
        assert DeliveryPackage.objects.get(pk=package.pk).status == "Prepared"

    def test_the_endpoint_override_needs_the_code_even_for_a_superuser(self):
        user = UserFactory.create(is_superuser=True)
        package = self._prepare_as(user)
        client = client_for(user)

        refused = client.post(
            f"/api/v1/deliveries/{package.pk}/sign-off/",
            {"override_reason": "I am the boss"},
            format="json",
        )
        grant_permissions(user, P.SOD_OVERRIDE)
        allowed = client.post(
            f"/api/v1/deliveries/{package.pk}/sign-off/",
            {"override_reason": "Agreed with the supervisor"},
            format="json",
        )

        assert refused.status_code == 403 and allowed.status_code == 200
        assert allowed.json()["status"] == "Signed Off"

    def test_someone_who_did_not_prepare_it_signs_off_through_the_endpoint(self):
        package = self._prepare_as(UserFactory.create(is_superuser=True))
        other = UserFactory.create(is_superuser=True)

        response = client_for(other).post(
            f"/api/v1/deliveries/{package.pk}/sign-off/", {"notes": "ok"}, format="json"
        )

        assert (
            response.status_code == 200 and response.json()["signed_off_by"] == other.pk.__str__()
        )

    def test_the_endpoint_needs_the_approve_code(self):
        package = self._prepare_as(UserFactory.create(is_superuser=True))
        editor = UserFactory.create()
        grant_permissions(editor, P.VIEW, P.UPDATE, P.SEND)

        response = client_for(editor).post(
            f"/api/v1/deliveries/{package.pk}/sign-off/", {}, format="json"
        )

        assert response.status_code == 403
        assert "separation_of_duties" not in response.content.decode()

    def test_the_only_bulk_route_is_cancel_and_it_needs_neither_sign_off_nor_send(self):
        from apps.deliveries.api.viewsets.delivery import DeliveryViewSet

        names = {getattr(a, "url_path", "") for a in DeliveryViewSet.get_extra_actions()}
        bulk_actions = {n for n in DeliveryViewSet.permission_map if "bulk" in n}

        assert "sign-off" in names
        assert {n for n in names if "bulk" in n} == {"bulk-cancel"}
        assert bulk_actions == {"bulk_cancel"}
        assert DeliveryViewSet.permission_map["bulk_cancel"] == (P.UPDATE,)

    def test_a_qc_that_fails_at_sign_off_keeps_its_rows_and_signs_nothing(self):
        creator, signer = UserFactory.create(), UserFactory.create()
        package = _delivery_prepared_by(creator=creator)
        version = Version.objects.get(delivery_references__delivery=package)
        Version.objects.filter(pk=version.pk).update(is_published=False)

        with pytest.raises(QCFailed):
            DeliveryService.sign_off(actor=signer, package=package)

        fresh = DeliveryPackage.objects.get(pk=package.pk)
        assert fresh.status == "Prepared" and fresh.signed_off_by_id is None
        assert fresh.qc_checks.filter(outcome="fail", check_name="version_published").exists()

    @staticmethod
    def _prepare_as(user):
        return _delivery_prepared_by(creator=user, adder=user, preparer=user)
