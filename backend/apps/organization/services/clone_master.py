"""Generic Master → Organization clone service.

Pattern: add missing records only. No synchronization, no overwrite of
existing org records (custom or previously cloned), no duplicates.

Contract per entity type:
- source: active platform catalog rows (masterdata app, is_deleted=False)
- match: (organization=org, code=<master code>) — resolution is by stable
  code, not display name
- new rows are org-owned (scope organization/organization_custom); existing
  org rows (custom or cloned) are untouched
- duplicate safe under races via per-code get/create inside one transaction;
  DB uniqueness is enforced on (organization, code) by migrations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Iterable

from django.db import IntegrityError, transaction


@dataclass
class CloneResult:
    created_count: int = 0
    existing_count: int = 0
    created: list[str] = field(default_factory=list)
    existing: list[str] = field(default_factory=list)

    def as_response(self, message: str) -> dict:
        return {
            "created_count": self.created_count,
            "existing_count": self.existing_count,
            "created": self.created,
            "existing": self.existing,
            "message": message,
        }


def normalize_code(value: str | None, fallback: str) -> str:
    code = (value or "").strip().upper().replace(" ", "_").replace("-", "_")
    if not code:
        code = fallback.upper().replace(" ", "_").replace("-", "_")
    return code[:100]


def clone_master_records(
    *,
    masters: Iterable[Any],
    target_model,
    organization,
    build_kwargs: Callable[[Any], dict],
) -> CloneResult:
    """Clone master rows missing from an organization.

    Matching is by (organization=org, code=<normalized master code>).
    Transaction wraps the whole batch; IntegrityError on one row is treated
    as "already exists" so concurrent clones never produce duplicates.
    """
    result = CloneResult()
    existing_codes = {
        (code or "").strip().lower()
        for code in target_model.objects.filter(
            organization=organization, is_deleted=False
        ).values_list("code", flat=True)
    }
    with transaction.atomic():
        for master in masters:
            kwargs = build_kwargs(master)
            code = (kwargs.get("code") or "").strip()
            if not code:
                continue
            key = code.lower()
            if key in existing_codes:
                result.existing_count += 1
                result.existing.append(code)
                continue
            try:
                with transaction.atomic():
                    target_model.objects.create(
                        organization=organization,
                        **kwargs,
                    )
                    result.created_count += 1
                    result.created.append(code)
                    existing_codes.add(key)
            except IntegrityError:
                result.existing_count += 1
                result.existing.append(code)
                existing_codes.add(key)
    return result
