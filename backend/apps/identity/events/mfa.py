from apps.core.events import DomainEvent


class MFAEnrollmentStarted(DomainEvent):
    event_type = "identity.mfa.enrollment.started"


class MFAEnabled(DomainEvent):
    event_type = "identity.mfa.enabled"


class MFADisabled(DomainEvent):
    event_type = "identity.mfa.disabled"


class MFAVerified(DomainEvent):
    event_type = "identity.mfa.verified"


class MFAVerificationFailed(DomainEvent):
    event_type = "identity.mfa.verification.failed"


class MFALocked(DomainEvent):
    event_type = "identity.mfa.locked"


class BackupCodesGenerated(DomainEvent):
    event_type = "identity.mfa.backup_codes.generated"


class BackupCodeUsed(DomainEvent):
    event_type = "identity.mfa.backup_code.used"


class TrustedDeviceRegistered(DomainEvent):
    event_type = "identity.mfa.trusted_device.registered"


class TrustedDeviceRevoked(DomainEvent):
    event_type = "identity.mfa.trusted_device.revoked"
