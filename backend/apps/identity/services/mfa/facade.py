from __future__ import annotations

from .cookies import MFACookieService
from .enrollment import MFAEnrollmentService
from .generators import MFAGeneratorService
from .lockout import MFALockoutService
from .policies import MFAPolicyService
from .recovery import MFARecoveryService
from .trusted_device import MFATrustedDeviceService
from .verification import MFAVerificationService


class MFAService:
    """
    Public entry point for the entire MFA subsystem.

    Views, APIs and other services should only depend on MFAService.
    """

    enrollment = MFAEnrollmentService
    verification = MFAVerificationService
    recovery = MFARecoveryService
    trusted_devices = MFATrustedDeviceService
    lockout = MFALockoutService
    generators = MFAGeneratorService
    cookies = MFACookieService
    policies = MFAPolicyService

    # Enrollment

    enroll = enrollment.enroll
    activate = enrollment.activate
    disable = enrollment.disable
    reset = enrollment.reset
    regenerate_secret = enrollment.regenerate_secret
    provisioning_uri = enrollment.provisioning_uri
    qr_code = enrollment.qr_code

    # Verification

    verify = verification.verify
    verify_recovery_code = verification.verify_recovery_code
    unlock = verification.unlock
    is_locked = verification.is_locked

    # Recovery Codes

    generate_recovery_codes = recovery.generate
    regenerate_recovery_codes = recovery.regenerate
    consume_recovery_code = recovery.consume
    remaining_recovery_codes = recovery.remaining

    # Trusted Devices

    register_device = trusted_devices.register
    revoke_device = trusted_devices.revoke
    revoke_all_devices = trusted_devices.revoke_all
    validate_device = trusted_devices.validate
    list_devices = trusted_devices.list

    # Cookie Helpers

    create_cookie = cookies.create_cookie
    delete_cookie = cookies.delete_cookie

    # Generators

    generate_secret = generators.generate_secret
    generate_qr = generators.qr_code

    # Policies

    requires_mfa = policies.is_required
    requires_step_up = policies.requires_step_up
    can_skip_mfa = policies.can_skip
