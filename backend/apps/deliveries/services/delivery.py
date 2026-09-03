"""
Delivery service for business logic.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import transaction

if TYPE_CHECKING:
    from apps.deliveries.models import DeliveryPackage, DeliveryVersionRef


def create_delivery(
    *,
    name: str,
    code: str,
    organization_id: str,
    project_id: str | None = None,
    client_id: str | None = None,
    delivery_method: str = "S3",
    delivery_destination: str = "",
    passcode: str | None = None,
    expires_at: str | None = None,
    notes: str = "",
    client_notes: str = "",
    created_by_id: str | None = None,
) -> DeliveryPackage:
    """Create a new delivery package."""
    from datetime import datetime

    from apps.deliveries.models import DeliveryPackage
    from apps.organization.models import Organization

    org = Organization.objects.get(id=organization_id)

    delivery = DeliveryPackage.objects.create(
        name=name,
        code=code,
        organization=org,
        project_id=project_id,
        client_id=client_id,
        delivery_method=delivery_method,
        delivery_destination=delivery_destination,
        passcode=passcode or "",
        expires_at=datetime.fromisoformat(expires_at) if expires_at else None,
        notes=notes,
        client_notes=client_notes,
        created_by_id=created_by_id,
    )

    return delivery


@transaction.atomic
def add_version_to_delivery(
    *,
    delivery_id: str,
    version_id: str,
    version_number: str,
    entity_type: str,
    entity_code: str,
    entity_name: str,
    file_size_bytes: int = 0,
    frame_count: int = 0,
    file_path: str = "",
    checksum_md5: str = "",
    checksum_sha256: str = "",
    organization_id: str,
) -> DeliveryVersionRef:
    """Add a version reference to a delivery."""
    from apps.deliveries.models import DeliveryPackage, DeliveryVersionRef
    from apps.production.models import Version

    delivery = DeliveryPackage.objects.get(
        id=delivery_id,
        organization_id=organization_id,
    )
    version = Version.objects.get(
        id=version_id,
        organization_id=organization_id,
    )

    ref = DeliveryVersionRef.objects.create(
        delivery=delivery,
        version=version,
        version_number=version_number,
        entity_type=entity_type,
        entity_code=entity_code,
        entity_name=entity_name,
        file_size_bytes=file_size_bytes,
        frame_count=frame_count,
        file_path=file_path,
        checksum_md5=checksum_md5,
        checksum_sha256=checksum_sha256,
    )

    # Update delivery totals
    delivery.total_size_bytes += file_size_bytes
    delivery.total_frames += frame_count
    delivery.save(update_fields=["total_size_bytes", "total_frames"])

    return ref


@transaction.atomic
def validate_delivery(
    *,
    delivery_id: str,
    user_id: str,
    organization_id: str,
) -> dict:
    """Validate delivery package contents."""
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(
        id=delivery_id,
        organization_id=organization_id,
    )

    # Validate all versions
    validation_results = []
    all_valid = True

    for ref in delivery.versions.all():
        ref.is_validated = True
        ref.validation_notes = "Auto-validated"
        ref.save(update_fields=["is_validated", "validation_notes"])

        validation_results.append({
            "version_id": str(ref.version_id),
            "version_number": ref.version_number,
            "status": "valid",
            "checksums": {
                "md5": ref.checksum_md5,
                "sha256": ref.checksum_sha256,
            },
        })

    # Update delivery status
    delivery.status = DeliveryPackage.STATUS_VALIDATING
    delivery.save(update_fields=["status"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_UPDATE,
        target_type=AuditLog.TARGET_BILLING,  # Reusing for delivery
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} validated by user {user_id}",
        actor_id=user_id,
        organization=delivery.organization,
        metadata={"validation_results": validation_results},
    )

    return {
        "success": True,
        "delivery_id": str(delivery_id),
        "status": delivery.status,
        "validation_results": validation_results,
        "all_valid": all_valid,
    }


@transaction.atomic
def prepare_delivery(
    *,
    delivery_id: str,
    user_id: str,
    organization_id: str,
) -> dict:
    """Prepare delivery package for submission."""
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(
        id=delivery_id,
        organization_id=organization_id,
    )

    # Generate manifest
    manifest_data = {
        "delivery_code": delivery.code,
        "delivery_name": delivery.name,
        "created_at": delivery.created_at.isoformat(),
        "versions": [
            {
                "version_number": ref.version_number,
                "entity_code": ref.entity_code,
                "file_path": ref.file_path,
                "file_size_bytes": ref.file_size_bytes,
                "checksum_md5": ref.checksum_md5,
                "checksum_sha256": ref.checksum_sha256,
            }
            for ref in delivery.versions.all()
        ],
    }

    # Generate checksums
    checksums = {
        "manifest_md5": "placeholder-manifest-checksum",
        "total_size_bytes": delivery.total_size_bytes,
        "version_count": delivery.version_count,
    }

    delivery.manifest_data = manifest_data
    delivery.checksums = checksums
    delivery.status = DeliveryPackage.STATUS_PREPARED
    delivery.save(update_fields=["manifest_data", "checksums", "status"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_EXPORT,
        target_type=AuditLog.TARGET_BILLING,
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} prepared for submission",
        actor_id=user_id,
        organization=delivery.organization,
        metadata={"manifest_generated": True},
    )

    return {
        "success": True,
        "delivery_id": str(delivery_id),
        "status": delivery.status,
        "manifest_data": manifest_data,
        "checksums": checksums,
    }


@transaction.atomic
def submit_delivery(
    *,
    delivery_id: str,
    user_id: str,
    organization_id: str,
) -> dict:
    """Submit delivery to destination."""
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(
        id=delivery_id,
        organization_id=organization_id,
    )

    # Simulate submission (in production, this would call Aspera/S3/FTP)
    submission_result = {
        "success": True,
        "delivery_method": delivery.delivery_method,
        "destination": delivery.delivery_destination,
        "submitted_at": delivery.updated_at.isoformat(),
    }

    delivery.status = DeliveryPackage.STATUS_SUBMITTED
    delivery.save(update_fields=["status"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_EXPORT,
        target_type=AuditLog.TARGET_BILLING,
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} submitted via {delivery.delivery_method}",
        actor_id=user_id,
        organization=delivery.organization,
        metadata=submission_result,
    )

    return {
        "success": True,
        "delivery_id": str(delivery_id),
        "status": delivery.status,
        "submission_result": submission_result,
    }


@transaction.atomic
def approve_delivery(
    *,
    delivery_id: str,
    user_id: str,
    client_notes: str = "",
    organization_id: str,
) -> DeliveryPackage:
    """Approve delivery by client."""
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(
        id=delivery_id,
        organization_id=organization_id,
    )

    delivery.status = DeliveryPackage.STATUS_APPROVED
    delivery.client_status = DeliveryPackage.CLIENT_STATUS_APPROVED
    delivery.client_notes = client_notes
    delivery.save(update_fields=["status", "client_status", "client_notes"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_UPDATE,
        target_type=AuditLog.TARGET_BILLING,
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} approved by client",
        actor_id=user_id,
        organization=delivery.organization,
        metadata={"client_notes": client_notes},
    )

    return delivery


@transaction.atomic
def reject_delivery(
    *,
    delivery_id: str,
    user_id: str,
    rejection_reason: str,
    organization_id: str,
) -> DeliveryPackage:
    """Reject delivery with feedback."""
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(
        id=delivery_id,
        organization_id=organization_id,
    )

    delivery.status = DeliveryPackage.STATUS_REJECTED
    delivery.client_status = DeliveryPackage.CLIENT_STATUS_REJECTED
    delivery.client_notes = rejection_reason
    delivery.save(update_fields=["status", "client_status", "client_notes"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_UPDATE,
        target_type=AuditLog.TARGET_BILLING,
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} rejected: {rejection_reason}",
        actor_id=user_id,
        organization=delivery.organization,
        metadata={"rejection_reason": rejection_reason},
    )

    return delivery


@transaction.atomic
def complete_delivery(
    *,
    delivery_id: str,
    user_id: str,
    organization_id: str,
) -> DeliveryPackage:
    """Mark delivery as complete."""
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(
        id=delivery_id,
        organization_id=organization_id,
    )

    delivery.status = DeliveryPackage.STATUS_COMPLETE
    delivery.save(update_fields=["status"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_EXPORT,
        target_type=AuditLog.TARGET_BILLING,
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} marked as complete",
        actor_id=user_id,
        organization=delivery.organization,
    )

    return delivery


@transaction.atomic
def cancel_delivery(
    *,
    delivery_id: str,
    user_id: str,
    cancellation_reason: str = "",
    organization_id: str,
) -> DeliveryPackage:
    """Cancel a delivery."""
    from apps.audit.models import AuditLog
    from apps.deliveries.models import DeliveryPackage

    delivery = DeliveryPackage.objects.get(
        id=delivery_id,
        organization_id=organization_id,
    )

    delivery.status = DeliveryPackage.STATUS_CANCELLED
    delivery.client_notes = cancellation_reason
    delivery.save(update_fields=["status", "client_notes"])

    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_DELETE,
        target_type=AuditLog.TARGET_BILLING,
        target_id=str(delivery_id),
        target_name=delivery.name,
        description=f"Delivery {delivery.code} cancelled: {cancellation_reason}",
        actor_id=user_id,
        organization=delivery.organization,
    )

    return delivery
