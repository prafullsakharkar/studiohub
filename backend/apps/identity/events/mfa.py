from apps.core.events import Event


class MFAEnrollmentStarted(Event):
    event_name = "identity.mfa.enrollment.started"


class MFAEnabled(Event):
    event_name = "identity.mfa.enabled"


class MFADisabled(Event):
    event_name = "identity.mfa.disabled"


class MFAVerified(Event):
    event_name = "identity.mfa.verified"


class MFAVerificationFailed(Event):
    event_name = "identity.mfa.verification.failed"


class MFALocked(Event):
    event_name = "identity.mfa.locked"


class BackupCodesGenerated(Event):
    event_name = "identity.mfa.backup_codes.generated"


class BackupCodeUsed(Event):
    event_name = "identity.mfa.backup_code.used"


class TrustedDeviceRegistered(Event):
    event_name = "identity.mfa.trusted_device.registered"


class TrustedDeviceRevoked(Event):
    event_name = "identity.mfa.trusted_device.revoked"
