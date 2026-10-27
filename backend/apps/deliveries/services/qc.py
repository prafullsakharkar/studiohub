"""
Delivery QC (docs/deliveries/CONTRACTS.md DOM-DLV-06): real checks, recorded.

A run writes one ``DeliveryQCCheck`` row per check (append-only) and returns the outcome. A check is
``pass``, ``fail`` or ``not_checked``; a delivery passes QC when nothing failed. Nothing here
marks an item valid because it was asked to: every outcome comes from the registry.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.utils import timezone

from apps.deliveries.models import DeliveryQCCheck
from apps.production.selectors.version import VersionSelector
from apps.publishing.selectors.files import PublishedFileSelector

PASS = DeliveryQCCheck.Outcome.PASS.value
FAIL = DeliveryQCCheck.Outcome.FAIL.value
NOT_CHECKED = DeliveryQCCheck.Outcome.NOT_CHECKED.value

_BAD_CHECKSUM = {"mismatch", "missing"}


def _item_checks(
    package: Any, ref: Any, registry: dict[uuid.UUID, Any], deliverable: dict[uuid.UUID, Any]
) -> list[tuple[str, str, str]]:
    """``[(check name, outcome, detail)]`` for one item."""
    version = VersionSelector.resolve_in_project(package.project_id, ref.version_id)
    checks: list[tuple[str, str, str]] = []
    if version is None:
        checks.append(("same_project", FAIL, "The version is not a live version of this project."))
        checks.append(("version_published", FAIL, "The version cannot be read."))
    else:
        checks.append(("same_project", PASS, ""))
        checks.append(
            ("version_published", PASS, "")
            if version.is_published
            else ("version_published", FAIL, "The version is no longer published.")
        )

    snapshot_files = list(ref.files.all())
    checks.append(
        ("files_present", PASS, "")
        if snapshot_files
        else ("files_present", FAIL, "No registered file is recorded for this item.")
    )

    current = registry.get(ref.version_id, [])
    registered = [f for f in current if f.status == "Registered"]
    bad = [f for f in registered if f.checksum_state in _BAD_CHECKSUM]
    unverified = [f for f in registered if f.checksum_state == "declared"]
    if bad:
        checks.append(("checksum_ok", FAIL, f"{len(bad)} file(s) are missing or differ on disk."))
    elif not registered:
        checks.append(("checksum_ok", NOT_CHECKED, "No registered file to check."))
    elif unverified:
        checks.append(
            ("checksum_ok", NOT_CHECKED, f"{len(unverified)} file(s) are not verified on disk.")
        )
    else:
        checks.append(("checksum_ok", PASS, ""))

    now = {f.file_id: f.sha256 for f in deliverable.get(ref.version_id, [])}
    recorded = {f.published_file_id: f.sha256 for f in snapshot_files}
    checks.append(
        ("snapshot_current", PASS, "")
        if now == recorded
        else ("snapshot_current", FAIL, "The registered files changed; prepare the delivery again.")
    )
    return checks


def run(package: Any, actor: Any) -> dict[str, Any]:
    """Run QC on the delivery and record it. The caller holds the package lock."""
    run_id = uuid.uuid4()
    now = timezone.now()
    refs = list(package.versions.prefetch_related("files"))
    version_ids = [ref.version_id for ref in refs]
    registry = PublishedFileSelector.files_for_versions(version_ids)
    deliverable = PublishedFileSelector.deliverable_files(version_ids)

    rows: list[DeliveryQCCheck] = []

    def add(item: Any, name: str, outcome: str, detail: str) -> None:
        rows.append(
            DeliveryQCCheck(
                delivery=package,
                item=item,
                run_id=run_id,
                check_name=name,
                outcome=outcome,
                detail=detail,
                checked_by=actor if getattr(actor, "is_authenticated", False) else None,
                checked_at=now,
            )
        )

    add(
        None,
        "has_items",
        PASS if refs else FAIL,
        "" if refs else "The delivery has no versions.",
    )
    per_item: list[dict[str, Any]] = []
    for ref in refs:
        checks = _item_checks(package, ref, registry, deliverable)
        for name, outcome, detail in checks:
            add(ref, name, outcome, detail)
        failing = [name for name, outcome, _ in checks if outcome == FAIL]
        ref.is_validated = not failing
        ref.validation_notes = "" if not failing else "Failed: " + ", ".join(failing)
        ref.save(update_fields=["is_validated", "validation_notes"])
        per_item.append({"ref": ref, "checks": checks, "passed": not failing})

    DeliveryQCCheck.objects.bulk_create(rows)
    package.qc_run_id = run_id
    package.save(update_fields=["qc_run_id", "updated_at"])
    return {
        "run_id": run_id,
        "passed": not any(row.outcome == FAIL for row in rows),
        "package_checks": [
            {"check": row.check_name, "outcome": row.outcome, "detail": row.detail}
            for row in rows
            if row.item is None
        ],
        "items": per_item,
    }


def failures(result: dict[str, Any]) -> list[dict[str, str]]:
    """The failing checks of a run, for an error body (ids and check names, no paths)."""
    out = [
        {"item": "", "check": c["check"], "detail": c["detail"]}
        for c in result["package_checks"]
        if c["outcome"] == FAIL
    ]
    for entry in result["items"]:
        out.extend(
            {"item": str(entry["ref"].uid), "check": name, "detail": detail}
            for name, outcome, detail in entry["checks"]
            if outcome == FAIL
        )
    return out
