# Generated manually as part of the identity refactor.
#
# - UserSession / LoginHistory were duplicate, organization-owned models
#   (apps.organization owns the enterprise versions with managers, querysets
#   and selectors), so they are dropped here.
# - LoginAttempt.successful is renamed to LoginAttempt.success and the table
#   renamed to ``identity_login_attempts`` to match the API contract.
# - SecurityEvent gains an ``occurred_at`` timestamp.
# - TrustedDevice gains a unique (user, fingerprint) constraint.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("identity", "0005_remove_backupcode_status_remove_ipblacklist_status_and_more"),
    ]

    operations = [
        migrations.RenameField(
            model_name="loginattempt",
            old_name="successful",
            new_name="success",
        ),
        migrations.AlterModelTable(
            name="loginattempt",
            table="identity_login_attempts",
        ),
        migrations.AddField(
            model_name="securityevent",
            name="occurred_at",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AlterUniqueTogether(
            name="trusteddevice",
            unique_together={("user", "fingerprint")},
        ),
        migrations.DeleteModel(
            name="LoginHistory",
        ),
        migrations.DeleteModel(
            name="UserSession",
        ),
    ]
