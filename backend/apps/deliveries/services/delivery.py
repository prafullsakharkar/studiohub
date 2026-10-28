"""
Executors for the delivery actions that run through ``BackgroundJobService`` (validate, prepare,
submit). They take ids only, as a job payload must, and call ``DeliveryService``; the status
moves, the approvals and the rest live there.
"""

from __future__ import annotations

from typing import Any

from apps.deliveries.services.package import DeliveryService


def _actor(user_id: str | None):
    if not user_id:
        return None
    from django.contrib.auth import get_user_model

    return get_user_model().objects.filter(pk=user_id).first()


def validate_delivery(*, delivery_id: str, user_id: str | None) -> dict[Any, Any]:
    """Run QC on a delivery. The reply keeps its old keys and adds the checks that ran."""
    package, result = DeliveryService.validate(actor=_actor(user_id), package=delivery_id)
    return {
        "success": True,
        "delivery_id": str(package.pk),
        "status": package.status,
        "validation_results": [
            {
                "version_id": str(entry["ref"].version_id),
                "version_number": entry["ref"].version_number,
                "status": "valid" if entry["passed"] else "invalid",
                "checks": [
                    {"check": name, "outcome": outcome, "detail": detail}
                    for name, outcome, detail in entry["checks"]
                ],
                "checksums": {
                    "md5": entry["ref"].checksum_md5,
                    "sha256": entry["ref"].checksum_sha256,
                },
            }
            for entry in result["items"]
        ],
        "package_checks": result["package_checks"],
        "all_valid": result["passed"],
        "run_id": str(result["run_id"]),
    }


def prepare_delivery(*, delivery_id: str, user_id: str | None) -> dict[Any, Any]:
    """Prepare a delivery for sign-off: refresh the items, run QC, build the manifest."""
    package, _result = DeliveryService.prepare(actor=_actor(user_id), package=delivery_id)
    return {
        "success": True,
        "delivery_id": str(package.pk),
        "status": package.status,
        "manifest_data": package.manifest_data,
        "checksums": package.checksums,
    }


def submit_delivery(
    *, delivery_id: str, user_id: str | None, transfer_reference: str = ""
) -> dict[Any, Any]:
    """Record that a Signed Off delivery was sent (once). StudioHub does not transfer anything."""
    package = DeliveryService.send(
        actor=_actor(user_id), package=delivery_id, transfer_reference=transfer_reference
    )
    return {
        "success": True,
        "delivery_id": str(package.pk),
        "status": package.status,
        "submission_result": {
            "success": True,
            "delivery_method": package.delivery_method,
            "destination": package.delivery_destination,
            "submitted_at": package.sent_at.isoformat() if package.sent_at else None,
            "transfer_reference": package.transfer_reference,
        },
    }
