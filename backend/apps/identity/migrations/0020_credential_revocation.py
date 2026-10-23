# WP 7.2 / 7.5: credentials record deliberate revocation.
#
# ``revoked_at`` separates "revoked" from "suspended with the account", so
# re-activating an account no longer revives credentials that were revoked.
# Backfill: an inactive credential whose principal is currently active can only
# have been revoked (suspension happens with the account). Reverse is a no-op;
# the column is dropped by the schema reversal.

from django.db.models import F, Q


def backfill_revoked(apps, schema_editor):
    PersonalAccessToken = apps.get_model("identity", "PersonalAccessToken")
    ApiKey = apps.get_model("identity", "ApiKey")

    PersonalAccessToken.objects.filter(
        is_active=False,
        revoked_at__isnull=True,
        user__is_active=True,
    ).update(revoked_at=F("updated_at"))

    ApiKey.objects.filter(
        is_active=False,
        revoked_at__isnull=True,
    ).filter(
        Q(owner__is_active=True) | Q(owner__isnull=True, created_by__is_active=True),
    ).update(revoked_at=F("updated_at"))

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("identity", "0019_encrypt_totp_secret"),
    ]

    operations = [
        migrations.AddField(
            model_name="apikey",
            name="revoked_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Set when the credential was deliberately revoked. A credential that is merely inactive (owner suspended) has no revoked_at and is restored with the account; a revoked one never is.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="personalaccesstoken",
            name="revoked_at",
            field=models.DateTimeField(
                blank=True,
                help_text="Set when the credential was deliberately revoked. A credential that is merely inactive (owner suspended) has no revoked_at and is restored with the account; a revoked one never is.",
                null=True,
            ),
        ),
        migrations.RunPython(backfill_revoked, migrations.RunPython.noop),
    ]
