"""
Delivery service for business logic.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.db import transaction

from apps.deliveries.services.package import DeliveryService

if TYPE_CHECKING:
    from apps.deliveries.models import DeliveryPackage


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
    """Prepare a delivery for sending: refresh the items, run QC, build the manifest."""
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
    """Record that a Prepared delivery was sent (once). StudioHub does not transfer anything."""
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


@transaction.atomic
def approve_delivery(
    *,
    delivery_id: str,
    user_id: str,
    client_notes: str = "",
) -> DeliveryPackage:
    """Approve delivery by client."""
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(id=delivery_id)

    delivery.status = DeliveryPackage.STATUS_APPROVED
    delivery.client_status = DeliveryPackage.CLIENT_STATUS_APPROVED
    delivery.client_notes = client_notes
    delivery.save(update_fields=["status", "client_status", "client_notes"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_UPDATE,
        target_type=AuditLog.TARGET_DELIVERY,
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} approved by client",
        actor_id=user_id,
        metadata={"client_notes": client_notes},
    )

    return delivery


@transaction.atomic
def reject_delivery(
    *,
    delivery_id: str,
    user_id: str,
    rejection_reason: str,
) -> DeliveryPackage:
    """Reject delivery with feedback."""
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(id=delivery_id)

    delivery.status = DeliveryPackage.STATUS_REJECTED
    delivery.client_status = DeliveryPackage.CLIENT_STATUS_REJECTED
    delivery.client_notes = rejection_reason
    delivery.save(update_fields=["status", "client_status", "client_notes"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_UPDATE,
        target_type=AuditLog.TARGET_DELIVERY,
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} rejected: {rejection_reason}",
        actor_id=user_id,
        metadata={"rejection_reason": rejection_reason},
    )

    return delivery


@transaction.atomic
def complete_delivery(
    *,
    delivery_id: str,
    user_id: str,
) -> DeliveryPackage:
    """Mark delivery as complete."""
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(id=delivery_id)

    delivery.status = DeliveryPackage.STATUS_COMPLETE
    delivery.save(update_fields=["status"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_EXPORT,
        target_type=AuditLog.TARGET_DELIVERY,
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} marked as complete",
        actor_id=user_id,
    )

    return delivery


@transaction.atomic
def cancel_delivery(
    *,
    delivery_id: str,
    user_id: str,
    cancellation_reason: str = "",
) -> DeliveryPackage:
    """Cancel a delivery."""
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(id=delivery_id)

    delivery.status = DeliveryPackage.STATUS_CANCELLED
    delivery.client_notes = cancellation_reason
    delivery.save(update_fields=["status", "client_notes"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_DELETE,
        target_type=AuditLog.TARGET_DELIVERY,
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} cancelled: {cancellation_reason}",
        actor_id=user_id,
    )

    return delivery


@transaction.atomic
def retry_delivery(
    *,
    delivery_id: str,
    user_id: str,
) -> DeliveryPackage:
    """Retry a delivery: reset to Prepared so it re-enters the submit flow.

    Frontend contract verb (``retryDelivery`` → ``Preparing``); the backend
    ``Prepared`` state is the equivalent re-queue point.
    """
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(id=delivery_id)

    delivery.status = DeliveryPackage.STATUS_PREPARED
    delivery.save(update_fields=["status"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_UPDATE,
        target_type=AuditLog.TARGET_DELIVERY,
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} queued for retry",
        actor_id=user_id,
    )

    return delivery
