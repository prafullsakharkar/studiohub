# WP 6.1 / 6.4 / 6.5: additive MFA lifecycle changes.
#
# - UserMFA.last_used_step records the last consumed TOTP time step.
# - MFAStatus gains PENDING; SecurityEventType gains the MFA event types
#   (choices only, no schema change).
# - Backup codes that never expired get an expiry (created + MFA_RECOVERY_CODE_DAYS).
#   Reverse leaves the expiry in place: the original NULL cannot be restored
#   and a NULL expiry only meant "never expires".

from datetime import timedelta

from django.conf import settings
from django.db.models import F


def backfill_expiry(apps, schema_editor):
    BackupCode = apps.get_model("identity", "BackupCode")
    days = getattr(settings, "MFA_RECOVERY_CODE_DAYS", 365)

    BackupCode.objects.filter(expires_at__isnull=True).update(
        expires_at=F("created_at") + timedelta(days=days),
    )

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("identity", "0017_drop_known_device"),
    ]

    operations = [
        migrations.AddField(
            model_name="usermfa",
            name="last_used_step",
            field=models.BigIntegerField(
                blank=True,
                help_text="Last accepted TOTP time step; a step is consumable once.",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="securityevent",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("login_success", "Login Success"),
                    ("login_failed", "Login Failed"),
                    ("login_locked", "Login Locked"),
                    ("password_changed", "Password Changed"),
                    ("password_reset", "Password Reset"),
                    ("email_verified", "Email Verified"),
                    ("mfa_enabled", "MFA Enabled"),
                    ("mfa_disabled", "MFA Disabled"),
                    ("mfa_verified", "MFA Verified"),
                    ("mfa_failed", "MFA Failed"),
                    ("mfa_locked", "MFA Locked"),
                    ("mfa_recovery_code_used", "MFA Recovery Code Used"),
                    ("mfa_recovery_codes_regenerated", "MFA Recovery Codes Regenerated"),
                    ("token_refreshed", "Token Refreshed"),
                    ("session_created", "Session Created"),
                    ("session_terminated", "Session Terminated"),
                    ("account_locked", "Account Locked"),
                    ("account_unlocked", "Account Unlocked"),
                    ("account_deactivated", "Account Deactivated"),
                    ("account_activated", "Account Activated"),
                    ("ip_blocked", "IP Blocked"),
                    ("ip_unblocked", "IP Unblocked"),
                    ("trusted_device_added", "Trusted Device Added"),
                    ("trusted_device_removed", "Trusted Device Removed"),
                    ("profile_updated", "Profile Updated"),
                    ("settings_updated", "Settings Updated"),
                    ("api_key_created", "API Key Created"),
                    ("api_key_revoked", "API Key Revoked"),
                    ("permission_changed", "Permission Changed"),
                    ("role_changed", "Role Changed"),
                    ("user_created", "User Created"),
                    ("user_deleted", "User Deleted"),
                    ("suspicious_activity", "Suspicious Activity"),
                    ("data_export", "Data Export"),
                    ("data_import", "Data Import"),
                ],
                db_index=True,
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name="usermfa",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("enabled", "Enabled"),
                    ("disabled", "Disabled"),
                    ("locked", "Locked"),
                ],
                db_index=True,
                default="disabled",
                max_length=32,
            ),
        ),
        migrations.RunPython(backfill_expiry, migrations.RunPython.noop),
    ]
