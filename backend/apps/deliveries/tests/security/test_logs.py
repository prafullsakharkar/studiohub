"""
Logs carry ids, codes and statuses only (SEC-DLV-07): not the passcode, not a reason or a note, not
a file path or a transfer reference, on success or on the error paths.
"""

from __future__ import annotations

import logging

import pytest

from apps.deliveries.constants.permissions import DeliveryPermissions as P
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import (
    _Request,
    client_for,
    make_package,
    package_with_items,
    prepared_package,
    signed_off_package,
)
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions

pytestmark = pytest.mark.django_db

SENSITIVE = [
    "LOGTEST-PASSCODE-91",
    "LOGTEST reason: grade wrong",
    "LOGTEST cancel reason",
    "LOGTEST override reason",
    "LOGTEST-TRANSFER-REF",
    "LOGTEST note for the client",
    "plate_0.exr",
]


@pytest.fixture
def logs(caplog, capfd):
    caplog.set_level(logging.DEBUG)

    def read() -> str:
        logging.getLogger("deliveries.canary").warning("LOG-CANARY")
        return caplog.text + capfd.readouterr().err

    yield read


def _assert_clean(text: str) -> None:
    assert "LOG-CANARY" in text, "the log capture saw nothing, so this test proves nothing"
    assert "/api/v1/deliveries/" in text or "Service Unavailable" in text, "no request was logged"
    for secret in SENSITIVE:
        assert secret not in text, f"{secret!r} reached the logs"


def test_the_whole_flow_logs_none_of_it(logs):
    admin = client_for(UserFactory.create(is_superuser=True))
    other = client_for(UserFactory.create(is_superuser=True))
    package = make_package(code="LOG-1", passcode=SENSITIVE[0], notes=SENSITIVE[5])
    from apps.deliveries.tests.helpers import published_version

    DeliveryService.add_version(
        actor=None, package=package, version_id=published_version(package.project).pk
    )
    base = f"/api/v1/deliveries/{package.pk}"

    admin.post(f"{base}/prepare/", {}, format="json")
    other.post(f"{base}/sign-off/", {"notes": SENSITIVE[5]}, format="json")
    admin.post(f"{base}/submit/", {"transfer_reference": SENSITIVE[4]}, format="json")
    other.post(f"{base}/reject/", {"rejection_reason": SENSITIVE[1]}, format="json")
    admin.get(f"{base}/passcode/")
    admin.post(f"{base}/revise/", {}, format="json")

    _assert_clean(logs())


def test_error_paths_log_none_of_it(logs):
    admin = client_for(UserFactory.create(is_superuser=True))
    package = prepared_package(code="LOG-2", passcode=SENSITIVE[0])
    base = f"/api/v1/deliveries/{package.pk}"

    # separation of duties, bad transitions, a rejection without a reason, a wrong body
    admin.post(f"{base}/sign-off/", {"override_reason": SENSITIVE[3]}, format="json")
    admin.post(f"{base}/cancel/", {"cancellation_reason": SENSITIVE[2]}, format="json")
    admin.post(f"{base}/cancel/", {"cancellation_reason": SENSITIVE[2]}, format="json")
    admin.post(f"{base}/reject/", {"rejection_reason": SENSITIVE[1]}, format="json")
    admin.patch(f"{base}/", {"passcode": SENSITIVE[0]}, format="json")

    _assert_clean(logs())


def test_a_failed_key_and_a_failed_override_log_none_of_it(logs, settings):
    user = UserFactory.create()
    grant_permissions(user, P.SOD_OVERRIDE)
    package = signed_off_package(code="LOG-3", passcode=SENSITIVE[0])
    settings.DELIVERY_SECRET_KEYS = ()

    admin = client_for(UserFactory.create(is_superuser=True))
    admin.get(f"/api/v1/deliveries/{package.pk}/passcode/")
    with pytest.raises(Exception):  # noqa: B017  (any refusal; only the logs matter here)
        DeliveryService.override_status(
            actor=user,
            package=package,
            target="Draft",
            override_reason=SENSITIVE[3],
            request=_Request(user),
        )
    with pytest.raises(Exception):  # noqa: B017
        DeliveryService.update(
            actor=None, package=package_with_items(), data={"passcode": SENSITIVE[0]}
        )

    _assert_clean(logs())
