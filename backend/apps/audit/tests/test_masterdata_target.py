"""``masterdata`` is a valid audit target."""

from __future__ import annotations

from apps.audit.choices.audit_log import AuditTarget
from apps.audit.constants.targets import AuditTargetCodes
from apps.audit.models import AuditLog
from apps.audit.validators.audit_log import AuditLogValidator


def test_the_three_target_lists_agree_and_include_masterdata():
    model = {value for value, _ in AuditLog.TARGET_CHOICES}
    assert "masterdata" in model
    assert model == set(AuditTarget.values) == set(AuditTargetCodes.ALL)
    assert (
        AuditLog.TARGET_MASTERDATA
        == AuditTarget.MASTERDATA
        == AuditTargetCodes.MASTERDATA
        == "masterdata"
    )
    assert AuditTargetCodes.DESCRIPTIONS["masterdata"]


def test_the_validator_accepts_it():
    assert AuditLogValidator().validate_target("masterdata") is True
