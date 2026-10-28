"""
Export job validation (docs/publishing/CONTRACTS.md DOM-PUB-05, decision Q14).

Every active rule reports one of ``passed``, ``failed``, ``warning`` or ``not_checked``. A rule
only says ``passed`` when the server really checked it against data it holds: the job's details,
the files registered for it, and the version it belongs to. A check that needs the artist's
machine or a mounted disk that is not there is ``not_checked``, never ``passed``.

A failed rule is ``failed`` when its action is ``error`` or ``block`` (the job fails) and
``warning`` when its action is ``warn`` (the job still validates).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from apps.publishing.models import PublishedFile, PublishItem, PublishValidationRule

PASSED = "passed"
FAILED = "failed"
WARNING = "warning"
NOT_CHECKED = "not_checked"

DEFAULT_REQUIRED_METADATA = (
    "name",
    "entity_type",
    "entity_id",
    "entity_code",
    "entity_name",
    "dcc_tool",
    "source_file",
)


@dataclass(frozen=True)
class RuleResult:
    rule_id: str
    rule_name: str
    rule_type: str
    action: str
    status: str
    message: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "rule_type": self.rule_type,
            "action": self.action,
            "status": self.status,
            # Older clients read a boolean: None means "not checked", never "passed".
            "passed": {PASSED: True, WARNING: True, FAILED: False}.get(self.status),
            "message": self.message,
        }


def _verdict(rule: PublishValidationRule, ok: bool, failure: str, success: str) -> tuple[str, str]:
    if ok:
        return PASSED, success
    if rule.action == PublishValidationRule.ACTION_WARN:
        return WARNING, failure
    return FAILED, failure


def _check_metadata(rule, job, files) -> tuple[str, str]:
    required = (rule.config or {}).get("required") or DEFAULT_REQUIRED_METADATA
    missing = [name for name in required if not str(getattr(job, name, "") or "").strip()]
    return _verdict(
        rule,
        not missing,
        f"Missing: {', '.join(missing)}.",
        "All required details are present.",
    )


def _check_format(rule, job, files) -> tuple[str, str]:
    allowed = [
        str(item).strip().lower() for item in (rule.config or {}).get("allowed_formats") or []
    ]
    if not allowed:
        return NOT_CHECKED, "No allowed formats are configured for this rule."
    declared = (job.export_format or "").strip().lower()
    if not declared:
        return _verdict(rule, False, "No export format is declared.", "")
    return _verdict(
        rule,
        declared in allowed,
        f"{job.export_format} is not one of the allowed formats.",
        f"{job.export_format} is an allowed format.",
    )


def _check_size(rule, job, files) -> tuple[str, str]:
    limit = (rule.config or {}).get("max_bytes")
    if isinstance(limit, bool) or not isinstance(limit, int) or limit < 0:
        return NOT_CHECKED, "No size limit is configured for this rule."
    if not files:
        return NOT_CHECKED, "No files are registered for this job yet."
    over = sum(1 for file in files if file.size_bytes > limit)
    return _verdict(
        rule,
        over == 0,
        f"{over} file(s) are over the size limit.",
        "Every file is within the limit.",
    )


def _check_frame_range(rule, job, files) -> tuple[str, str]:
    sequences = [file for file in files if file.frame_start is not None]
    if not sequences:
        return NOT_CHECKED, "No image sequence is registered for this job."
    version = job.version
    if version is None or version.start_frame is None or version.end_frame is None:
        return NOT_CHECKED, "The version has no frame range to compare with."
    off = sum(
        1
        for file in sequences
        if (file.frame_start, file.frame_end) != (version.start_frame, version.end_frame)
    )
    return _verdict(
        rule,
        off == 0,
        f"{off} sequence(s) do not match the version's frame range.",
        "Every sequence matches the version's frame range.",
    )


def _check_files_exist(rule, job, files) -> tuple[str, str]:
    if not files:
        return NOT_CHECKED, "No files are registered for this job yet."
    states = [file.checksum_state for file in files]
    missing = states.count(PublishedFile.ChecksumState.MISSING)
    wrong = states.count(PublishedFile.ChecksumState.MISMATCH)
    if missing or wrong:
        parts = []
        if missing:
            parts.append(f"{missing} not found on disk")
        if wrong:
            parts.append(f"{wrong} with a different checksum")
        return _verdict(rule, False, "; ".join(parts).capitalize() + ".", "")
    if all(state == PublishedFile.ChecksumState.VERIFIED for state in states):
        return PASSED, "Every registered file was found on disk with its checksum."
    return NOT_CHECKED, f"{len(files)} file(s) are registered but not verified on disk yet."


_CHECKS = {
    PublishValidationRule.RULE_METADATA: _check_metadata,
    PublishValidationRule.RULE_FILE_FORMAT: _check_format,
    PublishValidationRule.RULE_FILE_SIZE: _check_size,
    PublishValidationRule.RULE_FRAME_RANGE: _check_frame_range,
    PublishValidationRule.RULE_FILE_EXISTS: _check_files_exist,
}

_NOT_TRACKED = {
    PublishValidationRule.RULE_DEPENDENCIES: "Dependencies between publishes are not tracked yet.",
    PublishValidationRule.RULE_PERMISSIONS: "Permissions are checked when the job is created, not here.",
}


def evaluate(job: PublishItem) -> list[RuleResult]:
    """Run every active rule against the job. Reads only; changes nothing."""
    files = list(
        PublishedFile.objects.filter(export_job=job, status=PublishedFile.Status.REGISTERED)
    )
    results: list[RuleResult] = []
    for rule in PublishValidationRule.objects.filter(is_active=True).order_by("order", "id"):
        check = _CHECKS.get(rule.rule_type)
        if check is not None:
            status, message = check(rule, job, files)
        else:
            status = NOT_CHECKED
            message = _NOT_TRACKED.get(
                rule.rule_type, "This kind of rule is not checked by the server."
            )
        results.append(
            RuleResult(
                rule_id=str(rule.pk),
                rule_name=rule.name,
                rule_type=rule.rule_type,
                action=rule.action,
                status=status,
                message=message,
            )
        )
    return results


def summarize(results: list[RuleResult]) -> dict[str, Any]:
    counts = {PASSED: 0, FAILED: 0, WARNING: 0, NOT_CHECKED: 0}
    for result in results:
        counts[result.status] += 1
    return {
        # True only when nothing blocking failed. Unchecked rules do not make it true or false.
        "passed": counts[FAILED] == 0,
        "counts": counts,
        "results": [result.as_dict() for result in results],
    }
